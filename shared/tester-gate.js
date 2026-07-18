(function () {
  var overlayEl = null;
  var inputEl = null;
  var errorEl = null;
  var submitEl = null;
  var checking = false;
  var released = false;

  function apiRoot() {
    var base = window.API_BASE || '';
    if (!base) return '';
    return base.replace(/\/api\/v1\/?$/i, '') + '/api/v1';
  }

  function paintOverlayHtml() {
    return (
      '<div class="tester-gate-card">' +
      '<div class="tester-gate-mark" aria-hidden="true">S</div>' +
      '<h2 class="tester-gate-title" id="tester-gate-title">Private test access</h2>' +
      '<p class="tester-gate-lede">Enter the tester password to continue.</p>' +
      '<form class="tester-gate-form" id="tester-gate-form" autocomplete="off">' +
      '<label class="tester-gate-label" for="tester-gate-password">Password</label>' +
      '<input class="tester-gate-input" id="tester-gate-password" name="password" type="password" autocomplete="current-password" required autofocus />' +
      '<p class="tester-gate-error" id="tester-gate-error" role="alert" hidden></p>' +
      '<button class="tester-gate-btn" id="tester-gate-submit" type="submit">Unlock</button>' +
      '</form>' +
      '</div>'
    );
  }

  function bindOverlay(el) {
    overlayEl = el;
    inputEl = document.getElementById('tester-gate-password');
    errorEl = document.getElementById('tester-gate-error');
    submitEl = document.getElementById('tester-gate-submit');
    var form = document.getElementById('tester-gate-form');
    if (form && !form.getAttribute('data-bound')) {
      form.setAttribute('data-bound', '1');
      form.addEventListener('submit', onSubmit);
    }
  }

  function ensureOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;
    if (!document.body) return null;

    var existing = document.getElementById('tester-gate-overlay');
    if (existing) {
      bindOverlay(existing);
      return overlayEl;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = 'tester-gate-overlay';
    overlayEl.className = 'tester-gate-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-labelledby', 'tester-gate-title');
    overlayEl.innerHTML = paintOverlayHtml();
    document.body.insertBefore(overlayEl, document.body.firstChild);
    bindOverlay(overlayEl);
    return overlayEl;
  }

  /** Called from <head> boot as soon as <body> exists — paints the form before page content. */
  function paintEarly() {
    document.documentElement.classList.add('tester-gate-pending');
    document.documentElement.classList.add('tester-gate-lock');
    if (!document.body) return false;
    ensureOverlay();
    if (overlayEl) overlayEl.hidden = false;
    return true;
  }

  function showGate() {
    document.documentElement.classList.add('tester-gate-pending');
    document.documentElement.classList.add('tester-gate-lock');
    var el = ensureOverlay();
    if (!el) return;
    el.hidden = false;
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    setTimeout(function () {
      if (inputEl && !released) inputEl.focus();
    }, 30);
  }

  function releaseGate() {
    if (released) return;
    released = true;
    if (overlayEl) overlayEl.hidden = true;
    document.documentElement.classList.remove('tester-gate-pending');
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
    if (checking || released) return;
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
        try {
          window.dispatchEvent(new CustomEvent('strongman:tester-gate-unlocked'));
        } catch (e) {}
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
        if (!data) return;
        if (!data.required || data.unlocked) {
          releaseGate();
        }
      })
      .catch(function () {});
  }

  function boot() {
    showGate();

    function afterReady() {
      showGate();
      checkStatus();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', afterReady);
    } else {
      afterReady();
    }
  }

  window.StrongmanTesterGate = {
    show: showGate,
    release: releaseGate,
    check: checkStatus,
    paintEarly: paintEarly,
  };

  // If this file is loaded from <head>, paint as soon as body appears.
  if (!document.body) {
    var observer = new MutationObserver(function () {
      if (document.body) {
        observer.disconnect();
        paintEarly();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  } else {
    paintEarly();
  }

  boot();
})();
