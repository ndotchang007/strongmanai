(function () {
  /** GitHub Pages clean URLs (mirrors _redirects + backend PAGE_ROUTES). */
  var STORAGE_KEY = 'strongman_gh_clean_path';

  var EXACT = {
    '/': 'index.html',
    '/login': 'login.html',
    '/signup': 'login.html',
    '/verify-email': 'verify-email.html',
    '/home': 'home.html',
    '/profile': 'profile.html',
    '/init': 'init.html',
    '/leaderboard': 'leaderboard.html',
    '/leaderboards': 'leaderboards.html',
    '/tracking': 'create.html',
    '/create': 'create.html',
    '/customize': 'customize.html',
    '/user-settings': 'customize.html',
    '/info': 'info.html',
    '/versions': 'versions.html',
    '/generate': 'generate.html',
    '/explore': 'home.html',
    '/about': 'about.html',
    '/legal': 'legal.html',
    '/surveys': 'surveys.html',
  };

  function normalizePath(path) {
    var p = path || '/';
    if (p.length > 1 && p.slice(-1) === '/') p = p.slice(0, -1);
    return p || '/';
  }

  function restoreCleanPath() {
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      sessionStorage.removeItem(STORAGE_KEY);
      var target = normalizePath(stored);
      var current = normalizePath(location.pathname);
      if (target && target !== current) {
        history.replaceState(null, '', target + location.search + location.hash);
      }
    } catch (e) {}
  }

  function route404() {
    var path = normalizePath(location.pathname);

    if (/^\/versions\/[^/]+/.test(path)) {
      try {
        sessionStorage.setItem(STORAGE_KEY, path);
      } catch (e) {}
      location.replace('/version.html' + location.search + location.hash);
      return true;
    }
    if (/^\/survey\/[^/]+/.test(path)) {
      try {
        sessionStorage.setItem(STORAGE_KEY, path);
      } catch (e) {}
      location.replace('/survey.html' + location.search + location.hash);
      return true;
    }

    var file = EXACT[path];
    if (file) {
      location.replace('/' + file + location.search + location.hash);
      return true;
    }
    return false;
  }

  window.StrongmanGhPages = {
    restoreCleanPath: restoreCleanPath,
    route404: route404,
  };

  if (document.currentScript && document.currentScript.getAttribute('data-restore') === '1') {
    restoreCleanPath();
  }
})();
