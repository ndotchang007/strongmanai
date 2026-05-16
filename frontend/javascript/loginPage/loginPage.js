(function () {
  var track = document.getElementById('auth-panels-track');
  var tabLogin = document.getElementById('auth-tab-login');
  var tabSignup = document.getElementById('auth-tab-signup');

  var loginForm = document.getElementById('login-form');
  var signupForm = document.getElementById('signup-form');
  var loginErrorEl = document.getElementById('login-error');
  var signupErrorEl = document.getElementById('signup-error');
  var viewport = track ? track.closest('.auth-panels-viewport') : null;

  var credentialInput = document.getElementById('credential');
  var credentialLabel = document.getElementById('credential-label');
  var toggleBtn = document.getElementById('login-toggle-btn');

  var isEmailMode = true;

  function getInitialPanel() {
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path.endsWith('/signup')) return 'signup';
    var q = new URLSearchParams(window.location.search);
    if (q.get('signup') === '1' || q.get('mode') === 'signup') return 'signup';
    return 'login';
  }

  function syncUrlForPanel(panel) {
    try {
      var u = new URL(window.location.href);
      u.pathname = panel === 'signup' ? '/signup' : '/login';
      u.search = '';
      window.history.replaceState({}, '', u.pathname + u.search);
    } catch (e) {}
  }

  function updateTitle(panel) {
    document.title =
      panel === 'signup' ? 'Create account – Strongman AI' : 'Sign in – Strongman AI';
  }

  function setPanel(panel, opts) {
    opts = opts || {};
    if (!track) return;
    var next = panel === 'signup' ? 'signup' : 'login';
    track.setAttribute('data-panel', next);
    updateTitle(next);
    if (tabLogin) {
      tabLogin.setAttribute('aria-selected', next === 'login' ? 'true' : 'false');
    }
    if (tabSignup) {
      tabSignup.setAttribute('aria-selected', next === 'signup' ? 'true' : 'false');
    }
    var loginPanel = document.getElementById('auth-panel-login');
    var signupPanel = document.getElementById('auth-panel-signup');
    if (loginPanel) loginPanel.setAttribute('aria-hidden', next === 'login' ? 'false' : 'true');
    if (signupPanel) signupPanel.setAttribute('aria-hidden', next === 'signup' ? 'false' : 'true');
    if (!opts.skipUrl) syncUrlForPanel(next);
    document.body.setAttribute('data-auth-panel', next);
    if (viewport) viewport.scrollLeft = 0;
    if (opts.focus === true) {
      window.requestAnimationFrame(function () {
        var id = next === 'signup' ? 'signup-email' : 'credential';
        var el = document.getElementById(id);
        if (el && typeof el.focus === 'function') {
          try {
            el.focus({ preventScroll: true });
          } catch (e) {
            el.focus();
          }
        }
        if (viewport) viewport.scrollLeft = 0;
      });
    }
  }

  function showLoginError(msg) {
    if (loginErrorEl) {
      loginErrorEl.textContent = msg;
      loginErrorEl.hidden = false;
    }
  }

  function hideLoginError() {
    if (loginErrorEl) {
      loginErrorEl.textContent = '';
      loginErrorEl.hidden = true;
    }
  }

  function showSignupError(msg) {
    if (signupErrorEl) {
      signupErrorEl.textContent = msg;
      signupErrorEl.hidden = false;
    }
  }

  function hideSignupError() {
    if (signupErrorEl) {
      signupErrorEl.textContent = '';
      signupErrorEl.hidden = true;
    }
  }

  /** Internal path only — avoids open redirects. */
  function readSafeNextPath() {
    try {
      var q = new URLSearchParams(window.location.search);
      var n = q.get('next');
      if (n && n.charAt(0) === '/' && n.indexOf('//') !== 0) {
        return n;
      }
    } catch (e) {}
    return null;
  }

  function setEmailMode() {
    isEmailMode = true;
    if (!credentialInput || !credentialLabel) return;
    credentialInput.type = 'email';
    credentialInput.placeholder = ' ';
    credentialInput.setAttribute('autocomplete', 'email');
    credentialLabel.textContent = 'Email';
    if (toggleBtn) toggleBtn.textContent = 'Use username instead';
  }

  function setUsernameMode() {
    isEmailMode = false;
    if (!credentialInput || !credentialLabel) return;
    credentialInput.type = 'text';
    credentialInput.placeholder = ' ';
    credentialInput.setAttribute('autocomplete', 'username');
    credentialLabel.textContent = 'Username';
    if (toggleBtn) toggleBtn.textContent = 'Use email instead';
  }

  if (toggleBtn && credentialInput) {
    toggleBtn.addEventListener('click', function () {
      hideLoginError();
      isEmailMode = !isEmailMode;
      if (isEmailMode) setEmailMode();
      else setUsernameMode();
    });
  }

  if (tabLogin) {
    tabLogin.addEventListener('click', function () {
      hideLoginError();
      hideSignupError();
      setPanel('login');
    });
  }
  if (tabSignup) {
    tabSignup.addEventListener('click', function () {
      hideLoginError();
      hideSignupError();
      setPanel('signup');
    });
  }

  setPanel(getInitialPanel(), { skipUrl: true });

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideLoginError();

      var credential = credentialInput ? credentialInput.value.trim() : '';
      var passEl = document.getElementById('login-password');
      var password = passEl ? passEl.value : '';

      if (!credential || !password) {
        showLoginError(isEmailMode ? 'Please enter email and password.' : 'Please enter username and password.');
        return;
      }

      var body = isEmailMode
        ? { email: credential, password: password }
        : { username: credential, password: password };

      window
        .apiPost('/users/login', body)
        .then(function (res) {
          return res.json().then(function (data) {
            if (res.ok) {
              window.setCurrentUser(data);
              window.location.href = readSafeNextPath() || '/home';
            } else {
              showLoginError(data.error || (isEmailMode ? 'Invalid email or password.' : 'Invalid username or password.'));
            }
          });
        })
        .catch(function () {
          showLoginError('Network error. Is the backend running?');
        });
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideSignupError();

      var emailEl = document.getElementById('signup-email');
      var pwEl = document.getElementById('signup-password');
      var cfEl = document.getElementById('signup-confirm');
      var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
      var password = pwEl ? pwEl.value : '';
      var confirmPassword = cfEl ? cfEl.value : '';

      if (!email || !password || !confirmPassword) {
        showSignupError('Please enter email and both passwords.');
        return;
      }

      if (password !== confirmPassword) {
        showSignupError('Passwords do not match.');
        return;
      }

      var username = email.split('@')[0] || 'user';

      window
        .apiPost('/users', {
          username: username,
          email: email,
          password: password
        })
        .then(function (res) {
          return res.json().then(function (data) {
            if (res.ok) {
              window.setCurrentUser(data);
              window.location.href = '/init';
            } else {
              showSignupError(data.error || 'Sign up failed.');
            }
          });
        })
        .catch(function () {
          showSignupError('Network error. Is the backend running?');
        });
    });
  }
})();
