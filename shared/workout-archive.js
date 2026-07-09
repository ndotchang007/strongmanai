(function () {
  var STORAGE_BASE = 'strongman_workout_archive_v1';

  var syncInflight = null;
  var pushTimer = null;

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
    return !!(
      window.isLoggedIn &&
      window.isLoggedIn() &&
      window.getCurrentUser &&
      window.apiGet &&
      window.apiPut
    );
  }

  function defaultStore() {
    return { templates: [], updatedAt: null, _syncPending: false };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return defaultStore();
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.templates)) return defaultStore();
      return data;
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore(store, opts) {
    opts = opts || {};
    try {
      if (!opts.skipTouch) store.updatedAt = new Date().toISOString();
      if (!opts.skipSyncFlag) store._syncPending = true;
      localStorage.setItem(storageKey(), JSON.stringify(store));
      if (!opts.skipPush) schedulePushToServer();
    } catch (e) {}
  }

  function stripSyncMeta(store) {
    return {
      templates: Array.isArray(store.templates) ? store.templates : [],
      updatedAt: store.updatedAt || null,
    };
  }

  function storeTimestamp(store) {
    if (!store) return 0;
    var t = store.updatedAt || store.serverUpdatedAt;
    if (!t) return 0;
    var ms = Date.parse(t);
    return isNaN(ms) ? 0 : ms;
  }

  function applyFromServer(store) {
    if (!store || typeof store !== 'object') return;
    var next = {
      templates: Array.isArray(store.templates) ? store.templates : [],
      updatedAt: store.updatedAt || store.serverUpdatedAt || new Date().toISOString(),
      serverUpdatedAt: store.serverUpdatedAt || store.updatedAt || null,
      _syncPending: false,
    };
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next));
    } catch (e) {}
  }

  function load() {
    return loadStore();
  }

  function save(data, opts) {
    saveStore(data, opts);
  }

  function list() {
    return loadStore().templates.slice();
  }

  function add(entry) {
    var body = (entry && entry.bodyText) || '';
    body = String(body).trim();
    if (!body) return null;
    var store = loadStore();
    var name = (entry && entry.name && String(entry.name).trim()) || 'Saved workout';
    var item = {
      id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
      name: name.slice(0, 120),
      bodyText: body.slice(0, 32000),
      source: entry && entry.source ? String(entry.source).slice(0, 32) : 'manual',
      createdAt: new Date().toISOString(),
    };
    store.templates.unshift(item);
    saveStore(store);
    return item;
  }

  function remove(id) {
    var store = loadStore();
    store.templates = store.templates.filter(function (t) {
      return t && t.id !== id;
    });
    saveStore(store);
  }

  function pushToServerAsync(store) {
    if (!canSync()) return Promise.resolve(false);
    store = store || loadStore();
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(false);
    var payload = stripSyncMeta(store);
    return window
      .apiPut('/users/' + u.id + '/workout-templates', { payload: payload })
      .then(function (res) {
        if (!res.ok) return false;
        return res.json();
      })
      .then(function (saved) {
        if (!saved) return false;
        applyFromServer(saved);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function pullFromServerAsync() {
    if (!canSync()) return Promise.resolve(null);
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(null);
    return window
      .apiGet('/users/' + u.id + '/workout-templates')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (body) {
        return body && typeof body === 'object' ? body : null;
      })
      .catch(function () {
        return null;
      });
  }

  function schedulePushToServer() {
    if (!canSync()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushToServerAsync();
    }, 600);
  }

  function hasTemplates() {
    try {
      return !!localStorage.getItem(storageKey());
    } catch (e) {
      return false;
    }
  }

  function syncFromServerAsync() {
    if (!canSync()) return Promise.resolve(false);
    if (syncInflight) return syncInflight;
    syncInflight = pullFromServerAsync()
      .then(function (serverStore) {
        var localConfigured = hasTemplates();
        var localStore = localConfigured ? loadStore() : null;
        if (!serverStore && localConfigured && localStore) {
          return pushToServerAsync(localStore);
        }
        if (serverStore && !localConfigured) {
          applyFromServer(serverStore);
          return true;
        }
        if (serverStore && localStore) {
          var localTs = storeTimestamp(localStore);
          var serverTs = storeTimestamp(serverStore);
          if (localStore._syncPending || localTs > serverTs) {
            return pushToServerAsync(localStore);
          }
          if (serverTs > localTs) {
            applyFromServer(serverStore);
            return true;
          }
          if (localStore._syncPending) return pushToServerAsync(localStore);
          return true;
        }
        return true;
      })
      .then(function (ok) {
        syncInflight = null;
        return !!ok;
      })
      .catch(function () {
        syncInflight = null;
        return false;
      });
    return syncInflight;
  }

  function onUserChanged() {
    if (canSync()) syncFromServerAsync();
  }

  window.WorkoutArchive = {
    list: list,
    add: add,
    remove: remove,
    syncFromServerAsync: syncFromServerAsync,
    onUserChanged: onUserChanged,
    _storageKey: storageKey,
  };
})();
