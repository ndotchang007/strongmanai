/**
 * Requires a logged-in user (localStorage via api.js) for app pages.
 * Public routes: landing (/), public leaderboards, about, login, signup, legal.
 * Unauthenticated visitors are sent to the landing page to sign in.
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
    var exact = ['/leaderboards', '/about', '/login', '/signup', '/legal'];
    for (var i = 0; i < exact.length; i++) {
      if (p === exact[i]) return true;
    }
    return false;
  }

  if (isPublicPath(path)) return;

  var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  if (u && u.id) return;

  try {
    window.location.replace('/');
  } catch (e2) {
    window.location.href = '/';
  }
})();
