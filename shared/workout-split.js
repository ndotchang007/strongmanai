(function () {
  var STORAGE_KEY_BASE = 'strongmanai_workout_split_v1';
  var LEGACY_KEY = STORAGE_KEY_BASE;
  var DEFAULT_DAYS = ['PUSH', 'PULL', 'LEGS', 'REST', 'PUSH', 'PULL', 'REST'];
  var BLANK_DAYS = ['REST', 'REST', 'REST', 'REST', 'REST', 'REST', 'REST'];
  var DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function ex(name, sets, reps) {
    return { name: name, sets: String(sets), reps: String(reps), weight: '' };
  }

  function plan(title, exercises) {
    return { title: title, exercises: exercises };
  }

  /** Built-in starter splits seeded for new users. */
  function builtInPresetSplits() {
    var pplDays = ['PUSH', 'PULL', 'LEGS', 'REST', 'PUSH', 'PULL', 'REST'];
    var pplPlans = [
      plan('Push', [
        ex('Barbell bench press', 4, 6),
        ex('Overhead press', 3, 8),
        ex('Incline dumbbell press', 3, 10),
        ex('Lateral raise', 3, 12),
        ex('Tricep pushdown', 3, 12),
      ]),
      plan('Pull', [
        ex('Barbell row', 4, 6),
        ex('Lat pulldown', 3, 10),
        ex('Seated cable row', 3, 10),
        ex('Face pull', 3, 15),
        ex('Dumbbell curl', 3, 12),
      ]),
      plan('Legs', [
        ex('Back squat', 4, 6),
        ex('Romanian deadlift', 3, 8),
        ex('Leg press', 3, 10),
        ex('Walking lunge', 3, 10),
        ex('Calf raise', 3, 15),
      ]),
      null,
      plan('Push', [
        ex('Dumbbell bench press', 4, 8),
        ex('Seated dumbbell press', 3, 10),
        ex('Cable fly', 3, 12),
        ex('Lateral raise', 3, 15),
        ex('Overhead tricep extension', 3, 12),
      ]),
      plan('Pull', [
        ex('Pull-up or assisted pull-up', 4, 6),
        ex('Chest-supported row', 3, 10),
        ex('Straight-arm pulldown', 3, 12),
        ex('Rear delt fly', 3, 15),
        ex('Hammer curl', 3, 12),
      ]),
      null,
    ];

    var ulDays = ['UPPER', 'LOWER', 'REST', 'UPPER', 'LOWER', 'REST', 'ACTIVE RECOVERY'];
    var ulPlans = [
      plan('Upper', [
        ex('Bench press', 4, 6),
        ex('Barbell row', 4, 6),
        ex('Overhead press', 3, 8),
        ex('Lat pulldown', 3, 10),
        ex('Dumbbell curl', 2, 12),
        ex('Tricep pushdown', 2, 12),
      ]),
      plan('Lower', [
        ex('Squat', 4, 6),
        ex('Romanian deadlift', 3, 8),
        ex('Leg press', 3, 10),
        ex('Hamstring curl', 3, 12),
        ex('Calf raise', 3, 15),
      ]),
      null,
      plan('Upper', [
        ex('Incline press', 4, 8),
        ex('Seated row', 4, 8),
        ex('Dumbbell shoulder press', 3, 10),
        ex('Pull-up or lat pulldown', 3, 8),
        ex('Lateral raise', 3, 15),
      ]),
      plan('Lower', [
        ex('Front squat or goblet squat', 4, 8),
        ex('Hip thrust', 3, 10),
        ex('Walking lunge', 3, 10),
        ex('Leg extension', 3, 12),
        ex('Calf raise', 3, 15),
      ]),
      null,
      plan('Active recovery', [
        ex('Easy bike or walk', 1, '20–30 min'),
        ex('Mobility circuit', 2, 10),
      ]),
    ];

    var fbDays = ['FULL BODY', 'REST', 'FULL BODY', 'REST', 'FULL BODY', 'REST', 'REST'];
    var fbPlans = [
      plan('Full body A', [
        ex('Squat', 3, 8),
        ex('Bench press', 3, 8),
        ex('Barbell row', 3, 8),
        ex('Overhead press', 2, 10),
        ex('Plank', 3, '30–45s'),
      ]),
      null,
      plan('Full body B', [
        ex('Deadlift or RDL', 3, 6),
        ex('Incline press', 3, 8),
        ex('Lat pulldown', 3, 10),
        ex('Walking lunge', 3, 10),
        ex('Face pull', 3, 15),
      ]),
      null,
      plan('Full body C', [
        ex('Leg press', 3, 10),
        ex('Dumbbell press', 3, 10),
        ex('Seated row', 3, 10),
        ex('Lateral raise', 3, 12),
        ex('Curl + tricep superset', 2, 12),
      ]),
      null,
      null,
    ];

    var broDays = ['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'REST', 'REST'];
    var broPlans = [
      plan('Chest', [
        ex('Bench press', 4, 6),
        ex('Incline dumbbell press', 3, 10),
        ex('Cable fly', 3, 12),
        ex('Push-up', 2, 12),
      ]),
      plan('Back', [
        ex('Deadlift', 3, 5),
        ex('Pull-up or lat pulldown', 4, 8),
        ex('Barbell row', 3, 8),
        ex('Seated row', 3, 10),
      ]),
      plan('Shoulders', [
        ex('Overhead press', 4, 6),
        ex('Lateral raise', 4, 12),
        ex('Rear delt fly', 3, 15),
        ex('Face pull', 3, 15),
      ]),
      plan('Legs', [
        ex('Squat', 4, 6),
        ex('Romanian deadlift', 3, 8),
        ex('Leg press', 3, 10),
        ex('Leg curl', 3, 12),
        ex('Calf raise', 4, 12),
      ]),
      plan('Arms', [
        ex('Barbell curl', 3, 10),
        ex('Hammer curl', 3, 12),
        ex('Skull crusher', 3, 10),
        ex('Tricep pushdown', 3, 12),
      ]),
      null,
      null,
    ];

    return [
      defaultSplitState({
        id: 'preset_ppl',
        programName: 'Push / Pull / Legs',
        days: pplDays,
        dayPlans: pplPlans,
        source: 'preset',
      }),
      defaultSplitState({
        id: 'preset_upper_lower',
        programName: 'Upper / Lower',
        days: ulDays,
        dayPlans: ulPlans,
        source: 'preset',
      }),
      defaultSplitState({
        id: 'preset_full_body',
        programName: 'Full Body (3×)',
        days: fbDays,
        dayPlans: fbPlans,
        source: 'preset',
      }),
      defaultSplitState({
        id: 'preset_bro',
        programName: 'Bro Split',
        days: broDays,
        dayPlans: broPlans,
        source: 'preset',
      }),
    ];
  }

  function defaultLibrary() {
    var splits = builtInPresetSplits();
    return {
      version: 2,
      activeSplitId: splits[0].id,
      unseenSplitIds: [],
      seededPresets: true,
      splits: splits,
    };
  }

  function getUserId() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    return user && user.id ? String(user.id) : null;
  }

  function storageKeyForUser(userId) {
    return userId ? STORAGE_KEY_BASE + '_' + userId : STORAGE_KEY_BASE + '_anonymous';
  }

  function getStorageKey() {
    return storageKeyForUser(getUserId());
  }

  function isSplitStorageKey(key) {
    if (!key) return false;
    return key === LEGACY_KEY || key.indexOf(STORAGE_KEY_BASE + '_') === 0;
  }

  function newSplitId() {
    return 'split_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function migrateLegacyIfNeeded(key) {
    try {
      if (localStorage.getItem(key)) return;
      var legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && getUserId()) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (e) {}
  }

  function defaultSplitState(partial) {
    return Object.assign(
      {
        id: newSplitId(),
        programName: '',
        days: DEFAULT_DAYS.slice(),
        dayPlans: [null, null, null, null, null, null, null],
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      partial || {}
    );
  }

  function normalizeDays(arr) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var s = arr && arr[i] != null ? String(arr[i]).trim() : '';
      if (!s || s === '—') {
        out.push('—');
        continue;
      }
      out.push(s.toUpperCase());
    }
    return out;
  }

  function encodeSharePayload(state) {
    var days = normalizeDays(state && state.days);
    var plans = normalizeDayPlans(state && state.dayPlans, days);
    var payload = {
      v: 1,
      n: state && state.programName != null ? String(state.programName).trim() : '',
      d: days,
      p: plans.map(function (plan) {
        if (!plan || !Array.isArray(plan.exercises) || !plan.exercises.length) return null;
        return plan.exercises
          .filter(function (ex) {
            return ex && ex.name;
          })
          .map(function (ex) {
            return [ex.name, ex.sets || '3', ex.reps || '8'];
          });
      }),
    };
    try {
      var json = JSON.stringify(payload);
      return btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch (e) {
      return '';
    }
  }

  function decodeSharePayload(code) {
    if (!code) return null;
    try {
      var b64 = String(code)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = decodeURIComponent(escape(atob(b64)));
      var raw = JSON.parse(json);
      if (!raw || !Array.isArray(raw.d)) return null;
      var days = normalizeDays(raw.d);
      var dayPlans = (raw.p || []).map(function (row, i) {
        if (!row || !Array.isArray(row) || !row.length) return null;
        return {
          title: days[i] || '',
          exercises: row
            .map(function (item) {
              if (Array.isArray(item)) {
                return templateExercise({ name: item[0], sets: item[1], reps: item[2] });
              }
              if (item && typeof item === 'object') return templateExercise(item);
              return null;
            })
            .filter(Boolean),
        };
      });
      while (dayPlans.length < 7) dayPlans.push(null);
      dayPlans = dayPlans.slice(0, 7);
      return {
        programName: raw.n != null ? String(raw.n) : 'Shared split',
        days: days,
        dayPlans: dayPlans,
      };
    } catch (e) {
      return null;
    }
  }

  function importSharedSplit(codeOrState, opts) {
    opts = opts || {};
    var parsed = typeof codeOrState === 'string' ? decodeSharePayload(codeOrState) : codeOrState;
    if (!parsed) return null;
    var name = parsed.programName || 'Shared split';
    if (opts.suffix !== false && name.indexOf('(shared)') === -1) {
      name = name + ' (shared)';
    }
    return createSplit(
      name,
      {
        days: parsed.days,
        dayPlans: parsed.dayPlans,
        source: 'shared',
      },
      { activate: opts.activate !== false }
    );
  }

  function buildShareUrl(state, baseUrl) {
    var code = encodeSharePayload(state);
    if (!code) return '';
    var base = baseUrl || (typeof location !== 'undefined' ? location.origin + '/log' : '/log');
    return base.replace(/#.*$/, '') + '#split=' + code;
  }

  function formatShareText(state) {
    var s = state || load();
    var name = (s.programName && String(s.programName).trim()) || 'Weekly split';
    var lines = [name, ''];
    var letters = DAY_LETTERS;
    for (var i = 0; i < 7; i++) {
      var day = s.days[i] || '—';
      var plan = s.dayPlans && s.dayPlans[i];
      var count = plan && Array.isArray(plan.exercises) ? plan.exercises.filter(function (ex) { return ex && ex.name; }).length : 0;
      var bit = letters[i] + ' · ' + day;
      if (count) bit += ' (' + count + (count === 1 ? ' exercise' : ' exercises') + ')';
      lines.push(bit);
      if (plan && Array.isArray(plan.exercises)) {
        plan.exercises.forEach(function (ex) {
          if (!ex || !ex.name) return;
          lines.push('  - ' + ex.name + ' · ' + (ex.sets || '3') + '×' + (ex.reps || '8'));
        });
      }
    }
    var url = buildShareUrl(s);
    if (url) {
      lines.push('');
      lines.push('Import in Strongman AI:');
      lines.push(url);
    }
    return lines.join('\n');
  }

  function templateExercise(ex) {
    return {
      name: ex && ex.name != null ? String(ex.name) : '',
      sets: ex && ex.sets != null ? String(ex.sets) : '',
      reps: ex && ex.reps != null ? String(ex.reps) : '',
      weight: '',
    };
  }

  function normalizeDayPlans(plans, days) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var p = plans && plans[i];
      if (!p || typeof p !== 'object') {
        out.push(null);
        continue;
      }
      var exercises = Array.isArray(p.exercises)
        ? p.exercises.map(function (ex) {
            return templateExercise(ex);
          })
        : [];
      out.push({
        title: p.title != null ? String(p.title) : days[i] || '',
        exercises: exercises,
      });
    }
    return out;
  }

  function normalizeSplit(raw, fallbackId) {
    if (!raw || typeof raw !== 'object') return defaultSplitState();
    var days = normalizeDays(raw.days);
    var source = 'manual';
    if (raw.source === 'ai' || raw.source === 'preset' || raw.source === 'shared') {
      source = raw.source;
    }
    return {
      id: raw.id != null ? String(raw.id) : fallbackId || newSplitId(),
      programName: raw.programName != null ? String(raw.programName) : '',
      days: days,
      dayPlans: normalizeDayPlans(raw.dayPlans, days),
      source: source,
      untouched: !!raw.untouched,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    };
  }

  function migrateSingleSplitPayload(d) {
    var days = normalizeDays(d.days);
    return defaultSplitState({
      id: newSplitId(),
      programName: d.programName != null ? String(d.programName) : '',
      days: days,
      dayPlans: normalizeDayPlans(d.dayPlans, days),
      source: 'manual',
    });
  }

  function loadLibrary() {
    var key = getStorageKey();
    migrateLegacyIfNeeded(key);
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return defaultLibrary();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return defaultLibrary();

      if (Array.isArray(d.splits) && d.splits.length) {
        var splits = d.splits.map(function (s, i) {
          return normalizeSplit(s, 'split_' + i);
        });
        // Seed starter presets once for libraries that only have a blank custom split.
        if (!d.seededPresets) {
          var onlyBlank =
            splits.length === 1 &&
            !String(splits[0].programName || '').trim() &&
            !(splits[0].dayPlans || []).some(function (p) {
              return p && p.exercises && p.exercises.length;
            });
          if (onlyBlank) {
            var seeded = defaultLibrary();
            saveLibrary(seeded, { skipTouch: true, skipPush: true, skipSyncFlag: true });
            return seeded;
          }
        }
        var activeId = d.activeSplitId;
        if (!splits.some(function (s) { return s.id === activeId; })) {
          activeId = splits[0].id;
        }
        return {
          version: 2,
          activeSplitId: activeId,
          unseenSplitIds: Array.isArray(d.unseenSplitIds)
            ? d.unseenSplitIds.filter(function (id) {
                return splits.some(function (s) { return s.id === id; });
              })
            : [],
          seededPresets: !!d.seededPresets,
          splits: splits,
        };
      }

      var migrated = migrateSingleSplitPayload(d);
      return {
        version: 2,
        activeSplitId: migrated.id,
        unseenSplitIds: [],
        splits: [migrated],
      };
    } catch (e) {
      return defaultLibrary();
    }
  }

  function saveLibrary(lib, opts) {
    opts = opts || {};
    try {
      if (!opts.skipTouch) {
        lib.updatedAt = new Date().toISOString();
      }
      if (!opts.skipSyncFlag) {
        lib._syncPending = true;
      }
      localStorage.setItem(getStorageKey(), JSON.stringify(lib));
      try {
        window.dispatchEvent(new CustomEvent('strongman:splits-updated'));
      } catch (e2) {}
      if (!opts.skipPush) {
        schedulePushToServer();
      }
    } catch (e) {}
  }

  var syncInflight = null;
  var pushTimer = null;

  function canSync() {
    return !!(
      window.isLoggedIn &&
      window.isLoggedIn() &&
      window.getCurrentUser &&
      window.apiGet &&
      window.apiPut
    );
  }

  function stripSyncMeta(lib) {
    if (!lib || typeof lib !== 'object') return lib;
    var copy = JSON.parse(JSON.stringify(lib));
    delete copy._syncPending;
    delete copy.serverUpdatedAt;
    return copy;
  }

  function libraryTimestamp(lib) {
    if (!lib) return 0;
    var t = lib.updatedAt || lib.serverUpdatedAt;
    if (!t) return 0;
    var ms = Date.parse(t);
    return isNaN(ms) ? 0 : ms;
  }

  function applyLibraryFromServer(lib) {
    if (!lib || typeof lib !== 'object') return;
    var next = stripSyncMeta(lib);
    next._syncPending = false;
    if (lib.serverUpdatedAt) next.serverUpdatedAt = lib.serverUpdatedAt;
    if (!next.updatedAt && lib.serverUpdatedAt) next.updatedAt = lib.serverUpdatedAt;
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(next));
      try {
        window.dispatchEvent(new CustomEvent('strongman:splits-updated'));
      } catch (e2) {}
    } catch (e) {}
  }

  function pushToServerAsync(lib) {
    if (!canSync()) return Promise.resolve(false);
    lib = lib || loadLibrary();
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(false);
    var payload = stripSyncMeta(lib);
    return window
      .apiPut('/users/' + u.id + '/workout-splits', { payload: payload })
      .then(function (res) {
        if (!res.ok) return false;
        return res.json();
      })
      .then(function (saved) {
        if (!saved) return false;
        applyLibraryFromServer(saved);
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
      .apiGet('/users/' + u.id + '/workout-splits')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (body) {
        if (body == null) return null;
        if (typeof body !== 'object') return null;
        return body;
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

  function syncFromServerAsync() {
    if (!canSync()) return Promise.resolve(false);
    if (syncInflight) return syncInflight;
    syncInflight = pullFromServerAsync()
      .then(function (serverLib) {
        var localConfigured = hasUserConfigured();
        var localLib = localConfigured ? loadLibrary() : null;
        if (!serverLib && localConfigured && localLib) {
          return pushToServerAsync(localLib);
        }
        if (serverLib && !localConfigured) {
          applyLibraryFromServer(serverLib);
          return true;
        }
        if (serverLib && localLib) {
          var localTs = libraryTimestamp(localLib);
          var serverTs = libraryTimestamp(serverLib);
          if (localLib._syncPending || localTs > serverTs) {
            return pushToServerAsync(localLib);
          }
          if (serverTs > localTs) {
            applyLibraryFromServer(serverLib);
            return true;
          }
          if (localLib._syncPending) {
            return pushToServerAsync(localLib);
          }
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

  function onUserChanged(userId) {
    migrateLegacyIfNeeded(storageKeyForUser(userId ? String(userId) : null));
    if (canSync()) {
      syncFromServerAsync();
    }
  }

  function getActiveSplit(lib) {
    lib = lib || loadLibrary();
    var id = lib.activeSplitId;
    for (var i = 0; i < lib.splits.length; i++) {
      if (lib.splits[i].id === id) return lib.splits[i];
    }
    return lib.splits[0] || defaultSplitState();
  }

  function splitToState(split) {
    return {
      id: split.id,
      programName: split.programName,
      days: split.days.slice(),
      dayPlans: split.dayPlans.map(function (p) {
        if (!p) return null;
        return {
          title: p.title,
          exercises: (p.exercises || []).map(function (ex) {
            return Object.assign({}, ex);
          }),
        };
      }),
      source: split.source,
      untouched: !!split.untouched,
    };
  }

  function hasUserConfigured() {
    try {
      return !!localStorage.getItem(getStorageKey());
    } catch (e) {
      return false;
    }
  }

  function listSplits() {
    return loadLibrary().splits.map(function (s) {
      return {
        id: s.id,
        programName: s.programName,
        source: s.source,
        updatedAt: s.updatedAt,
      };
    });
  }

  function getActiveSplitId() {
    return loadLibrary().activeSplitId;
  }

  function setActiveSplit(id) {
    var lib = loadLibrary();
    if (!lib.splits.some(function (s) { return s.id === id; })) return false;
    lib.activeSplitId = id;
    markSplitSeen(id);
    saveLibrary(lib);
    return true;
  }

  function markSplitSeen(id) {
    if (!id) return;
    var lib = loadLibrary();
    lib.unseenSplitIds = (lib.unseenSplitIds || []).filter(function (x) {
      return x !== id;
    });
    saveLibrary(lib);
  }

  function markAllSplitsSeen() {
    var lib = loadLibrary();
    lib.unseenSplitIds = [];
    saveLibrary(lib);
  }

  function getUnseenSplitCount() {
    return (loadLibrary().unseenSplitIds || []).length;
  }

  function hasUnseenAiSplits() {
    return getUnseenSplitCount() > 0;
  }

  function load() {
    return splitToState(getActiveSplit());
  }

  function loadById(id) {
    var lib = loadLibrary();
    if (!id) return splitToState(getActiveSplit(lib));
    for (var i = 0; i < lib.splits.length; i++) {
      if (lib.splits[i].id === id) return splitToState(lib.splits[i]);
    }
    return null;
  }

  function updateSplitInLibrary(id, state, opts) {
    opts = opts || {};
    var lib = loadLibrary();
    var idx = -1;
    for (var i = 0; i < lib.splits.length; i++) {
      if (lib.splits[i].id === id) {
        idx = i;
        break;
      }
    }
    var days = normalizeDays(state.days);
    var next = normalizeSplit(
      {
        id: id,
        programName: state.programName != null ? String(state.programName) : '',
        days: days,
        dayPlans: normalizeDayPlans(state.dayPlans, days),
        source: opts.source || (idx >= 0 ? lib.splits[idx].source : 'manual'),
        untouched: false,
        createdAt: idx >= 0 ? lib.splits[idx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      id
    );
    if (idx >= 0) lib.splits[idx] = next;
    else lib.splits.push(next);
    if (opts.activate) lib.activeSplitId = next.id;
    saveLibrary(lib);
    return next;
  }

  function save(state) {
    var lib = loadLibrary();
    var activeId = lib.activeSplitId || (lib.splits[0] && lib.splits[0].id);
    updateSplitInLibrary(activeId, state, { activate: true });
  }

  function saveById(id, state, opts) {
    opts = opts || {};
    var lib = loadLibrary();
    var targetId = id || lib.activeSplitId || (lib.splits[0] && lib.splits[0].id);
    if (!targetId) return null;
    return updateSplitInLibrary(targetId, state, {
      activate: !!opts.activate,
      source: opts.source,
    });
  }

  function createSplit(name, initial, opts) {
    opts = opts || {};
    var lib = loadLibrary();
    var blankDays = BLANK_DAYS.slice();
    var days =
      initial && initial.days ? normalizeDays(initial.days) : blankDays;
    var split = defaultSplitState({
      programName: name || 'My Split',
      days: days,
      dayPlans:
        initial && initial.dayPlans
          ? normalizeDayPlans(initial.dayPlans, days)
          : [null, null, null, null, null, null, null],
      source: initial && initial.source ? initial.source : 'manual',
    });
    split.untouched = opts.untouched === true;
    var hadValidActive =
      !!lib.activeSplitId &&
      lib.splits.some(function (s) {
        return s.id === lib.activeSplitId;
      });
    lib.splits.push(split);
    if (opts.activate === true || !hadValidActive) {
      lib.activeSplitId = split.id;
    }
    saveLibrary(lib);
    return split.id;
  }

  function isUntouched(id) {
    if (!id) return false;
    var lib = loadLibrary();
    for (var i = 0; i < lib.splits.length; i++) {
      if (lib.splits[i].id === id) return !!lib.splits[i].untouched;
    }
    return false;
  }

  function markTouched(id) {
    if (!id) return;
    var lib = loadLibrary();
    var changed = false;
    for (var i = 0; i < lib.splits.length; i++) {
      if (lib.splits[i].id === id && lib.splits[i].untouched) {
        lib.splits[i].untouched = false;
        changed = true;
        break;
      }
    }
    if (changed) saveLibrary(lib);
  }

  function discardUntouched(id) {
    if (!id || !isUntouched(id)) return false;
    if (getActiveSplitId() === id) {
      markTouched(id);
      return false;
    }
    return deleteSplit(id);
  }

  function deleteSplit(id) {
    var lib = loadLibrary();
    if (lib.splits.length <= 1) return false;
    lib.splits = lib.splits.filter(function (s) { return s.id !== id; });
    lib.unseenSplitIds = (lib.unseenSplitIds || []).filter(function (x) { return x !== id; });
    if (lib.activeSplitId === id) lib.activeSplitId = lib.splits[0].id;
    saveLibrary(lib);
    return true;
  }

  function duplicateSplit(id) {
    var lib = loadLibrary();
    var src = lib.splits.find(function (s) { return s.id === id; });
    if (!src) return null;
    var copy = normalizeSplit(
      Object.assign({}, splitToState(src), {
        id: newSplitId(),
        programName: (src.programName || 'Split') + ' (copy)',
        source: 'manual',
        untouched: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    lib.splits.push(copy);
    saveLibrary(lib);
    return copy.id;
  }

  function addAiSplit(parsed, opts) {
    opts = opts || {};
    if (!parsed) return null;
    var days = normalizeDays(parsed.days);
    var lib = loadLibrary();
    var split = defaultSplitState({
      programName: parsed.programName || opts.name || 'Rocky routine',
      days: days,
      dayPlans: normalizeDayPlans(parsed.dayPlans, days),
      source: 'ai',
    });
    lib.splits.push(split);
    if (opts.activate !== false) lib.activeSplitId = split.id;
    if (lib.unseenSplitIds.indexOf(split.id) === -1) lib.unseenSplitIds.push(split.id);
    saveLibrary(lib);
    return split.id;
  }

  function saveRoutine(parsed, opts) {
    opts = opts || {};
    if (!parsed) return false;
    if (opts.asNew || opts.source === 'ai') {
      addAiSplit(parsed, { name: parsed.programName, activate: opts.activate !== false });
      return true;
    }
    var days = normalizeDays(parsed.days);
    save({
      programName: parsed.programName || '',
      days: days,
      dayPlans: normalizeDayPlans(parsed.dayPlans, days),
    });
    return true;
  }

  function importAiWorkout(workout, opts) {
    opts = opts || {};
    if (!workout) return null;
    var exercises = [];
    if (Array.isArray(workout.blocks)) {
      workout.blocks.forEach(function (block) {
        (block.exercises || []).forEach(function (ex) {
          if (!ex || !ex.name) return;
          var line = ex.name;
          if (ex.prescription) line += ' · ' + ex.prescription;
          if (window.RoutineImport && typeof window.RoutineImport.parseExerciseLine === 'function') {
            var parsed = window.RoutineImport.parseExerciseLine(line);
            if (parsed && parsed.name) {
              exercises.push(templateExercise(parsed));
              return;
            }
          }
          exercises.push(templateExercise({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
          }));
        });
      });
    }
    if (!exercises.length && Array.isArray(workout.exercises)) {
      workout.exercises.forEach(function (ex) {
        if (ex && ex.name) exercises.push(ex);
      });
    }
    if (!exercises.length) return null;

    var todayIdx = mondayIndexFromDate(new Date());
    var days = DEFAULT_DAYS.slice();
    var dayPlans = [null, null, null, null, null, null, null];
    var title = workout.title || workout.programName || 'AI session';
    days[todayIdx] = title;
    dayPlans[todayIdx] = { title: title, exercises: exercises };

    return addAiSplit(
      { programName: (workout.title || 'Rocky session') + ' · template', days: days, dayPlans: dayPlans },
      { name: workout.title || 'Rocky session', activate: opts.activate !== false }
    );
  }

  function mondayIndexFromDate(date) {
    return (date.getDay() + 6) % 7;
  }

  function splitFieldLineForDate(state, date) {
    var s = state || load();
    var idx = mondayIndexFromDate(date || new Date());
    var dayName = s.days[idx] || '—';
    var prog = (s.programName && String(s.programName).trim()) || '';
    if (prog) return prog + ' · ' + dayName;
    return dayName;
  }

  function getDayPlan(state, date) {
    var s = state || load();
    var idx = mondayIndexFromDate(date || new Date());
    return s.dayPlans && s.dayPlans[idx] ? s.dayPlans[idx] : null;
  }

  function defaultSessionTitle(state, date) {
    var s = state || load();
    var idx = mondayIndexFromDate(date || new Date());
    var plan = s.dayPlans && s.dayPlans[idx];
    if (plan && plan.title) return plan.title;
    var dayName = s.days[idx] || '';
    if (/rest/i.test(dayName)) return 'Rest day';
    return dayName || 'Workout';
  }

  function isRestDay(state, date) {
    var s = state || load();
    var idx = mondayIndexFromDate(date || new Date());
    var label = (s.days && s.days[idx]) || '';
    if (/rest/i.test(label)) return true;
    var plan = s.dayPlans && s.dayPlans[idx];
    return !!(plan && plan.exercises && !plan.exercises.length && /rest/i.test(plan.title || ''));
  }

  function exercisesForDate(state, date) {
    var plan = getDayPlan(state, date);
    if (!plan || !Array.isArray(plan.exercises)) return [];
    return plan.exercises
      .filter(function (ex) {
        return ex && (ex.name || ex.sets || ex.reps);
      })
      .map(function (ex) {
        return templateExercise(ex);
      });
  }

  window.WorkoutSplit = {
    STORAGE_KEY: getStorageKey(),
    STORAGE_KEY_BASE: STORAGE_KEY_BASE,
    getStorageKey: getStorageKey,
    isSplitStorageKey: isSplitStorageKey,
    hasUserConfigured: hasUserConfigured,
    loadLibrary: loadLibrary,
    listSplits: listSplits,
    getActiveSplitId: getActiveSplitId,
    setActiveSplit: setActiveSplit,
    createSplit: createSplit,
    deleteSplit: deleteSplit,
    duplicateSplit: duplicateSplit,
    isUntouched: isUntouched,
    markTouched: markTouched,
    discardUntouched: discardUntouched,
    addAiSplit: addAiSplit,
    importAiWorkout: importAiWorkout,
    encodeSharePayload: encodeSharePayload,
    decodeSharePayload: decodeSharePayload,
    importSharedSplit: importSharedSplit,
    buildShareUrl: buildShareUrl,
    formatShareText: formatShareText,
    markSplitSeen: markSplitSeen,
    markAllSplitsSeen: markAllSplitsSeen,
    getUnseenSplitCount: getUnseenSplitCount,
    hasUnseenAiSplits: hasUnseenAiSplits,
    load: load,
    loadById: loadById,
    save: save,
    saveById: saveById,
    saveRoutine: saveRoutine,
    mondayIndexFromDate: mondayIndexFromDate,
    splitFieldLineForDate: splitFieldLineForDate,
    getDayPlan: getDayPlan,
    defaultSessionTitle: defaultSessionTitle,
    isRestDay: isRestDay,
    exercisesForDate: exercisesForDate,
    dayLetters: DAY_LETTERS,
    defaultDays: BLANK_DAYS,
    blankDays: BLANK_DAYS,
    syncFromServerAsync: syncFromServerAsync,
    pushToServerAsync: pushToServerAsync,
    onUserChanged: onUserChanged,
  };
})();
