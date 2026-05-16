(function () {
  var STORAGE_BASE = 'strongman_workouts_v1';
  var LEGACY_KEY = 'strongman_workouts_v1';

  function userSuffix() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '_guest';
      var u = window.getCurrentUser();
      return u && u.id != null ? '_u' + u.id : '_guest';
    } catch (e) {
      return '_guest';
    }
  }

  function storageKey() {
    return STORAGE_BASE + userSuffix();
  }

  function migrateLegacy() {
    var key = storageKey();
    try {
      if (localStorage.getItem(key)) return;
      var legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(key, legacy);
      }
    } catch (e) {}
  }

  function loadStore() {
    migrateLegacy();
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return { sessions: [] };
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.sessions)) return { sessions: [] };
      return data;
    } catch (e) {
      return { sessions: [] };
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(store));
    } catch (e) {}
  }

  function intensityLabel(score) {
    var n = parseInt(score, 10);
    if (isNaN(n)) return '—';
    n = Math.min(100, Math.max(0, n));
    if (n <= 33) return 'Low';
    if (n <= 66) return 'Moderate';
    return 'High';
  }

  /**
   * Mutate a session in place (e.g. attach photos). Saves local store only.
   */
  function updateSession(sessionId, mutator) {
    migrateLegacy();
    var store = loadStore();
    var idx = store.sessions.findIndex(function (s) {
      return s && (s.id === sessionId || (s.serverId != null && String(s.serverId) === String(sessionId)));
    });
    if (idx === -1) return false;
    try {
      mutator(store.sessions[idx]);
    } catch (e) {
      return false;
    }
    saveStore(store);
    return true;
  }

  function pushSessionToServer(session) {
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      if (!u || u.id == null || !window.apiPost) return;
      var clientId = session.id;
      window
        .apiPost('/users/' + u.id + '/workouts', { payload: session })
        .then(function (res) {
          if (!res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (!data || data.serverId == null) return;
          var store = loadStore();
          var idx = store.sessions.findIndex(function (s) {
            return s.id === clientId;
          });
          if (idx !== -1) {
            var prevRow = store.sessions[idx];
            if (
              prevRow &&
              Array.isArray(prevRow.photos) &&
              prevRow.photos.length &&
              (!data.photos || !data.photos.length)
            ) {
              data = Object.assign({}, data, { photos: prevRow.photos });
            }
            store.sessions[idx] = data;
            saveStore(store);
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  function addSession(session) {
    var store = loadStore();
    session.id =
      session.id || 'w-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    session.createdAt = session.createdAt || new Date().toISOString();
    store.sessions.unshift(session);
    saveStore(store);
    pushSessionToServer(session);
    return session;
  }

  function getSessions() {
    return loadStore().sessions;
  }

  function serverKeyForSession(s) {
    if (!s) return null;
    if (s.serverId != null && String(s.serverId).trim() !== '') {
      return 's' + String(s.serverId);
    }
    if (s.id && /^w-\d+$/.test(String(s.id))) {
      return 's' + String(s.id).slice(2);
    }
    return null;
  }

  /**
   * Merge server workouts with local rows so client-only fields (e.g. photos) are kept.
   */
  function mergeSessionsWithServer(localSessions, serverRows) {
    var localList = Array.isArray(localSessions) ? localSessions.slice() : [];
    var rows = Array.isArray(serverRows) ? serverRows : [];
    var localByServerKey = new Map();
    localList.forEach(function (s) {
      var k = serverKeyForSession(s);
      if (k) localByServerKey.set(k, s);
    });

    var merged = rows.map(function (row) {
      var k = serverKeyForSession(row);
      var local = k ? localByServerKey.get(k) : null;
      if (local && Array.isArray(local.photos) && local.photos.length) {
        var out = {};
        for (var p in row) {
          if (Object.prototype.hasOwnProperty.call(row, p)) {
            out[p] = row[p];
          }
        }
        out.photos = local.photos;
        return out;
      }
      return row;
    });

    var seenServerKeys = new Set();
    merged.forEach(function (r) {
      var k = serverKeyForSession(r);
      if (k) seenServerKeys.add(k);
    });

    localList.forEach(function (s) {
      var k = serverKeyForSession(s);
      if (k && seenServerKeys.has(k)) return;
      merged.push(s);
    });

    merged.sort(function (a, b) {
      var ta = a && a.createdAt ? Date.parse(a.createdAt) : 0;
      var tb = b && b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    return merged;
  }

  /**
   * Replace local cache with server list when logged in. Calls callback(ok).
   */
  function syncFromServer(callback) {
    migrateLegacy();
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      if (!u || u.id == null || !window.apiGet) {
        if (callback) callback(false);
        return;
      }
      var prior = loadStore().sessions;
      window
        .apiGet('/users/' + u.id + '/workouts')
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          return res.json();
        })
        .then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('bad body');
          saveStore({ sessions: mergeSessionsWithServer(prior, rows) });
          if (callback) callback(true);
        })
        .catch(function () {
          if (callback) callback(false);
        });
    } catch (e) {
      if (callback) callback(false);
    }
  }

  /** Call after login/logout so the next read uses the right namespace. */
  function invalidateCache() {}

  window.WorkoutLog = {
    STORAGE_BASE: STORAGE_BASE,
    loadStore: loadStore,
    saveStore: saveStore,
    intensityLabel: intensityLabel,
    updateSession: updateSession,
    addSession: addSession,
    getSessions: getSessions,
    syncFromServer: syncFromServer,
    invalidateCache: invalidateCache,
    _storageKey: storageKey
  };
})();
