/**
 * Requires a logged-in user (session cookie + localStorage via api.js) for app pages.
 * Public routes: landing (/), public leaderboards, about, login, signup, legal.
 * Unauthenticated visitors are sent to /login with a ?next= return path.
 * Users who have not finished profile initialization are sent to /init on first login.
 * Returning v0.1 users who have not seen the current release are sent to /catchup.
 */
(function () {
  if (typeof window === 'undefined' || !window.location) return;
  try {
    if (window.location.protocol === 'file:') return;
  } catch (e) {}

  var path = window.location.pathname || '/';
  if (path.length > 1 && path.slice(-1) === '/') {
    path = path.slice(0, -1);
  }

  function isPublicPath(p) {
    if (p === '' || p === '/') return true;
    var exact = ['/leaderboards', '/about', '/download', '/login', '/signup', '/verify-email', '/legal', '/surveys'];
    for (var i = 0; i < exact.length; i++) {
      if (p === exact[i]) return true;
    }
    if (p.indexOf('/survey/') === 0) return true;
    return false;
  }

  if (isPublicPath(path)) return;

  var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  if (!u || !u.id || !u.token) {
    var returnPath = path + (window.location.search || '');
    var loginUrl = '/login?next=' + encodeURIComponent(returnPath);
    try {
      window.location.replace(loginUrl);
    } catch (e2) {
      window.location.href = loginUrl;
    }
    return;
  }

  var needsInit =
    typeof window.needsProfileInit === 'function' ? window.needsProfileInit(u) : false;

  if (needsInit && path !== '/init') {
    try {
      window.location.replace('/init');
    } catch (e3) {
      window.location.href = '/init';
    }
    return;
  }

  if (!needsInit && path === '/init') {
    var refineMode = /(?:^|[?&])refine=1(?:&|$)/.test(window.location.search || '');
    if (!refineMode) {
      try {
        window.location.replace('/home');
      } catch (e4) {
        window.location.href = '/home';
      }
      return;
    }
  }

  var needsCatchupFlow =
    typeof window.needsCatchup === 'function' ? window.needsCatchup(u) : false;

  if (needsCatchupFlow && path !== '/catchup' && path !== '/init') {
    try {
      window.location.replace('/catchup');
    } catch (e5) {
      window.location.href = '/catchup';
    }
    return;
  }

  if (!needsCatchupFlow && path === '/catchup') {
    try {
      window.location.replace('/home');
    } catch (e6) {
      window.location.href = '/home';
    }
  }
})();
