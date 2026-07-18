(function () {
  var overlayEl = null;
  var inputEl = null;
  var errorEl = null;
  var submitEl = null;
  var checking = false;

  function apiRoot() {
    var base = window.API_BASE || '';
    if (!base) return '';
    return base.replace(/\/api\/v1\/?$/i, '') + '/api/v1';
  }

  function ensureStyles() {
    if (document.getElementById('tester-gate-css')) return;
    var link = document.createElement('link');
    link.id = 'tester-gate-css';
    link.rel = 'stylesheet';
    link.href = '/css/tester-gate.css';
    document.head.appendChild(link);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    ensureStyles();
    overlayEl = document.createElement('div');
    overlayEl.id = 'tester-gate-overlay';
    overlayEl.className = 'tester-gate-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-labelledby', 'tester-gate-title');
    overlayEl.hidden = true;
    overlayEl.innerHTML =
      '<div class="tester-gate-card">' +
      '<div class="tester-gate-mark" aria-hidden="true">S</div>' +
      '<h2 class="tester-gate-title" id="tester-gate-title">Private test access</h2>' +
      '<p class="tester-gate-lede">Enter the tester password to use this build.</p>' +
      '<form class="tester-gate-form" id="tester-gate-form" autocomplete="off">' +
      '<label class="tester-gate-label" for="tester-gate-password">Password</label>' +
      '<input class="tester-gate-input" id="tester-gate-password" name="password" type="password" autocomplete="current-password" required />' +
      '<p class="tester-gate-error" id="tester-gate-error" role="alert" hidden></p>' +
      '<button class="tester-gate-btn" id="tester-gate-submit" type="submit">Unlock</button>' +
      '</form>' +
      '</div>';
    document.body.appendChild(overlayEl);
    inputEl = document.getElementById('tester-gate-password');
    errorEl = document.getElementById('tester-gate-error');
    submitEl = document.getElementById('tester-gate-submit');
    var form = document.getElementById('tester-gate-form');
    if (form) form.addEventListener('submit', onSubmit);
    return overlayEl;
  }

  function showOverlay() {
    ensureOverlay();
    document.documentElement.classList.add('tester-gate-lock');
    overlayEl.hidden = false;
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    setTimeout(function () {
      if (inputEl) inputEl.focus();
    }, 50);
  }

  function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.hidden = true;
    document.documentElement.classList.remove('tester-gate-lock');
  }

  function setError(msg) {
    if (!errorEl) return;
    if (!msg) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  function setBusy(busy) {
    if (submitEl) submitEl.disabled = !!busy;
    if (inputEl) inputEl.disabled = !!busy;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (checking) return;
    var password = inputEl ? String(inputEl.value || '') : '';
    if (!password) {
      setError('Enter the tester password.');
      return;
    }
    unlock(password);
  }

  function unlock(password) {
    var root = apiRoot();
    if (!root) {
      setError('API is not configured.');
      return;
    }
    checking = true;
    setBusy(true);
    setError('');
    fetch(root + '/tester-gate/unlock', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          return { ok: r.ok, status: r.status, body: body || {} };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          setError(res.body.error || 'Incorrect password');
          return;
        }
        hideOverlay();
        try {
          window.dispatchEvent(new CustomEvent('strongman:tester-gate-unlocked'));
        } catch (e) {}
        // Reload so in-flight pages re-fetch with the gate cookie.
        window.location.reload();
      })
      .catch(function () {
        setError('Could not reach the server. Try again.');
      })
      .then(function () {
        checking = false;
        setBusy(false);
      });
  }

  function checkStatus() {
    var root = apiRoot();
    if (!root) return;
    fetch(root + '/tester-gate/status', { credentials: 'include' })
      .then(function (r) {
        return r.json().catch(function () {
          return null;
        });
      })
      .then(function (data) {
        if (!data || !data.required) return;
        if (data.unlocked) return;
        showOverlay();
      })
      .catch(function () {
        // If the API is asleep / unreachable, server-wake handles wake-up.
      });
  }

  function boot() {
    if (!window.API_BASE) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkStatus);
    } else {
      checkStatus();
    }
  }

  window.StrongmanTesterGate = {
    show: showOverlay,
    check: checkStatus,
  };

  boot();
})();
