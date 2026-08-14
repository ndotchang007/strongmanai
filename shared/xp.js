/**
 * Equal XP for everyone — flat awards, no weight/skill scaling.
 * Events are keyed so the same workout/PR is never double-counted.
 */
(function () {
  var STORE_KEY = 'strongman_xp_v1';

  /** Flat awards — same for every athlete. */
  var AWARDS = {
    workout: 100, // log a finished session
    newExercise: 40, // first time logging an exercise name
    pr: 75, // log a personal record
    badge: 25, // unlock an achievement
  };

  function userId() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    return u && u.id != null ? String(u.id) : 'guest';
  }

  function storageKey() {
    return STORE_KEY + '_u' + userId();
  }

  function emptyState() {
    return { totalXp: 0, events: {}, seenExercises: {}, updatedAt: null };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return emptyState();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return emptyState();
      return {
        totalXp: Math.max(0, Number(parsed.totalXp) || 0),
        events: parsed.events && typeof parsed.events === 'object' ? parsed.events : {},
        seenExercises:
          parsed.seenExercises && typeof parsed.seenExercises === 'object'
            ? parsed.seenExercises
            : {},
        updatedAt: parsed.updatedAt || null,
      };
    } catch (e) {
      return emptyState();
    }
  }

  function saveState(state) {
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(storageKey(), JSON.stringify(state));
    } catch (e) {}
  }

  function normalizeExerciseName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function sessionKey(session) {
    if (!session) return null;
    var id = session.clientId || session.id || session.serverId;
    return id != null ? 'workout:' + String(id) : null;
  }

  function prKey(record) {
    if (!record) return null;
    var id = record.clientId || record.id || record.serverId;
    return id != null ? 'pr:' + String(id) : null;
  }

  function badgeKey(id) {
    return id != null ? 'badge:' + String(id) : null;
  }

  function exerciseNamesFromSession(session) {
    var names = [];
    function push(ex) {
      var n = normalizeExerciseName(ex && ex.name);
      if (n) names.push(n);
    }
    if (!session) return names;
    (session.exercises || []).forEach(push);
    (session.lifts || []).forEach(push);
    (session.blocks || []).forEach(function (blk) {
      (blk && blk.exercises ? blk.exercises : []).forEach(push);
    });
    return names;
  }

  /**
   * Levels cap at 100. Curve tuned so ~1 year of training
   * (~250 workouts + PRs / new lifts / badges ≈ 29–33k XP) lands near
   * level 46–50 — the Advanced / Warpath band. Later ranks keep climbing
   * with heavier per-level costs through 100.
   */
  var MAX_LEVEL = 100;

  /** Rank titles by level band (inclusive min). */
  var RANK_TIERS = [
    { minLevel: 1, title: 'Kickoff', blurb: 'The first plates. Prove you’ll show up.' },
    { minLevel: 11, title: 'First Fire', blurb: 'Heat’s on — reps start meaning something.' },
    { minLevel: 21, title: 'Ironbound', blurb: 'Habit forged. The bar feels familiar.' },
    { minLevel: 31, title: 'Grind Engine', blurb: 'You don’t chase motivation — you manufacture it.' },
    { minLevel: 41, title: 'Warpath', blurb: 'Advanced. A year of honest work shows.' },
    { minLevel: 51, title: 'Apex Engine', blurb: 'Elite output. Recovery is a weapon too.' },
    { minLevel: 61, title: 'Relentless', blurb: 'Missed days fear you more than you fear them.' },
    { minLevel: 71, title: 'Myth Forged', blurb: 'Stories get told about sessions like yours.' },
    { minLevel: 81, title: 'Titan Class', blurb: 'Heavy metal royalty. Few climb this high.' },
    { minLevel: 91, title: 'Immortal', blurb: 'Ceiling of the board. Leave a legend.' },
  ];

  function xpNeededForLevel(level) {
    var lv = Math.max(1, Math.floor(Number(level) || 1));
    if (lv >= MAX_LEVEL) return 0;
    if (lv <= 49) return Math.round(120 + 7.5 * Math.pow(lv, 1.32));
    return Math.round(1400 + 8.5 * Math.pow(lv - 49, 1.5));
  }

  function totalXpToReachLevel(level) {
    var target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
    if (target <= 1) return 0;
    var total = 0;
    for (var L = 1; L < target; L++) total += xpNeededForLevel(L);
    return total;
  }

  function levelFromXp(totalXp) {
    var xp = Math.max(0, Number(totalXp) || 0);
    var level = 1;
    var remaining = xp;
    while (level < MAX_LEVEL) {
      var need = xpNeededForLevel(level);
      if (remaining < need) break;
      remaining -= need;
      level += 1;
    }
    var needForNext = level >= MAX_LEVEL ? 0 : xpNeededForLevel(level);
    var intoLevel = level >= MAX_LEVEL ? 0 : remaining;
    return {
      level: level,
      totalXp: xp,
      intoLevel: intoLevel,
      needForNext: needForNext,
      progress:
        level >= MAX_LEVEL
          ? 1
          : needForNext > 0
            ? Math.max(0, Math.min(1, intoLevel / needForNext))
            : 0,
      maxed: level >= MAX_LEVEL,
    };
  }

  function rankTier() {
    return RANK_TIERS.slice();
  }

  function rankForLevel(level) {
    var lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
    var current = RANK_TIERS[0];
    var next = null;
    for (var i = 0; i < RANK_TIERS.length; i++) {
      if (lv >= RANK_TIERS[i].minLevel) current = RANK_TIERS[i];
      else {
        next = RANK_TIERS[i];
        break;
      }
    }
    var levelsToNext = next ? Math.max(0, next.minLevel - lv) : 0;
    return {
      title: current.title,
      blurb: current.blurb,
      minLevel: current.minLevel,
      nextTitle: next ? next.title : null,
      nextMinLevel: next ? next.minLevel : null,
      nextBlurb: next ? next.blurb : null,
      levelsToNext: levelsToNext,
      maxed: !next || lv >= MAX_LEVEL,
    };
  }

  function rankForXp(totalXp) {
    var levelInfo = levelFromXp(totalXp);
    var rank = rankForLevel(levelInfo.level);
    return Object.assign({}, levelInfo, rank);
  }

  function awardEvent(state, key, amount, meta) {
    if (!key || !amount || state.events[key]) return 0;
    state.events[key] = {
      amount: amount,
      at: new Date().toISOString(),
      reason: (meta && meta.reason) || null,
    };
    state.totalXp += amount;
    return amount;
  }

  function awardSession(session, opts) {
    opts = opts || {};
    var state = loadState();
    var gained = 0;
    var key = sessionKey(session);
    gained += awardEvent(state, key, AWARDS.workout, { reason: 'workout' });

    exerciseNamesFromSession(session).forEach(function (name) {
      if (state.seenExercises[name]) return;
      state.seenExercises[name] = true;
      var ek = key ? key + ':ex:' + name : 'ex:' + name + ':' + Date.now();
      gained += awardEvent(state, ek, AWARDS.newExercise, { reason: 'newExercise' });
    });

    if (gained > 0 || opts.forceSave) saveState(state);
    if (gained > 0 && !opts.silent) {
      emitUpdate(state, gained);
      syncToServer(state);
    }
    return { gained: gained, state: state, level: levelFromXp(state.totalXp) };
  }

  function awardPr(record, opts) {
    opts = opts || {};
    var state = loadState();
    var gained = awardEvent(state, prKey(record), AWARDS.pr, { reason: 'pr' });
    if (gained > 0 || opts.forceSave) saveState(state);
    if (gained > 0 && !opts.silent) {
      emitUpdate(state, gained);
      syncToServer(state);
    }
    return { gained: gained, state: state, level: levelFromXp(state.totalXp) };
  }

  function awardBadge(achievementId, opts) {
    opts = opts || {};
    var state = loadState();
    var gained = awardEvent(state, badgeKey(achievementId), AWARDS.badge, {
      reason: 'badge',
    });
    if (gained > 0 || opts.forceSave) saveState(state);
    if (gained > 0 && !opts.silent) {
      emitUpdate(state, gained);
      syncToServer(state);
    }
    return { gained: gained, state: state, level: levelFromXp(state.totalXp) };
  }

  function recomputeFromHistory(opts) {
    opts = opts || {};
    var state = loadState();
    var before = state.totalXp;

    if (window.WorkoutLog && typeof window.WorkoutLog.getSessions === 'function') {
      (window.WorkoutLog.getSessions() || []).forEach(function (s) {
        if (!s) return;
        var key = sessionKey(s);
        awardEvent(state, key, AWARDS.workout, { reason: 'workout' });
        exerciseNamesFromSession(s).forEach(function (name) {
          if (!state.seenExercises[name]) {
            state.seenExercises[name] = true;
            awardEvent(state, (key || 'hist') + ':ex:' + name, AWARDS.newExercise, {
              reason: 'newExercise',
            });
          }
        });
      });
    }

    if (window.PRLog && typeof window.PRLog.getRecords === 'function') {
      (window.PRLog.getRecords() || []).forEach(function (pr) {
        awardEvent(state, prKey(pr), AWARDS.pr, { reason: 'pr' });
      });
    }

    saveState(state);
    var gained = Math.max(0, state.totalXp - before);
    if (!opts.silent) emitUpdate(state, gained);
    if (opts.sync !== false) syncToServer(state);
    return { gained: gained, state: state, level: levelFromXp(state.totalXp) };
  }

  function getSnapshot() {
    var state = loadState();
    var level = levelFromXp(state.totalXp);
    var rank = rankForLevel(level.level);
    return {
      totalXp: state.totalXp,
      level: level,
      rank: rank,
      awards: AWARDS,
      maxLevel: MAX_LEVEL,
    };
  }

  function formatXp(n) {
    var v = Math.max(0, Math.round(Number(n) || 0));
    if (v >= 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(v);
  }

  function emitUpdate(state, gained) {
    try {
      document.dispatchEvent(
        new CustomEvent('strongman:xp-updated', {
          detail: {
            totalXp: state.totalXp,
            gained: gained || 0,
            level: levelFromXp(state.totalXp),
          },
        })
      );
    } catch (e) {}
  }

  var syncTimer = null;
  function syncToServer(state) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || u.id == null || typeof window.apiPut !== 'function') return;
    var total = state ? state.totalXp : loadState().totalXp;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      window
        .apiPut('/users/' + u.id + '/xp', { totalXp: total })
        .then(function (res) {
          if (!res || !res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (!data || data.totalXp == null) return;
          var cur = loadState();
          var serverXp = Math.max(0, Number(data.totalXp) || 0);
          if (serverXp > cur.totalXp) {
            cur.totalXp = serverXp;
            saveState(cur);
            emitUpdate(cur, 0);
          }
        })
        .catch(function () {});
    }, 400);
  }

  function pullFromServer() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || u.id == null || typeof window.apiGet !== 'function') {
      return Promise.resolve(getSnapshot());
    }
    return window
      .apiGet('/users/' + u.id + '/xp')
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        var cur = loadState();
        if (data && data.totalXp != null) {
          var serverXp = Math.max(0, Number(data.totalXp) || 0);
          if (serverXp > cur.totalXp) {
            cur.totalXp = serverXp;
            saveState(cur);
          }
        }
        // Local history may still be ahead — push after recompute.
        var result = recomputeFromHistory({ silent: true, sync: true });
        emitUpdate(result.state, 0);
        return getSnapshot();
      })
      .catch(function () {
        recomputeFromHistory({ silent: true, sync: false });
        return getSnapshot();
      });
  }

  function applyPublicXp(totalXp) {
    var xp = Math.max(0, Number(totalXp) || 0);
    var level = levelFromXp(xp);
    return {
      totalXp: xp,
      level: level,
      rank: rankForLevel(level.level),
    };
  }

  window.StrongmanXp = {
    AWARDS: AWARDS,
    MAX_LEVEL: MAX_LEVEL,
    RANK_TIERS: RANK_TIERS,
    awardSession: awardSession,
    awardPr: awardPr,
    awardBadge: awardBadge,
    recomputeFromHistory: recomputeFromHistory,
    getSnapshot: getSnapshot,
    levelFromXp: levelFromXp,
    xpNeededForLevel: xpNeededForLevel,
    totalXpToReachLevel: totalXpToReachLevel,
    rankForLevel: rankForLevel,
    rankForXp: rankForXp,
    rankTier: rankTier,
    formatXp: formatXp,
    pullFromServer: pullFromServer,
    syncToServer: function () {
      syncToServer(loadState());
    },
    applyPublicXp: applyPublicXp,
  };
})();
