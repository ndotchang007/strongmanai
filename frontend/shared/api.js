(function () {
  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function resolveApiBase() {
    try {
      var meta = document.querySelector('meta[name="strongman-api-base"]');
      if (meta) {
        var c = (meta.getAttribute('content') || '').trim();
        if (c) return trimSlash(c);
      }
    } catch (e) {}
    try {
      var ls = localStorage.getItem('strongman_api_base');
      if (ls && ls.trim()) return trimSlash(ls.trim());
    } catch (e) {}
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.protocol &&
      window.location.protocol !== 'file:'
    ) {
      var origin = (window.location.origin || '').replace(/\/+$/, '');
      if (origin) return origin + '/api/v1';
    }
    return 'http://127.0.0.1:8080/api/v1';
  }

  var API_BASE = resolveApiBase();
  var USER_KEY = 'strongmanai_user';

  function getCurrentUser() {
    try {
      var json = localStorage.getItem(USER_KEY);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      return null;
    }
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

  function setCurrentUser(user) {
    if (user) {
      try {
        var prev = getCurrentUser();
        if (prev && prev.token && !user.token && prev.id === user.id) {
          user = Object.assign({}, user, { token: prev.token });
        }
      } catch (e) {}
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      if (user.id) ensureJoinPlatformBadge(user.id);
    } else {
      localStorage.removeItem(USER_KEY);
    }
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

  function apiGet(path) {
    return fetch(API_BASE + path, { method: 'GET', headers: authHeaders() });
  }

  function apiPost(path, body) {
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
  }

  function apiPut(path, body) {
    return fetch(API_BASE + path, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
  }

  function apiDelete(path) {
    return fetch(API_BASE + path, { method: 'DELETE', headers: authHeaders() });
  }

  window.API_BASE = API_BASE;
  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.apiGet = apiGet;
  window.apiPost = apiPost;
  window.apiPut = apiPut;
  window.apiDelete = apiDelete;
  window.ensureJoinPlatformBadge = ensureJoinPlatformBadge;
})();
