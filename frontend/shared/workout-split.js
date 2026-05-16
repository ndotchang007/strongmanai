(function () {
  var STORAGE_KEY = 'strongmanai_workout_split_v1';
  var DEFAULT_DAYS = ['PUSH', 'PULL', 'LEGS', 'REST', 'ARMS', 'CHEST + BACK', 'REST'];
  var DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function defaultState() {
    return { programName: '', days: DEFAULT_DAYS.slice() };
  }

  function normalizeDays(arr) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var s = arr && arr[i] != null ? String(arr[i]).trim() : '';
      out.push(s || '—');
    }
    return out;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return defaultState();
      return {
        programName: d.programName != null ? String(d.programName) : '',
        days: normalizeDays(d.days)
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          programName: state.programName != null ? String(state.programName) : '',
          days: normalizeDays(state.days)
        })
      );
    } catch (e) {}
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

  window.WorkoutSplit = {
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    mondayIndexFromDate: mondayIndexFromDate,
    splitFieldLineForDate: splitFieldLineForDate,
    dayLetters: DAY_LETTERS,
    defaultDays: DEFAULT_DAYS
  };
})();
