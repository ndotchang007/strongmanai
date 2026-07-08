/**
 * Competitions — API-backed with local cache fallback.
 */
(function () {
  var KEY = 'strongman_competitions_v1';
  var memCache = {};
  var syncInflight = {};

  function readAll() {
    try {
      var raw = localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : {};
      return o && typeof o === 'object' ? o : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function cacheKey(uid) {
    return String(uid);
  }

  function readLocal(uid) {
    var all = readAll();
    var k = cacheKey(uid);
    return Array.isArray(all[k]) ? all[k].slice() : [];
  }

  function saveLocal(uid, arr) {
    var all = readAll();
    all[cacheKey(uid)] = arr;
    writeAll(all);
    memCache[cacheKey(uid)] = arr.slice();
  }

  function list(uid) {
    if (uid == null) return [];
    var k = cacheKey(uid);
    if (Array.isArray(memCache[k])) return memCache[k].slice();
    var local = readLocal(uid);
    memCache[k] = local;
    return local.slice();
  }

  function normalizeComp(c) {
    if (!c || typeof c !== 'object') return null;
    var out = Object.assign({}, c);
    out.id = out.id != null ? String(out.id) : 'c' + Date.now() + Math.random().toString(36).slice(2, 8);
    out.status = out.status === 'finished' ? 'finished' : 'ongoing';
    out.goalTitle = String(out.goalTitle || 'Competition goal').trim();
    out.opponentName = String(out.opponentName || 'Opponent').trim();
    if (out.opponentUserId != null) out.opponentUserId = Number(out.opponentUserId);
    out.weightGoalLb = Math.max(0, Number(out.weightGoalLb) || 0);
    out.progressSelfPct = Math.max(0, Math.min(100, Number(out.progressSelfPct) || 0));
    if (out.opponentProgressPct != null && out.opponentProgressPct !== '') {
      var op = Number(out.opponentProgressPct);
      out.opponentProgressPct = Number.isFinite(op) ? Math.max(0, Math.min(100, op)) : null;
    } else {
      out.opponentProgressPct = null;
    }
    out.winsSelf = Math.max(0, Number(out.winsSelf) || 0);
    out.winsOpp = Math.max(0, Number(out.winsOpp) || 0);
    out.startDate = String(out.startDate || '').trim();
    out.endDate = String(out.endDate || '').trim();
    out.quote = out.quote != null ? String(out.quote).trim() : '';
    out.quoteAuthor = out.quoteAuthor != null ? String(out.quoteAuthor).trim() : '';
    out.lastReportNote = out.lastReportNote != null ? String(out.lastReportNote).trim() : '';
    out.lastReportAt = out.lastReportAt != null ? String(out.lastReportAt).trim() : '';
    out.isCreator = out.isCreator === true;
    out.invitePending = out.invitePending === true;
    var pct = out.progressSelfPct;
    var goal = out.weightGoalLb;
    out.weightCurrentLb = Math.round((pct / 100) * goal * 10) / 10;
    return out;
  }

  function dispatchUpdated() {
    try {
      window.dispatchEvent(new CustomEvent('strongman:competitions-updated'));
    } catch (e) {}
  }

  function canSync() {
    return !!(window.isLoggedIn && window.isLoggedIn() && window.apiGet);
  }

  function syncFromApi(uid) {
    if (uid == null) return Promise.resolve([]);
    if (!canSync()) return Promise.resolve(list(uid));
    var k = cacheKey(uid);
    if (syncInflight[k]) return syncInflight[k];
    syncInflight[k] = window
      .apiGet('/competitions')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (rows) {
        var arr = (Array.isArray(rows) ? rows : [])
          .map(normalizeComp)
          .filter(Boolean);
        saveLocal(uid, arr);
        return arr;
      })
      .catch(function () {
        return list(uid);
      })
      .then(function (arr) {
        delete syncInflight[k];
        return arr;
      });
    return syncInflight[k];
  }

  function add(uid, comp) {
    if (!canSync()) {
      var arr = list(uid);
      var n = normalizeComp(comp);
      if (!n) return Promise.resolve(null);
      arr.push(n);
      saveLocal(uid, arr);
      dispatchUpdated();
      return Promise.resolve(n);
    }
    return window
      .apiPost('/competitions', comp)
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var err = new Error((body && body.error) || 'Could not create competition.');
            err.body = body;
            throw err;
          }
          return body;
        });
      })
      .then(function (created) {
        var n = normalizeComp(created);
        return syncFromApi(uid).then(function () {
          dispatchUpdated();
          if (window.NotificationBell && window.NotificationBell.refresh) {
            window.NotificationBell.refresh();
          }
          return n;
        });
      });
  }

  function update(uid, id, patch) {
    if (!canSync()) {
      var arr = list(uid);
      var i = arr.findIndex(function (c) {
        return String(c.id) === String(id);
      });
      if (i < 0) return Promise.resolve(null);
      var merged = normalizeComp(Object.assign({}, arr[i], patch));
      if (!merged) return Promise.resolve(null);
      arr[i] = merged;
      saveLocal(uid, arr);
      dispatchUpdated();
      return Promise.resolve(merged);
    }
    if (patch && patch.status === 'finished') {
      return window
        .apiPost('/competitions/' + encodeURIComponent(String(id)) + '/finish', {})
        .then(function (res) {
          if (!res.ok) throw new Error('finish failed');
          return syncFromApi(uid);
        })
        .then(function () {
          dispatchUpdated();
          return list(uid).find(function (c) {
            return String(c.id) === String(id);
          }) || null;
        });
    }
    return window
      .apiPut('/competitions/' + encodeURIComponent(String(id)) + '/progress', {
        progressPct: patch.progressSelfPct,
        note: patch.lastReportNote
      })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || 'Update failed');
          return body;
        });
      })
      .then(function (updated) {
        var n = normalizeComp(updated);
        var arr = list(uid);
        var idx = arr.findIndex(function (c) {
          return String(c.id) === String(id);
        });
        if (idx >= 0 && n) {
          arr[idx] = n;
          saveLocal(uid, arr);
        } else {
          return syncFromApi(uid).then(function () {
            return list(uid).find(function (c) {
              return String(c.id) === String(id);
            }) || n;
          });
        }
        dispatchUpdated();
        return n;
      });
  }

  function remove(uid, id) {
    if (!canSync()) {
      var arr = list(uid).filter(function (c) {
        return String(c.id) !== String(id);
      });
      saveLocal(uid, arr);
      dispatchUpdated();
      return Promise.resolve(true);
    }
    return window
      .apiDelete('/competitions/' + encodeURIComponent(String(id)))
      .then(function (res) {
        if (!res.ok) throw new Error('delete failed');
        return syncFromApi(uid);
      })
      .then(function () {
        dispatchUpdated();
        return true;
      });
  }

  function ongoing(uid) {
    return list(uid).filter(function (c) {
      return c.status === 'ongoing';
    });
  }

  function finished(uid) {
    return list(uid).filter(function (c) {
      return c.status === 'finished';
    });
  }

  window.competitionsStoreList = list;
  window.competitionsStoreAdd = add;
  window.competitionsStoreUpdate = update;
  window.competitionsStoreRemove = remove;
  window.competitionsStoreOngoing = ongoing;
  window.competitionsStoreFinished = finished;
  window.competitionsStoreNormalize = normalizeComp;
  window.competitionsStoreSync = syncFromApi;

  function bootSync() {
    var u = window.getCurrentUser && window.getCurrentUser();
    if (u && u.id != null && canSync()) {
      syncFromApi(Number(u.id));
    }
  }

  window.addEventListener('strongman:user-updated', bootSync);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSync);
  } else {
    bootSync();
  }
})();
