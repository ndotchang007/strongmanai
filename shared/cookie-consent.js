/**
 * Small cookie consent bar for the marketing landing page.
 */
(function () {
  var CONSENT_KEY = 'strongmanai_cookie_consent';

  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, '1');
    } catch (e) {}
  }

  function mountBanner() {
    if (hasConsent()) return;
    if (document.getElementById('cookie-consent-bar')) return;

    var bar = document.createElement('div');
    bar.id = 'cookie-consent-bar';
    bar.className = 'cookie-consent-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie notice');

    bar.innerHTML =
      '<div class="cookie-consent-inner">' +
      '<p class="cookie-consent-text">' +
      'We use cookies to keep you signed in and remember your preferences. ' +
      '<a href="/legal" class="cookie-consent-link">Learn more</a>' +
      '</p>' +
      '<button type="button" class="cookie-consent-accept" id="cookie-consent-accept">Accept</button>' +
      '</div>';

    document.body.appendChild(bar);

    var btn = document.getElementById('cookie-consent-accept');
    if (btn) {
      btn.addEventListener('click', function () {
        setConsent();
        bar.classList.add('cookie-consent-bar--hide');
        window.setTimeout(function () {
          if (bar.parentNode) bar.parentNode.removeChild(bar);
        }, 280);
      });
    }
  }

  window.hasCookieConsent = hasConsent;
  window.acceptCookieConsent = setConsent;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBanner);
  } else {
    mountBanner();
  }
})();
