/**
 * Workout prediction placeholders (v2.0).
 * Final algorithm TBD from research — this provides beginner defaults,
 * history-based guesses, and equipment-aware exercise suggestions.
 */
(function () {
  var EQUIPMENT_POPULARITY = [
    { id: 'dumbbells', label: 'Dumbbells' },
    { id: 'barbells', label: 'Barbells' },
    { id: 'cable', label: 'Cable machine' },
    { id: 'bench', label: 'Bench' },
    { id: 'squat_rack', label: 'Squat rack' },
    { id: 'pullup_bar', label: 'Pull-up bar' },
    { id: 'kettlebells', label: 'Kettlebells' },
    { id: 'smith', label: 'Smith machine' },
    { id: 'leg_press', label: 'Leg press' },
    { id: 'machines', label: 'Selectorized machines' },
    { id: 'bands', label: 'Resistance bands' },
    { id: 'cardio', label: 'Cardio machines' },
    { id: 'bodyweight', label: 'Bodyweight only' },
  ];

  /** Beginner starting guesses (lb). Adjustable by steppers. */
  var BEGINNER_DEFAULTS = {
    'bench press': { weight: 95, reps: 8, sets: 3 },
    'barbell bench press': { weight: 95, reps: 8, sets: 3 },
    'incline bench press': { weight: 65, reps: 8, sets: 3 },
    'overhead press': { weight: 55, reps: 8, sets: 3 },
    'shoulder press': { weight: 40, reps: 10, sets: 3 },
    squat: { weight: 95, reps: 8, sets: 3 },
    'back squat': { weight: 95, reps: 8, sets: 3 },
    deadlift: { weight: 135, reps: 5, sets: 3 },
    'romanian deadlift': { weight: 95, reps: 8, sets: 3 },
    'barbell row': { weight: 75, reps: 8, sets: 3 },
    'lat pulldown': { weight: 70, reps: 10, sets: 3 },
    'seated row': { weight: 70, reps: 10, sets: 3 },
    'dumbbell curl': { weight: 20, reps: 10, sets: 3 },
    'tricep pushdown': { weight: 30, reps: 12, sets: 3 },
    'leg press': { weight: 180, reps: 10, sets: 3 },
    'dumbbell bench press': { weight: 40, reps: 10, sets: 3 },
    'dumbbell row': { weight: 35, reps: 10, sets: 3 },
    'lunges': { weight: 0, reps: 10, sets: 3 },
    'pull-up': { weight: 0, reps: 5, sets: 3 },
    'push-up': { weight: 0, reps: 10, sets: 3 },
  };

  var EQUIPMENT_GATES = {
    dumbbells: /dumbbell|db /i,
    barbells: /barbell|bb |deadlift|squat|bench press|row|ohp|overhead/i,
    cable: /cable|pulldown|pushdown|fly/i,
    bench: /bench|incline|decline/i,
    squat_rack: /squat|rack|pull-up|chin/i,
    pullup_bar: /pull-up|chin-up|hanging/i,
    kettlebells: /kettlebell|kb /i,
    smith: /smith/i,
    leg_press: /leg press/i,
    machines: /machine|press|extension|curl|pulldown|row/i,
    bands: /band/i,
    cardio: /run|bike|row|elliptical|cardio/i,
    bodyweight: /push-up|pull-up|plank|bodyweight|dip/i,
  };

  function normalizeName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  // Session-only — never persist across workouts / page loads.
  var sessionEquipmentIds = null;

  function getUserEquipmentIds() {
    if (Array.isArray(sessionEquipmentIds) && sessionEquipmentIds.length) {
      return sessionEquipmentIds.slice();
    }
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ctx = user && user.athleteContext ? user.athleteContext : {};
    if (ctx.homeGym && Array.isArray(ctx.homeGym.equipment) && ctx.homeGym.equipment.length) {
      return ['dumbbells', 'barbells', 'cable', 'bench', 'machines'];
    }
    if (user && user.equipment === 'none') return ['bodyweight', 'bands'];
    if (user && user.equipment === 'home') {
      return ['dumbbells', 'bench', 'bands', 'bodyweight', 'kettlebells'];
    }
    return EQUIPMENT_POPULARITY.map(function (e) {
      return e.id;
    });
  }

  function setSessionEquipment(ids) {
    sessionEquipmentIds = Array.isArray(ids) && ids.length ? ids.slice() : null;
  }

  function clearSessionEquipment() {
    sessionEquipmentIds = null;
    try {
      localStorage.removeItem('strongman-session-equipment');
    } catch (e) {}
  }

  function exerciseAllowedForEquipment(name, equipmentIds) {
    var ids = equipmentIds || getUserEquipmentIds();
    if (!ids || !ids.length) return true;
    if (ids.indexOf('bodyweight') !== -1 && /push-up|plank|bodyweight/i.test(name)) return true;
    var allowed = false;
    var matchedGate = false;
    Object.keys(EQUIPMENT_GATES).forEach(function (id) {
      if (!EQUIPMENT_GATES[id].test(name)) return;
      matchedGate = true;
      if (ids.indexOf(id) !== -1) allowed = true;
    });
    if (!matchedGate) return true;
    return allowed;
  }

  function beginnerDefaultFor(name) {
    var key = normalizeName(name);
    if (BEGINNER_DEFAULTS[key]) return Object.assign({}, BEGINNER_DEFAULTS[key]);
    for (var k in BEGINNER_DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(BEGINNER_DEFAULTS, k) && key.indexOf(k) !== -1) {
        return Object.assign({}, BEGINNER_DEFAULTS[k]);
      }
    }
    return { weight: 45, reps: 10, sets: 3, source: 'beginner_guess' };
  }

  function roundToGymWeight(weight, metric, step) {
    var w = Number(weight);
    if (!isFinite(w) || w < 0) return weight;
    var s = Number(step);
    if (!(s > 0)) {
      s = metric ? 2.5 : 5;
    }
    return Math.round(w / s) * s;
  }

  /**
   * Placeholder predictor — history first, then beginner defaults.
   * Hook final research algorithm here later.
   */
  function predictLoad(exerciseName, opts) {
    opts = opts || {};
    var name = String(exerciseName || '').trim();
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var metric =
      opts.units === 'metric' || (user && user.measurement === 'metric');

    if (window.ProgressionEngine && typeof window.ProgressionEngine.recommend === 'function') {
      var rec = window.ProgressionEngine.recommend(name, { metric: metric });
      if (rec && rec.weight != null) {
        return {
          weight: rec.weight,
          reps: rec.reps,
          sets: rec.sets,
          source: 'progression_engine',
          note: (rec.reasons || []).join('\n'),
          reasons: rec.reasons || [],
          action: rec.action,
          old: rec.old,
          scores: rec.scores,
        };
      }
    }

    var result = {
      weight: null,
      reps: 8,
      sets: 3,
      source: 'placeholder',
      note: '',
      reasons: [],
    };

    if (
      window.WorkoutSession &&
      typeof window.WorkoutSession.getPreviousPerformance === 'function'
    ) {
      var prev = window.WorkoutSession.getPreviousPerformance(name);
      if (prev && prev.length) {
        var last = String(prev[prev.length - 1] || '');
        var m = /(\d+(?:\.\d+)?)\s*(?:lb|kg)?/i.exec(last);
        var rm = /(\d+)\s*[x×]/i.exec(last) || /[x×]\s*(\d+)/i.exec(last);
        if (m) result.weight = parseFloat(m[1]);
        if (rm) result.reps = parseInt(rm[1], 10) || 8;
        result.source = 'history';
        result.note = 'Based on your last session.';
        result.reasons = [result.note];
        if (result.weight != null) {
          var stepH =
            window.ExerciseDatabase && window.ExerciseDatabase.getMinIncrement
              ? window.ExerciseDatabase.getMinIncrement({ name: name, metric: metric })
              : metric
                ? 2.5
                : 5;
          result.weight = roundToGymWeight(result.weight, metric, stepH);
        }
        return result;
      }
    }

    var exp = (user && user.experience) || 'beginner';
    var base = beginnerDefaultFor(name);
    result.weight = base.weight;
    result.reps = base.reps;
    result.sets = base.sets;
    if (exp === 'intermediate') {
      result.weight = (result.weight || 45) * 1.35;
      result.source = 'beginner_scaled';
      result.note = 'Starting guess — dial in with +/−.';
    } else if (exp === 'advanced') {
      result.weight = (result.weight || 45) * 1.7;
      result.source = 'beginner_scaled';
      result.note = 'Starting guess — dial in with +/−.';
    } else {
      result.source = 'beginner_default';
      result.note = 'Beginner starting guess — tap +/− to dial it in.';
    }
    result.reasons = [result.note];
    var step =
      window.ExerciseDatabase && window.ExerciseDatabase.getMinIncrement
        ? window.ExerciseDatabase.getMinIncrement({ name: name, metric: metric })
        : metric
          ? 2.5
          : 5;
    if (metric) {
      result.weight = roundToGymWeight((result.weight || 0) / 2.20462, true, step);
    } else {
      result.weight = roundToGymWeight(result.weight || 0, false, step);
    }
    return result;
  }

  var DAY_FOCUS_TEMPLATES = {
    arms: [
      'Dumbbell Curl',
      'Tricep Pushdown',
      'Hammer Curl',
      'Overhead Tricep Extension',
      'Cable Curl',
    ],
    chest: [
      'Barbell Bench Press',
      'Incline Dumbbell Press',
      'Cable Fly',
      'Push-Up',
      'Chest Press Machine',
    ],
    back: [
      'Lat Pulldown',
      'Seated Row',
      'Barbell Row',
      'Face Pull',
      'Straight-Arm Pulldown',
    ],
    shoulders: [
      'Dumbbell Shoulder Press',
      'Lateral Raise',
      'Face Pull',
      'Rear Delt Fly',
      'Cable Upright Row',
    ],
    legs: [
      'Back Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Leg Curl',
      'Walking Lunge',
    ],
    push: [
      'Barbell Bench Press',
      'Overhead Press',
      'Incline Dumbbell Press',
      'Tricep Pushdown',
      'Lateral Raise',
    ],
    pull: [
      'Lat Pulldown',
      'Seated Row',
      'Dumbbell Curl',
      'Face Pull',
      'Barbell Row',
    ],
    upper: [
      'Barbell Bench Press',
      'Lat Pulldown',
      'Dumbbell Shoulder Press',
      'Seated Row',
      'Dumbbell Curl',
    ],
    lower: [
      'Back Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Leg Curl',
      'Calf Raise',
    ],
  };

  function inferDayFocus(label) {
    var s = String(label || '').toLowerCase();
    if (/arm|bicep|tricep|\bbis\b|\btris\b|guns|curl day/.test(s)) return 'arms';
    if (/chest|pec/.test(s)) return 'chest';
    if (/back|lat|row/.test(s)) return 'back';
    if (/shoulder|delt/.test(s)) return 'shoulders';
    if (/leg|quad|ham|glute|squat/.test(s)) return 'legs';
    if (/\bpush\b/.test(s)) return 'push';
    if (/\bpull\b/.test(s)) return 'pull';
    if (/upper/.test(s)) return 'upper';
    if (/lower/.test(s)) return 'lower';
    return null;
  }

  function exerciseMatchesFocus(name, focus) {
    if (!focus) return true;
    var n = String(name || '').toLowerCase();
    if (focus === 'arms') {
      if (/bench|chest|fly|pec|squat|deadlift|leg |hip thrust|calf|yoke|farmer|atlas/.test(n)) {
        return false;
      }
      return /curl|tricep|bicep|pushdown|skull|hammer|forearm|wrist|extension/.test(n);
    }
    if (focus === 'chest') {
      return /bench|chest|fly|pec|push-?up|dip/.test(n) && !/shoulder|overhead|military/.test(n);
    }
    if (focus === 'back') {
      return /row|pulldown|pull-?up|chin|lat |deadlift|face pull|shrug/.test(n);
    }
    if (focus === 'shoulders') {
      return /shoulder|overhead|military|lateral|rear delt|face pull|ohp|raise/.test(n);
    }
    if (focus === 'legs') {
      return /squat|leg |lunge|rdl|deadlift|hip thrust|calf|ham|quad|glute/.test(n);
    }
    if (focus === 'push') {
      return /bench|press|fly|tricep|pushdown|lateral|dip|push-?up/.test(n) && !/row|pulldown|curl/.test(n);
    }
    if (focus === 'pull') {
      return /row|pulldown|pull-?up|chin|curl|face pull|deadlift|lat /.test(n);
    }
    if (focus === 'upper') {
      return !/squat|leg press|leg curl|leg extension|calf|lunge|hip thrust/.test(n);
    }
    if (focus === 'lower') {
      return /squat|leg |lunge|rdl|deadlift|hip thrust|calf|ham|quad|glute/.test(n);
    }
    return true;
  }

  function predictExercises(opts) {
    opts = opts || {};
    var equipmentIds = opts.equipmentIds || getUserEquipmentIds();
    var suggestions = [];
    var seen = {};

    function pushName(name, reason) {
      var n = String(name || '').trim();
      if (!n) return;
      var key = normalizeName(n);
      if (seen[key]) return;
      if (!exerciseAllowedForEquipment(n, equipmentIds)) return;
      seen[key] = true;
      suggestions.push({ name: n, reason: reason || 'suggested' });
    }

    var dayLabel = '';
    var planTitle = '';
    var focus = null;
    if (window.WorkoutSplit) {
      try {
        var state = window.WorkoutSplit.load ? window.WorkoutSplit.load() : null;
        var idx =
          window.WorkoutSplit.mondayIndexFromDate
            ? window.WorkoutSplit.mondayIndexFromDate(new Date())
            : (new Date().getDay() + 6) % 7;
        if (state && state.days && state.days[idx]) dayLabel = state.days[idx];
        var plan =
          typeof window.WorkoutSplit.getDayPlan === 'function'
            ? window.WorkoutSplit.getDayPlan(state, new Date())
            : null;
        if (plan && plan.title) planTitle = plan.title;
        focus = inferDayFocus(dayLabel) || inferDayFocus(planTitle);
        var today =
          typeof window.WorkoutSplit.exercisesForDate === 'function'
            ? window.WorkoutSplit.exercisesForDate(state, new Date()) || []
            : [];
        today.forEach(function (ex) {
          if (focus && !exerciseMatchesFocus(ex.name, focus)) return;
          pushName(ex.name, 'split');
        });
        if (suggestions.length) return suggestions.slice(0, 8);
      } catch (e) {}
    }

    focus = focus || inferDayFocus(dayLabel) || inferDayFocus(planTitle);
    if (focus && DAY_FOCUS_TEMPLATES[focus]) {
      DAY_FOCUS_TEMPLATES[focus].forEach(function (n) {
        pushName(n, 'day_focus');
      });
      if (suggestions.length) return suggestions.slice(0, 8);
    }

    // Don't use recent history when we know today's focus — it bleeds chest into arm day.
    if (!focus && window.WorkoutLog && typeof window.WorkoutLog.getSessions === 'function') {
      try {
        var sessions = window.WorkoutLog.getSessions() || [];
        sessions
          .slice()
          .reverse()
          .slice(0, 8)
          .forEach(function (s) {
            (s.exercises || []).forEach(function (ex) {
              pushName(ex.name, 'history');
            });
          });
      } catch (e2) {}
    }

    if (!suggestions.length) {
      var fallback = focus && DAY_FOCUS_TEMPLATES[focus]
        ? DAY_FOCUS_TEMPLATES[focus]
        : [
            'Curl (Barbell)',
            'Tricep pushdown',
            'Lat pulldown',
            'Seated Row',
            'Dumbbell Shoulder Press',
            'Back squat',
          ];
      fallback.forEach(function (n) {
        pushName(n, 'beginner_template');
      });
    }

    return suggestions.slice(0, 8);
  }

  function applyPredictionToExercise(exercise) {
    if (!exercise) return exercise;
    var pred = predictLoad(exercise.name);
    var setCount = Math.max(1, pred.sets || 3);
    if (!exercise.sets || !exercise.sets.length) {
      exercise.sets = [];
      for (var i = 0; i < setCount; i++) {
        exercise.sets.push({
          setNumber: i + 1,
          weight: pred.weight,
          reps: pred.reps,
          completed: false,
        });
      }
    } else {
      exercise.sets.forEach(function (set) {
        if (set.weight == null) set.weight = pred.weight;
        if (set.reps == null) set.reps = pred.reps;
      });
    }
    exercise._prediction = pred;
    return exercise;
  }

  window.WorkoutPredict = {
    EQUIPMENT_POPULARITY: EQUIPMENT_POPULARITY,
    BEGINNER_DEFAULTS: BEGINNER_DEFAULTS,
    getUserEquipmentIds: getUserEquipmentIds,
    setSessionEquipment: setSessionEquipment,
    clearSessionEquipment: clearSessionEquipment,
    exerciseAllowedForEquipment: exerciseAllowedForEquipment,
    predictLoad: predictLoad,
    predictExercises: predictExercises,
    applyPredictionToExercise: applyPredictionToExercise,
    beginnerDefaultFor: beginnerDefaultFor,
    roundToGymWeight: roundToGymWeight,
  };
})();
