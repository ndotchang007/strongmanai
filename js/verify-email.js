(function () {
  var titleEl = document.getElementById('verify-title');
  var descEl = document.getElementById('verify-desc');
  var errorEl = document.getElementById('verify-error');
  var actionLink = document.getElementById('verify-action-link');
  var redirectNote = document.getElementById('verify-redirect-note');
  var resendBtn = document.getElementById('verify-resend-btn');
  var cardEl = document.getElementById('verify-card');

  var PENDING_KEY = 'strongmanai_pending_verify_email';
  var REDIRECT_SECONDS = 5;

  function readQuery() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function pendingEmail() {
    try {
      return sessionStorage.getItem(PENDING_KEY);
    } catch (e) {
      return null;
    }
  }

  function setCardState(state) {
    if (cardEl) cardEl.setAttribute('data-state', state);
  }

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
  }

  function hideError() {
    if (errorEl) errorEl.hidden = true;
  }

  function setTitle(text) {
    if (titleEl) titleEl.textContent = text;
    document.title = text + ' – Strongman AI';
  }

  function startRedirectCountdown() {
    if (!redirectNote || !actionLink) return;
    redirectNote.hidden = false;
    var remaining = REDIRECT_SECONDS;
    function tick() {
      redirectNote.textContent = 'Redirecting to sign in in ' + remaining + 's…';
      if (remaining <= 0) {
        window.location.href = '/login';
        return;
      }
      remaining -= 1;
      window.setTimeout(tick, 1000);
    }
    tick();
  }

  function showResend() {
    if (!resendBtn) return;
    var email = pendingEmail();
    if (!email) return;
    resendBtn.hidden = false;
    resendBtn.onclick = function () {
      resendBtn.disabled = true;
      hideError();
      window
        .apiPost('/users/resend-verification', { email: email })
        .then(function (res) {
          return res.json().then(function (data) {
            if (res.ok) {
              setTitle('Email sent');
              if (descEl) {
                descEl.textContent =
                  'We sent a new confirmation link. Check your inbox and spam folder.';
              }
              hideError();
            } else {
              showError(data.error || 'Could not resend email.');
            }
          });
        })
        .catch(function () {
          showError('Could not reach the server. Is the backend running?');
        })
        .finally(function () {
          resendBtn.disabled = false;
        });
    };
  }

  var q = readQuery();
  var verified = q.get('verified') === '1';
  var error = q.get('error');
  var token = q.get('token');

  if (verified) {
    setCardState('success');
    setTitle('Email verified');
    if (descEl) {
      descEl.textContent =
        q.get('already') === '1'
          ? 'Your email was already verified. You can sign in.'
          : 'Your account is ready. You can sign in now.';
    }
    if (actionLink) {
      actionLink.textContent = 'Sign in now';
      actionLink.href = '/login';
    }
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch (e) {}
    startRedirectCountdown();
    return;
  }

  if (error) {
    setCardState('error');
    setTitle('Verification failed');
    if (descEl) {
      descEl.textContent =
        error === 'expired'
          ? 'This confirmation link has expired.'
          : 'This confirmation link is invalid or has already been used.';
    }
    showError('Request a new confirmation email, then use the latest link only.');
    if (actionLink) {
      actionLink.textContent = 'Back to sign in';
      actionLink.href = '/login';
    }
    showResend();
    return;
  }

  if (token) {
    setCardState('loading');
    setTitle('Confirming…');
    if (descEl) descEl.textContent = 'Verifying your link…';
    window
      .apiPost('/users/verify-email', { token: token })
      .then(function (res) {
        return res.json().then(function (data) {
          if (res.ok) {
            window.location.replace('/verify-email?verified=1' + (data.alreadyVerified ? '&already=1' : ''));
          } else {
            window.location.replace(
              '/verify-email?error=' + (data.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid')
            );
          }
        });
      })
      .catch(function () {
        setCardState('error');
        setTitle('Verification failed');
        if (descEl) descEl.textContent = 'We could not reach the server.';
        showError('Make sure the backend is running, then try the link again.');
      });
    return;
  }

  setCardState('pending');
  setTitle('Check your inbox');
  if (descEl) {
    descEl.textContent =
      'We sent a confirmation link to your email. Open the latest message and tap the button inside.';
  }
  if (actionLink) {
    actionLink.textContent = 'Back to sign in';
    actionLink.href = '/login';
  }
  showResend();
})();
