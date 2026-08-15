/**
 * IndexedDB storage for workout history and lightweight user stats snapshots.
 * Secrets stay on the server — only user-owned training data is cached here.
 */
(function () {
  'use strict';

  var DB_NAME = 'strongman_offline_v1';
  var DB_VERSION = 1;
  var STORE_WORKOUTS = 'workouts';
  var STORE_SNAPSHOTS = 'snapshots';

  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () {
        reject(req.error);
      };
      req.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_WORKOUTS)) {
          db.createObjectStore(STORE_WORKOUTS);
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS);
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
    }).catch(function () {
      return null;
    });
    return dbPromise;
  }

  function userKey(userId) {
    return userId == null ? 'guest' : String(userId);
  }

  function txStore(storeName, mode) {
    return openDb().then(function (db) {
      if (!db) return null;
      return db.transaction(storeName, mode).objectStore(storeName);
    });
  }

  function get(storeName, key) {
    return txStore(storeName, 'readonly').then(function (store) {
      if (!store) return null;
      return new Promise(function (resolve) {
        var req = store.get(key);
        req.onsuccess = function () {
          resolve(req.result == null ? null : req.result);
        };
        req.onerror = function () {
          resolve(null);
        };
      });
    });
  }

  function put(storeName, key, value) {
    return txStore(storeName, 'readwrite').then(function (store) {
      if (!store) return false;
      return new Promise(function (resolve) {
        var req = store.put(value, key);
        req.onsuccess = function () {
          resolve(true);
        };
        req.onerror = function () {
          resolve(false);
        };
      });
    });
  }

  function getWorkouts(userId) {
    return get(STORE_WORKOUTS, userKey(userId));
  }

  function putWorkouts(userId, store) {
    if (!store || typeof store !== 'object') return Promise.resolve(false);
    return put(STORE_WORKOUTS, userKey(userId), {
      sessions: Array.isArray(store.sessions) ? store.sessions : [],
      updatedAt: new Date().toISOString(),
    });
  }

  function getSnapshot(userId) {
    return get(STORE_SNAPSHOTS, userKey(userId));
  }

  function putSnapshot(userId, snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return Promise.resolve(false);
    return put(STORE_SNAPSHOTS, userKey(userId), Object.assign({}, snapshot, {
      updatedAt: new Date().toISOString(),
    }));
  }

  function migrateWorkoutsFromLocalStorage(userId, lsKey) {
    if (!lsKey) return Promise.resolve(false);
    try {
      var raw = localStorage.getItem(lsKey);
      if (!raw) return Promise.resolve(false);
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sessions) || !parsed.sessions.length) {
        return Promise.resolve(false);
      }
      return getWorkouts(userId).then(function (existing) {
        if (existing && existing.sessions && existing.sessions.length) return false;
        return putWorkouts(userId, parsed).then(function (ok) {
          return !!ok;
        });
      });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  window.OfflineDB = {
    ready: openDb,
    getWorkouts: getWorkouts,
    putWorkouts: putWorkouts,
    getSnapshot: getSnapshot,
    putSnapshot: putSnapshot,
    migrateWorkoutsFromLocalStorage: migrateWorkoutsFromLocalStorage,
  };
})();
