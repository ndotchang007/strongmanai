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

  var CATCHUP_BOUNCE_KEY = 'strongman_catchup_bounce';

  function normalizeAppPath(path) {
    var p = path || '/';
    if (p.length > 1 && p.slice(-1) === '/') {
      p = p.slice(0, -1);
    }
    if (p === '/home.html') return '/home';
    if (p === '/catchup.html') return '/catchup';
    if (p === '/init.html') return '/init';
    return p || '/';
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

  function isCatchupPath(p) {
    return p === '/catchup' || p === '/catchup.html';
  }

  function isInitPath(p) {
    return p === '/init' || p === '/init.html';
  }

  function recordCatchupBounce(fromPath, toPath) {
    try {
      sessionStorage.setItem(
        CATCHUP_BOUNCE_KEY,
        JSON.stringify({ from: fromPath, to: toPath, at: Date.now() })
      );
    } catch (e) {}
  }

  function isCatchupBounceLoop(fromPath, toPath) {
    try {
      var raw = sessionStorage.getItem(CATCHUP_BOUNCE_KEY);
      if (!raw) return false;
      var prev = JSON.parse(raw);
      if (!prev || !prev.from || !prev.to || !prev.at) return false;
      if (Date.now() - prev.at > 4000) return false;
      return prev.from === toPath && prev.to === fromPath;
    } catch (e2) {
      return false;
    }
  }

  function redirectTo(path, fromPath) {
    recordCatchupBounce(fromPath, path);
    try {
      window.location.replace(path);
    } catch (e) {
      window.location.href = path;
    }
  }

  function applyCatchupRouting(path) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var needsCatchupFlow =
      typeof window.needsCatchup === 'function' ? window.needsCatchup(u) : false;
    var onCatchup = isCatchupPath(path);
    var onInit = isInitPath(path);

    if (needsCatchupFlow && !onCatchup && !onInit) {
      if (!isCatchupBounceLoop(path, '/catchup')) {
        redirectTo('/catchup', path);
      }
      return;
    }

    if (!needsCatchupFlow && onCatchup) {
      if (!isCatchupBounceLoop(path, '/home')) {
        redirectTo('/home', path);
      }
    }
  }

  var path = normalizeAppPath(window.location.pathname || '/');

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

  if (needsInit && !isInitPath(path)) {
    try {
      window.location.replace('/init');
    } catch (e3) {
      window.location.href = '/init';
    }
    return;
  }

  if (!needsInit && isInitPath(path)) {
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

  // Refresh profile from the server before catchup routing so stale local storage
  // (or a race with home bootSync) cannot bounce between /home and /catchup.
  if (typeof window.refreshCurrentUserFromServer === 'function' && u && u.id) {
    window.refreshCurrentUserFromServer().then(function () {
      applyCatchupRouting(path);
    });
    return;
  }

  applyCatchupRouting(path);
})();
