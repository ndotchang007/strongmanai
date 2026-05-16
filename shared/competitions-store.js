/**
 * Per-user competitions (local device). Used by Leaderboard + Create check-in.
 */
(function () {
  var KEY = 'strongman_competitions_v1';

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

  function list(uid) {
    if (uid == null) return [];
    var all = readAll();
    var k = String(uid);
    return Array.isArray(all[k]) ? all[k].slice() : [];
  }

  function saveList(uid, arr) {
    var all = readAll();
    all[String(uid)] = arr;
    writeAll(all);
  }

  function normalizeComp(c) {
    if (!c || typeof c !== 'object') return null;
    var out = Object.assign({}, c);
    out.id = out.id || 'c' + Date.now() + Math.random().toString(36).slice(2, 8);
    out.status = out.status === 'finished' ? 'finished' : 'ongoing';
    out.goalTitle = String(out.goalTitle || 'Competition goal').trim();
    out.opponentName = String(out.opponentName || 'Opponent').trim();
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
    var pct = out.progressSelfPct;
    var goal = out.weightGoalLb;
    out.weightCurrentLb = Math.round((pct / 100) * goal * 10) / 10;
    return out;
  }

  function add(uid, comp) {
    var arr = list(uid);
    var n = normalizeComp(comp);
    if (!n) return null;
    arr.push(n);
    saveList(uid, arr);
    return n;
  }

  function update(uid, id, patch) {
    var arr = list(uid);
    var i = arr.findIndex(function (c) {
      return c.id === id;
    });
    if (i < 0) return null;
    var merged = normalizeComp(Object.assign({}, arr[i], patch));
    if (!merged) return null;
    arr[i] = merged;
    saveList(uid, arr);
    return merged;
  }

  function remove(uid, id) {
    var arr = list(uid).filter(function (c) {
      return c.id !== id;
    });
    saveList(uid, arr);
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
})();
