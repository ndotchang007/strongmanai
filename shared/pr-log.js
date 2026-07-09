/**
 * Personal records — database-backed with local cache for offline/fast reads.
 */
(function () {
  var STORAGE_BASE = 'strongman_prs_v1';
  var LEGACY_KEY = 'strongman_prs_v1';
  var syncInflight = null;

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
      var targetData = targetRaw ? JSON.parse(targetRaw) : { records: [] };
      var merged = mergeRecordsWithServer(
        (targetData.records || []).concat((guestData && guestData.records) || []),
        []
      );
      localStorage.setItem(targetKey, JSON.stringify({ records: merged }));
      localStorage.removeItem(guestKey);
    } catch (e) {}
  }

  function onUserChanged(userId) {
    if (userId == null) return;
    migrateGuestToUser(userId);
    migrateLegacy();
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

  function ensureClientId(record) {
    if (!record) return record;
    if (!record.id) {
      record.id = 'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }
    record.clientId = record.clientId || record.id;
    return record;
  }

  function serverKeyForRecord(r) {
    if (!r) return null;
    if (r.serverId != null && String(r.serverId).trim() !== '') {
      return 's' + String(r.serverId);
    }
    if (r.id && /^pr-\d+$/.test(String(r.id))) {
      return 's' + String(r.id).slice(3);
    }
    return null;
  }

  function clientKeyForRecord(r) {
    if (!r) return null;
    var cid = r.clientId || r.id;
    if (!cid || /^pr-\d+$/.test(String(cid))) return null;
    return 'c' + String(cid);
  }

  function replaceRecordInStore(clientId, serverRow) {
    var store = loadStore();
    var idx = store.records.findIndex(function (r) {
      return (
        r &&
        (r.id === clientId ||
          r.clientId === clientId ||
          (serverRow.serverId != null && r.serverId === serverRow.serverId))
      );
    });
    if (idx !== -1) {
      store.records[idx] = serverRow;
    } else {
      store.records.unshift(serverRow);
    }
    saveStore(store);
    return serverRow;
  }

  function pushRecordToServerAsync(record) {
    return new Promise(function (resolve) {
      try {
        var u = window.getCurrentUser && window.getCurrentUser();
        if (!u || u.id == null || !window.apiPost) {
          resolve(false);
          return;
        }
        record = ensureClientId(record);
        var clientId = record.clientId;
        window
          .apiPost('/users/' + u.id + '/prs', {
            clientId: clientId,
            payload: record,
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
            replaceRecordInStore(clientId, data);
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

  function pushRecordToServer(record) {
    pushRecordToServerAsync(record);
  }

  function pushPendingToServer() {
    if (!canSync()) return Promise.resolve(0);
    var pending = loadStore().records.filter(function (r) {
      return r && r.serverId == null;
    });
    if (!pending.length) return Promise.resolve(0);
    return pending
      .reduce(function (chain, record) {
        return chain.then(function (count) {
          return pushRecordToServerAsync(record).then(function (ok) {
            return count + (ok ? 1 : 0);
          });
        });
      }, Promise.resolve(0));
  }

  function enrichTimedRecord(record) {
    if (
      window.TimedEventFields &&
      typeof window.TimedEventFields.enrichRecord === 'function'
    ) {
      return window.TimedEventFields.enrichRecord(record);
    }
    return record;
  }

  function addRecord(record) {
    record = ensureClientId(enrichTimedRecord(record));
    record.createdAt = record.createdAt || new Date().toISOString();
    var store = loadStore();
    store.records.unshift(record);
    saveStore(store);
    pushRecordToServer(record);
    return record;
  }

  function getRecords() {
    return loadStore().records;
  }

  function mergeRecordsWithServer(localRecords, serverRows) {
    var localList = Array.isArray(localRecords) ? localRecords.slice() : [];
    var rows = Array.isArray(serverRows) ? serverRows : [];
    var localByServerKey = new Map();
    var localByClientKey = new Map();
    localList.forEach(function (r) {
      var sk = serverKeyForRecord(r);
      if (sk) localByServerKey.set(sk, r);
      var ck = clientKeyForRecord(r);
      if (ck) localByClientKey.set(ck, r);
    });

    var merged = rows.map(function (row) {
      return row;
    });

    var seenServerKeys = new Set();
    var seenClientKeys = new Set();
    merged.forEach(function (r) {
      var sk = serverKeyForRecord(r);
      if (sk) seenServerKeys.add(sk);
      var ck = clientKeyForRecord(r);
      if (ck) seenClientKeys.add(ck);
    });

    localList.forEach(function (r) {
      var sk = serverKeyForRecord(r);
      var ck = clientKeyForRecord(r);
      if ((sk && seenServerKeys.has(sk)) || (ck && seenClientKeys.has(ck))) return;
      merged.push(r);
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
        var prior = loadStore().records;
        window
          .apiGet('/users/' + u.id + '/prs')
          .then(function (res) {
            if (!res.ok) throw new Error('bad status');
            return res.json();
          })
          .then(function (rows) {
            if (!Array.isArray(rows)) throw new Error('bad body');
            saveStore({ records: mergeRecordsWithServer(prior, rows) });
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

  window.PRLog = {
    STORAGE_BASE: STORAGE_BASE,
    loadStore: loadStore,
    saveStore: saveStore,
    addRecord: addRecord,
    getRecords: getRecords,
    disciplineLabel: disciplineLabel,
    syncFromServer: syncFromServer,
    syncFromServerAsync: syncFromServerAsync,
    pushPendingToServer: pushPendingToServer,
    onUserChanged: onUserChanged,
  };
})();
