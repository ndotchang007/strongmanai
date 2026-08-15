/**
 * Workout history — database-backed with local cache for offline/fast reads.
 * Server (PostgreSQL) is the source of truth across devices.
 */
(function () {
  var STORAGE_BASE = 'strongman_workouts_v1';
  var LEGACY_KEY = 'strongman_workouts_v1';
  var syncInflight = null;
  var memoryStores = {};
  var persistTimers = {};
  var hydrateInflight = {};

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

  function canSync() {
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      return !!(u && u.id != null && u.token && window.apiGet && window.apiPost);
    } catch (e) {
      return false;
    }
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

  function migrateGuestToUser(userId) {
    if (userId == null) return;
    var targetKey = STORAGE_BASE + '_u' + userId;
    var guestKey = STORAGE_BASE + '_guest';
    try {
      var guestRaw = localStorage.getItem(guestKey);
      if (!guestRaw) return;
      var guestData = JSON.parse(guestRaw);
      var targetRaw = localStorage.getItem(targetKey);
      var targetData = targetRaw ? JSON.parse(targetRaw) : { sessions: [] };
      var merged = mergeSessionsWithServer(
        (targetData.sessions || []).concat((guestData && guestData.sessions) || []),
        []
      );
      localStorage.setItem(targetKey, JSON.stringify({ sessions: merged }));
      localStorage.removeItem(guestKey);
    } catch (e) {}
  }

  function currentUserId() {
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      return u && u.id != null ? u.id : null;
    } catch (e) {
      return null;
    }
  }

  function readLocalStorageStore() {
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

  function hydrateStoreForCurrentUser() {
    var key = storageKey();
    if (hydrateInflight[key]) return hydrateInflight[key];
    var userId = currentUserId();
    if (userId == null || !window.OfflineDB) {
      memoryStores[key] = readLocalStorageStore();
      return Promise.resolve(memoryStores[key]);
    }
    hydrateInflight[key] = window.OfflineDB.ready()
      .then(function () {
        return window.OfflineDB.getWorkouts(userId);
      })
      .then(function (idbStore) {
        if (idbStore && Array.isArray(idbStore.sessions) && idbStore.sessions.length) {
          memoryStores[key] = { sessions: idbStore.sessions.slice() };
          return memoryStores[key];
        }
        return window.OfflineDB.migrateWorkoutsFromLocalStorage(userId, storageKey()).then(function () {
          return window.OfflineDB.getWorkouts(userId);
        }).then(function (migrated) {
          if (migrated && Array.isArray(migrated.sessions) && migrated.sessions.length) {
            memoryStores[key] = { sessions: migrated.sessions.slice() };
            return memoryStores[key];
          }
          var local = readLocalStorageStore();
          memoryStores[key] = local;
          if (local.sessions.length) {
            window.OfflineDB.putWorkouts(userId, local);
          }
          return memoryStores[key];
        });
      })
      .catch(function () {
        memoryStores[key] = readLocalStorageStore();
        return memoryStores[key];
      })
      .then(function (store) {
        hydrateInflight[key] = null;
        return store;
      });
    return hydrateInflight[key];
  }

  function onUserChanged(userId) {
    if (userId == null) return;
    migrateGuestToUser(userId);
    migrateLegacy();
    var key = STORAGE_BASE + '_u' + userId;
    delete memoryStores[key];
    hydrateStoreForCurrentUser();
  }

  function loadStore() {
    var key = storageKey();
    if (memoryStores[key]) return memoryStores[key];
    memoryStores[key] = readLocalStorageStore();
    hydrateStoreForCurrentUser();
    return memoryStores[key];
  }

  function saveStore(store) {
    var key = storageKey();
    memoryStores[key] = store;
    try {
      localStorage.setItem(key, JSON.stringify(store));
    } catch (e) {}
    var userId = currentUserId();
    if (userId != null && window.OfflineDB) {
      if (persistTimers[key]) clearTimeout(persistTimers[key]);
      persistTimers[key] = setTimeout(function () {
        persistTimers[key] = null;
        window.OfflineDB.putWorkouts(userId, store);
        window.OfflineDB.putSnapshot(userId, {
          workoutCount: (store.sessions || []).length,
          lastWorkoutAt:
            store.sessions && store.sessions[0] && store.sessions[0].createdAt
              ? store.sessions[0].createdAt
              : null,
        });
      }, 120);
    }
  }

  function intensityLabel(score) {
    var n = parseInt(score, 10);
    if (isNaN(n)) return '—';
    n = Math.min(100, Math.max(0, n));
    if (n <= 33) return 'Low';
    if (n <= 66) return 'Moderate';
    return 'High';
  }

  function ensureClientId(session) {
    if (!session) return session;
    if (!session.id) {
      session.id = 'w-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }
    session.clientId = session.clientId || session.id;
    return session;
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

  function clientKeyForSession(s) {
    if (!s) return null;
    var cid = s.clientId || s.id;
    if (!cid || /^w-\d+$/.test(String(cid))) return null;
    return 'c' + String(cid);
  }

  function replaceSessionInStore(clientId, serverRow) {
    var store = loadStore();
    var idx = store.sessions.findIndex(function (s) {
      return (
        s &&
        (s.id === clientId ||
          s.clientId === clientId ||
          (serverRow.serverId != null && s.serverId === serverRow.serverId))
      );
    });
    if (idx !== -1) {
      var prevRow = store.sessions[idx];
      if (
        prevRow &&
        Array.isArray(prevRow.photos) &&
        prevRow.photos.length &&
        (!serverRow.photos || !serverRow.photos.length)
      ) {
        serverRow = Object.assign({}, serverRow, { photos: prevRow.photos });
      }
      store.sessions[idx] = serverRow;
    } else {
      store.sessions.unshift(serverRow);
    }
    saveStore(store);
    return serverRow;
  }

  function pushSessionToServerAsync(session) {
    return new Promise(function (resolve) {
      try {
        var u = window.getCurrentUser && window.getCurrentUser();
        if (!u || u.id == null || !window.apiPost) {
          resolve(false);
          return;
        }
        session = ensureClientId(session);
        var clientId = session.clientId;
        window
          .apiPost('/users/' + u.id + '/workouts', {
            clientId: clientId,
            payload: session,
          })
          .then(function (res) {
            if (!res.ok) return null;
            return res.json();
          })
          .then(function (data) {
            if (!data || data.serverId == null) {
              resolve(false);
              return;
            }
            replaceSessionInStore(clientId, data);
            resolve(true);
          })
          .catch(function () {
            resolve(false);
          });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function pushSessionUpdateToServerAsync(session) {
    return new Promise(function (resolve) {
      try {
        var u = window.getCurrentUser && window.getCurrentUser();
        if (!u || u.id == null || session.serverId == null || !window.apiPut) {
          resolve(pushSessionToServerAsync(session));
          return;
        }
        session = ensureClientId(session);
        window
          .apiPut('/users/' + u.id + '/workouts/' + session.serverId, { payload: session })
          .then(function (res) {
            if (!res.ok) return null;
            return res.json();
          })
          .then(function (data) {
            if (!data || data.serverId == null) {
              resolve(false);
              return;
            }
            replaceSessionInStore(session.clientId || session.id, data);
            resolve(true);
          })
          .catch(function () {
            resolve(false);
          });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function pushSessionToServer(session) {
    pushSessionToServerAsync(session);
  }

  function pushPendingToServer() {
    if (!canSync()) return Promise.resolve(0);
    var pending = loadStore().sessions.filter(function (s) {
      return s && s.serverId == null;
    });
    if (!pending.length) return Promise.resolve(0);
    return pending
      .reduce(function (chain, session) {
        return chain.then(function (count) {
          return pushSessionToServerAsync(session).then(function (ok) {
            return count + (ok ? 1 : 0);
          });
        });
      }, Promise.resolve(0));
  }

  function addSession(session) {
    session = ensureClientId(session);
    session.createdAt = session.createdAt || new Date().toISOString();
    var store = loadStore();
    store.sessions.unshift(session);
    saveStore(store);
    pushSessionToServer(session);
    return session;
  }

  function getSessions() {
    return loadStore().sessions;
  }

  /**
   * Mutate a session in place (e.g. attach photos) and sync to database.
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
    var updated = store.sessions[idx];
    if (updated.serverId != null) {
      pushSessionUpdateToServerAsync(updated);
    } else {
      pushSessionToServer(updated);
    }
    return true;
  }

  /**
   * Merge server workouts with local rows so client-only fields (e.g. photos) are kept.
   */
  function mergeSessionsWithServer(localSessions, serverRows) {
    var localList = Array.isArray(localSessions) ? localSessions.slice() : [];
    var rows = Array.isArray(serverRows) ? serverRows : [];
    var localByServerKey = new Map();
    var localByClientKey = new Map();
    localList.forEach(function (s) {
      var sk = serverKeyForSession(s);
      if (sk) localByServerKey.set(sk, s);
      var ck = clientKeyForSession(s);
      if (ck) localByClientKey.set(ck, s);
    });

    var merged = rows.map(function (row) {
      var sk = serverKeyForSession(row);
      var ck = clientKeyForSession(row);
      var local = (sk && localByServerKey.get(sk)) || (ck && localByClientKey.get(ck)) || null;
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
    var seenClientKeys = new Set();
    merged.forEach(function (r) {
      var sk = serverKeyForSession(r);
      if (sk) seenServerKeys.add(sk);
      var ck = clientKeyForSession(r);
      if (ck) seenClientKeys.add(ck);
    });

    localList.forEach(function (s) {
      var sk = serverKeyForSession(s);
      var ck = clientKeyForSession(s);
      if ((sk && seenServerKeys.has(sk)) || (ck && seenClientKeys.has(ck))) return;
      merged.push(s);
    });

    merged.sort(function (a, b) {
      var ta = a && a.createdAt ? Date.parse(a.createdAt) : 0;
      var tb = b && b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    return merged;
  }

  function pullFromServer() {
    return new Promise(function (resolve) {
      try {
        var u = window.getCurrentUser && window.getCurrentUser();
        if (!u || u.id == null || !window.apiGet) {
          resolve(false);
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
            resolve(true);
          })
          .catch(function () {
            resolve(false);
          });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function syncFromServerAsync() {
    if (!canSync()) return Promise.resolve(false);
    if (syncInflight) return syncInflight;
    syncInflight = pushPendingToServer()
      .then(function () {
        return pullFromServer();
      })
      .then(function (ok) {
        syncInflight = null;
        return ok;
      })
      .catch(function () {
        syncInflight = null;
        return false;
      });
    return syncInflight;
  }

  function syncFromServer(callback) {
    syncFromServerAsync().then(function (ok) {
      if (callback) callback(ok);
    });
  }

  function findSessionIndex(store, sessionId) {
    return store.sessions.findIndex(function (s) {
      return (
        s &&
        (s.id === sessionId ||
          (s.serverId != null && String(s.serverId) === String(sessionId)))
      );
    });
  }

  function replaceSession(sessionId, payload) {
    migrateLegacy();
    var store = loadStore();
    var idx = findSessionIndex(store, sessionId);
    if (idx === -1) return null;
    var prev = store.sessions[idx];
    var merged = Object.assign({}, payload, {
      id: prev.id,
      clientId: prev.clientId || prev.id,
      serverId: prev.serverId != null ? prev.serverId : payload.serverId,
      createdAt: prev.createdAt || payload.createdAt,
      photos: payload.photos != null ? payload.photos : prev.photos,
    });
    ensureClientId(merged);
    store.sessions[idx] = merged;
    saveStore(store);
    if (merged.serverId != null) {
      pushSessionUpdateToServerAsync(merged);
    } else {
      pushSessionToServerAsync(merged);
    }
    return merged;
  }

  function deleteSessionFromStore(sessionId) {
    var store = loadStore();
    var idx = findSessionIndex(store, sessionId);
    if (idx === -1) return null;
    var removed = store.sessions[idx];
    store.sessions.splice(idx, 1);
    saveStore(store);
    return removed;
  }

  function deleteSessionAsync(sessionId) {
    return new Promise(function (resolve) {
      try {
        var store = loadStore();
        var idx = findSessionIndex(store, sessionId);
        if (idx === -1) {
          resolve(false);
          return;
        }
        var session = store.sessions[idx];
        var u = window.getCurrentUser && window.getCurrentUser();
        if (session.serverId != null && u && u.id != null && window.apiDelete) {
          window
            .apiDelete('/users/' + u.id + '/workouts/' + session.serverId)
            .then(function (res) {
              if (res.status === 204 || res.ok) {
                deleteSessionFromStore(sessionId);
                resolve(true);
              } else {
                resolve(false);
              }
            })
            .catch(function () {
              resolve(false);
            });
          return;
        }
        deleteSessionFromStore(sessionId);
        resolve(true);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function deleteSession(sessionId, callback) {
    deleteSessionAsync(sessionId).then(function (ok) {
      if (callback) callback(ok);
    });
  }

  function invalidateCache() {
    var u = window.getCurrentUser && window.getCurrentUser();
    if (u && u.id != null) onUserChanged(u.id);
  }

  window.WorkoutLog = {
    STORAGE_BASE: STORAGE_BASE,
    loadStore: loadStore,
    saveStore: saveStore,
    hydrateStoreForCurrentUser: hydrateStoreForCurrentUser,
    intensityLabel: intensityLabel,
    updateSession: updateSession,
    replaceSession: replaceSession,
    deleteSession: deleteSession,
    deleteSessionAsync: deleteSessionAsync,
    addSession: addSession,
    getSessions: getSessions,
    syncFromServer: syncFromServer,
    syncFromServerAsync: syncFromServerAsync,
    pushPendingToServer: pushPendingToServer,
    onUserChanged: onUserChanged,
    invalidateCache: invalidateCache,
    _storageKey: storageKey,
  };
})();
