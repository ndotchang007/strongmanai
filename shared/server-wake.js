(function () {
  var AWAKE_KEY = 'strongman-server-awake';
  var AWAKE_TTL_MS = 12 * 60 * 1000;
  var QUICK_TIMEOUT_MS = 3500;
  var PING_TIMEOUT_MS = 15000;
  var RETRY_INTERVAL_MS = 2500;
  var MAX_WAIT_MS = 55000;
  var overlayEl = null;
  var progressBarEl = null;
  var statusEl = null;

  function isLocalApi() {
    try {
      var base = window.API_BASE || '';
      if (/localhost|127\.0\.0\.1/.test(base)) return true;
      var host = (window.location.hostname || '').toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  function isPublicPath(p) {
    if (p === '' || p === '/') return true;
    var exact = [
      '/leaderboards',
      '/about',
      '/download',
      '/login',
      '/signup',
      '/verify-email',
      '/legal',
      '/surveys',
    ];
    for (var i = 0; i < exact.length; i++) {
      if (p === exact[i]) return true;
    }
    if (p.indexOf('/survey/') === 0) return true;
    return false;
  }

  function currentPath() {
    var path = window.location.pathname || '/';
    if (path.length > 1 && path.slice(-1) === '/') path = path.slice(0, -1);
    return path;
  }

  function isLoggedIn() {
    return typeof window.isLoggedIn === 'function' && window.isLoggedIn();
  }

  function healthUrl() {
    var base = window.API_BASE || '';
    if (!base) return '';
    return base.replace(/\/api\/v1\/?$/i, '') + '/health';
  }

  function wasRecentlyAwake() {
    try {
      var raw = sessionStorage.getItem(AWAKE_KEY);
      if (!raw) return false;
      return Date.now() - parseInt(raw, 10) < AWAKE_TTL_MS;
    } catch (e) {
      return false;
    }
  }

  function markAwake() {
    try {
      sessionStorage.setItem(AWAKE_KEY, String(Date.now()));
    } catch (e) {}
  }

  function ensureStyles() {
    if (document.getElementById('server-wake-css')) return;
    var link = document.createElement('link');
    link.id = 'server-wake-css';
    link.rel = 'stylesheet';
    link.href = '/css/server-wake.css';
    document.head.appendChild(link);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    ensureStyles();
    overlayEl = document.createElement('div');
    overlayEl.id = 'server-wake-overlay';
    overlayEl.className = 'server-wake-overlay';
    overlayEl.setAttribute('role', 'alertdialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-labelledby', 'server-wake-title');
    overlayEl.setAttribute('aria-describedby', 'server-wake-lede');
    overlayEl.hidden = true;
    overlayEl.innerHTML =
      '<div class="server-wake-card">' +
      '<div class="server-wake-mark" aria-hidden="true">S</div>' +
      '<h2 class="server-wake-title" id="server-wake-title">Waking up our servers</h2>' +
      '<p class="server-wake-lede" id="server-wake-lede">' +
      'Render puts our API to sleep after about <strong>30 seconds</strong> of inactivity. ' +
      'Give us roughly <strong>20 seconds</strong> to spin back up — your session is still saved.' +
      '</p>' +
      '<div class="server-wake-progress" aria-hidden="true">' +
      '<span class="server-wake-progress-bar" id="server-wake-progress-bar"></span>' +
      '</div>' +
      '<p class="server-wake-status" id="server-wake-status">Connecting…</p>' +
      '</div>';
    document.body.appendChild(overlayEl);
    progressBarEl = document.getElementById('server-wake-progress-bar');
    statusEl = document.getElementById('server-wake-status');
    return overlayEl;
  }

  function showOverlay() {
    ensureOverlay();
    document.documentElement.classList.add('server-wake-lock');
    overlayEl.hidden = false;
    updateProgress(0);
    if (statusEl) statusEl.textContent = 'Connecting…';
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.hidden = true;
    document.documentElement.classList.remove('server-wake-lock');
  }

  function updateProgress(startedAt) {
    if (!progressBarEl) return;
    var elapsed = Date.now() - startedAt;
    var pct = Math.min(100, Math.round((elapsed / 20000) * 100));
    progressBarEl.style.width = pct + '%';
    if (statusEl) {
      if (elapsed < 8000) {
        statusEl.textContent = 'Starting server… usually about 20 seconds.';
      } else if (elapsed < 20000) {
        statusEl.textContent = 'Almost there — thanks for waiting.';
      } else {
        statusEl.textContent = 'Still waking up… hang tight a few more seconds.';
      }
    }
  }

  function pingHealth(timeoutMs) {
    return new Promise(function (resolve) {
      var url = healthUrl();
      if (!url) {
        resolve(false);
        return;
      }
      var done = false;
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = window.setTimeout(function () {
        if (done) return;
        done = true;
        if (controller) controller.abort();
        resolve(false);
      }, timeoutMs || QUICK_TIMEOUT_MS);

      fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve(!!(res && res.ok));
        })
        .catch(function () {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve(false);
        });
    });
  }

  function waitForServer(callback) {
    callback = typeof callback === 'function' ? callback : function () {};

    if (isLocalApi()) {
      callback(true);
      return;
    }
    if (!isLoggedIn()) {
      callback(true);
      return;
    }
    if (wasRecentlyAwake()) {
      callback(true);
      return;
    }

    pingHealth(QUICK_TIMEOUT_MS).then(function (ok) {
      if (ok) {
        markAwake();
        callback(true);
        return;
      }

      showOverlay();
      var startedAt = Date.now();

      function attempt() {
        updateProgress(startedAt);
        pingHealth(PING_TIMEOUT_MS).then(function (alive) {
          if (alive) {
            markAwake();
            hideOverlay();
            callback(true);
            return;
          }
          if (Date.now() - startedAt >= MAX_WAIT_MS) {
            hideOverlay();
            callback(false);
            return;
          }
          window.setTimeout(attempt, RETRY_INTERVAL_MS);
        });
      }

      attempt();
    });
  }

  function shouldAutoRun() {
    if (isLocalApi()) return false;
    if (!isLoggedIn()) return false;
    if (isPublicPath(currentPath())) return false;
    return true;
  }

  window.ServerWake = {
    waitForServer: waitForServer,
    pingHealth: pingHealth,
    markAwake: markAwake,
  };

  if (shouldAutoRun()) {
    waitForServer(function () {});
  }
})();
