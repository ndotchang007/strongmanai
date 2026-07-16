(function () {
  var PRODUCTION_API_BASE = 'https://strongmanai-api.onrender.com/api/v1';
  var LOCAL_API_BASE = 'http://127.0.0.1:8080/api/v1';

  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function isLocalDev() {
    try {
      if (window.location.protocol === 'file:') return true;
      var host = (window.location.hostname || '').toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  function resolveApiBase() {
    // Localhost / file:// always hits the local API — never Render.
    // Optional override: localStorage.strongman_api_base
    if (isLocalDev()) {
      try {
        var ls = localStorage.getItem('strongman_api_base');
        if (ls && ls.trim()) return trimSlash(ls.trim());
      } catch (e) {}
      return LOCAL_API_BASE;
    }
    return PRODUCTION_API_BASE;
  }

  var API_BASE = resolveApiBase();
  var USER_KEY = 'strongmanai_user';
  var SESSION_COOKIE = 'strongmanai_session';
  var SESSION_MAX_AGE_SEC = 60 * 24 * 60 * 60;

  function readSessionCookie() {
    try {
      var pattern = new RegExp('(?:^|; )' + SESSION_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      if (!match) return null;
      return JSON.parse(decodeURIComponent(match[1]));
    } catch (e) {
      return null;
    }
  }

  function writeSessionCookie(user) {
    if (!user || user.id == null) return;
    try {
      var payload = encodeURIComponent(
        JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          token: user.token,
          emailVerified: user.emailVerified,
          notifyEmail: user.notifyEmail,
          notifyPush: user.notifyPush,
          firstName: user.firstName,
          lastName: user.lastName,
          profileInitialized: user.profileInitialized,
          lastSeenVersion: user.lastSeenVersion,
          dateOfBirth: user.dateOfBirth
        })
      );
      var secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie =
        SESSION_COOKIE +
        '=' +
        payload +
        '; Max-Age=' +
        SESSION_MAX_AGE_SEC +
        '; Path=/; SameSite=Lax' +
        secure;
    } catch (e) {}
  }

  function clearSessionCookie() {
    try {
      var secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = SESSION_COOKIE + '=; Max-Age=0; Path=/; SameSite=Lax' + secure;
    } catch (e) {}
  }

  function getCurrentUser() {
    try {
      var json = localStorage.getItem(USER_KEY);
      if (json) {
        var parsed = JSON.parse(json);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {}
    var fromCookie = readSessionCookie();
    if (fromCookie && fromCookie.id) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(fromCookie));
      } catch (e2) {}
      return fromCookie;
    }
    return null;
  }

  var BADGES_STORE_KEY = 'strongman_user_badges_v1';

  function ensureJoinPlatformBadge(userId) {
    if (userId == null) return;
    try {
      var uid = String(userId);
      var raw = localStorage.getItem(BADGES_STORE_KEY);
      var bag = raw ? JSON.parse(raw) : {};
      if (typeof bag !== 'object' || bag === null) bag = {};
      var list = Array.isArray(bag[uid]) ? bag[uid].slice() : [];
      var has = list.some(function (b) {
        return b && b.id === 'join-platform';
      });
      if (!has) {
        list.push({ id: 'join-platform', kind: 'platform', label: 'Joined Strongman AI' });
        bag[uid] = list;
        localStorage.setItem(BADGES_STORE_KEY, JSON.stringify(bag));
      }
    } catch (e) {}
  }

  function clearServerSession() {
    try {
      fetch(API_BASE + '/users/logout', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders()
      }).catch(function () {});
    } catch (e) {}
  }

  function setCurrentUser(user) {
    if (user) {
      try {
        var prev = getCurrentUser();
        if (prev && prev.token && !user.token && prev.id === user.id) {
          user = Object.assign({}, user, { token: prev.token });
        }
      } catch (e) {}
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      writeSessionCookie(user);
      if (user.id) ensureJoinPlatformBadge(user.id);
    } else {
      localStorage.removeItem(USER_KEY);
      clearSessionCookie();
      clearServerSession();
    }
    if (window.UserAvatar && typeof window.UserAvatar.syncAll === 'function') {
      window.UserAvatar.syncAll();
    }
    if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
      window.RockySetupAlert.renderAll();
    }
    try {
      window.dispatchEvent(new CustomEvent('strongman:user-updated'));
    } catch (eUserEvt) {}
  }

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try {
      var u = getCurrentUser();
      if (u && u.token) {
        h.Authorization = 'Bearer ' + u.token;
      }
    } catch (e) {}
    return h;
  }

  function fetchOpts(method, body) {
    var opts = {
      method: method,
      credentials: 'include',
      headers: authHeaders()
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    return opts;
  }

  function apiGet(path) {
    return fetch(API_BASE + path, fetchOpts('GET'));
  }

  function apiPost(path, body) {
    return fetch(API_BASE + path, fetchOpts('POST', body));
  }

  function apiPut(path, body) {
    return fetch(API_BASE + path, fetchOpts('PUT', body));
  }

  function apiDelete(path) {
    return fetch(API_BASE + path, fetchOpts('DELETE'));
  }

  function isLoggedIn() {
    var u = getCurrentUser();
    return !!(u && u.id && u.token);
  }

  function needsProfileInit(user) {
    if (!user) return true;
    if (user.profileInitialized === true) return false;
    if (user.firstName && user.dateOfBirth) return false;
    return true;
  }

  function currentAppVersion() {
    return (window.VERSION_CATALOG && window.VERSION_CATALOG.current) || 'v1.2';
  }

  function needsCatchup(user) {
    if (!user || !user.profileInitialized) return false;
    return user.lastSeenVersion !== currentAppVersion();
  }

  function resolvePostAuthPath(user, nextPath) {
    if (nextPath) return nextPath;
    if (needsProfileInit(user)) return '/init';
    if (needsCatchup(user)) return '/catchup';
    return '/home';
  }

  window.API_BASE = API_BASE;
  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.isLoggedIn = isLoggedIn;
  window.needsProfileInit = needsProfileInit;
  window.needsCatchup = needsCatchup;
  window.resolvePostAuthPath = resolvePostAuthPath;
  window.apiGet = apiGet;
  window.apiPost = apiPost;
  window.apiPut = apiPut;
  window.apiDelete = apiDelete;
  window.ensureJoinPlatformBadge = ensureJoinPlatformBadge;
})();
