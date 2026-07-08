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

  function defaultState() {
    return { programName: '', days: DEFAULT_DAYS.slice(), dayPlans: [null, null, null, null, null, null, null] };
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
              weight: ex && ex.weight != null ? String(ex.weight) : ''
            };
          })
        : [];
      out.push({
        title: p.title != null ? String(p.title) : days[i] || '',
        exercises: exercises
      });
    }
    return out;
  }

  function hasUserConfigured() {
    try {
      return !!localStorage.getItem(getStorageKey());
    } catch (e) {
      return false;
    }
  }

  function load() {
    var key = getStorageKey();
    migrateLegacyIfNeeded(key);
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return defaultState();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return defaultState();
      var days = normalizeDays(d.days);
      return {
        programName: d.programName != null ? String(d.programName) : '',
        days: days,
        dayPlans: normalizeDayPlans(d.dayPlans, days)
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      var days = normalizeDays(state.days);
      localStorage.setItem(
        getStorageKey(),
        JSON.stringify({
          programName: state.programName != null ? String(state.programName) : '',
          days: days,
          dayPlans: normalizeDayPlans(state.dayPlans, days)
        })
      );
    } catch (e) {}
  }

  function saveRoutine(parsed) {
    if (!parsed) return false;
    var days = normalizeDays(parsed.days);
    save({
      programName: parsed.programName || '',
      days: days,
      dayPlans: normalizeDayPlans(parsed.dayPlans, days)
    });
    return true;
  }

  /** Monday = 0 … Sunday = 6 (matches home day-split data-day) */
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
    return plan.exercises.filter(function (ex) {
      return ex && (ex.name || ex.sets || ex.reps || ex.weight);
    });
  }

  window.WorkoutSplit = {
    STORAGE_KEY: getStorageKey(),
    STORAGE_KEY_BASE: STORAGE_KEY_BASE,
    getStorageKey: getStorageKey,
    isSplitStorageKey: isSplitStorageKey,
    hasUserConfigured: hasUserConfigured,
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
    defaultDays: DEFAULT_DAYS
  };
})();
