(function () {
  var STORAGE_BASE = 'strongman_prs_v1';
  var LEGACY_KEY = 'strongman_prs_v1';

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
      if (!raw) return { records: [] };
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.records)) return { records: [] };
      return data;
    } catch (e) {
      return { records: [] };
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(store));
    } catch (e) {}
  }

  function disciplineLabel(d) {
    if (d === 'running') return 'Running';
    if (d === 'swimming') return 'Swimming';
    if (d === 'weightlifting') return 'Weightlifting';
    return 'PR';
  }

  function pushRecordToServer(record) {
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      if (!u || u.id == null || !window.apiPost) return;
      var clientId = record.id;
      window
        .apiPost('/users/' + u.id + '/prs', { payload: record })
        .then(function (res) {
          if (!res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (!data || data.serverId == null) return;
          var store = loadStore();
          var idx = store.records.findIndex(function (r) {
            return r.id === clientId;
          });
          if (idx !== -1) {
            store.records[idx] = data;
            saveStore(store);
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  function addRecord(record) {
    var store = loadStore();
    record.id =
      record.id || 'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    record.createdAt = record.createdAt || new Date().toISOString();
    store.records.unshift(record);
    saveStore(store);
    pushRecordToServer(record);
    return record;
  }

  function getRecords() {
    return loadStore().records;
  }

  function syncFromServer(callback) {
    migrateLegacy();
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      if (!u || u.id == null || !window.apiGet) {
        if (callback) callback(false);
        return;
      }
      window
        .apiGet('/users/' + u.id + '/prs')
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          return res.json();
        })
        .then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('bad body');
          saveStore({ records: rows });
          if (callback) callback(true);
        })
        .catch(function () {
          if (callback) callback(false);
        });
    } catch (e) {
      if (callback) callback(false);
    }
  }

  window.PRLog = {
    STORAGE_BASE: STORAGE_BASE,
    loadStore: loadStore,
    saveStore: saveStore,
    addRecord: addRecord,
    getRecords: getRecords,
    disciplineLabel: disciplineLabel,
    syncFromServer: syncFromServer
  };
})();
