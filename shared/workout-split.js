(function () {
  var STORAGE_KEY_BASE = 'strongmanai_workout_split_v1';
  var LEGACY_KEY = STORAGE_KEY_BASE;
  var DEFAULT_DAYS = ['PUSH', 'PULL', 'LEGS', 'REST', 'ARMS', 'CHEST + BACK', 'REST'];
  var DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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

  function defaultLibrary() {
    var split = defaultSplitState();
    return {
      version: 2,
      activeSplitId: split.id,
      unseenSplitIds: [],
      splits: [split],
    };
  }

  function normalizeDays(arr) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var s = arr && arr[i] != null ? String(arr[i]).trim() : '';
      out.push(s || '—');
    }
    return out;
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
            return {
              name: ex && ex.name != null ? String(ex.name) : '',
              sets: ex && ex.sets != null ? String(ex.sets) : '',
              reps: ex && ex.reps != null ? String(ex.reps) : '',
              weight: ex && ex.weight != null ? String(ex.weight) : '',
            };
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
    return {
      id: raw.id != null ? String(raw.id) : fallbackId || newSplitId(),
      programName: raw.programName != null ? String(raw.programName) : '',
      days: days,
      dayPlans: normalizeDayPlans(raw.dayPlans, days),
      source: raw.source === 'ai' ? 'ai' : 'manual',
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

  function saveLibrary(lib) {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(lib));
      try {
        window.dispatchEvent(new CustomEvent('strongman:splits-updated'));
      } catch (e2) {}
    } catch (e) {}
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

  function createSplit(name, initial) {
    var lib = loadLibrary();
    var split = defaultSplitState({
      programName: name || 'New split',
      days: initial && initial.days ? normalizeDays(initial.days) : DEFAULT_DAYS.slice(),
      dayPlans:
        initial && initial.dayPlans
          ? normalizeDayPlans(initial.dayPlans, initial.days || DEFAULT_DAYS)
          : [null, null, null, null, null, null, null],
      source: initial && initial.source ? initial.source : 'manual',
    });
    lib.splits.push(split);
    lib.activeSplitId = split.id;
    saveLibrary(lib);
    return split.id;
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    lib.splits.push(copy);
    lib.activeSplitId = copy.id;
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
              exercises.push(parsed);
              return;
            }
          }
          exercises.push({
            name: ex.name,
            sets: ex.sets != null ? String(ex.sets) : '',
            reps: ex.reps != null ? String(ex.reps) : '',
            weight: ex.weight != null ? String(ex.weight) : '',
          });
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
        return ex && (ex.name || ex.sets || ex.reps || ex.weight);
      })
      .map(function (ex) {
        return {
          name: ex.name || '',
          sets: ex.sets || '',
          reps: ex.reps || '',
          weight: ex.weight || '',
        };
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
    addAiSplit: addAiSplit,
    importAiWorkout: importAiWorkout,
    markSplitSeen: markSplitSeen,
    markAllSplitsSeen: markAllSplitsSeen,
    getUnseenSplitCount: getUnseenSplitCount,
    hasUnseenAiSplits: hasUnseenAiSplits,
    load: load,
    save: save,
    saveRoutine: saveRoutine,
    mondayIndexFromDate: mondayIndexFromDate,
    splitFieldLineForDate: splitFieldLineForDate,
    getDayPlan: getDayPlan,
    defaultSessionTitle: defaultSessionTitle,
    isRestDay: isRestDay,
    exercisesForDate: exercisesForDate,
    dayLetters: DAY_LETTERS,
    defaultDays: DEFAULT_DAYS,
  };
})();
