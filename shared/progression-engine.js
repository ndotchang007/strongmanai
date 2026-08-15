/**
 * Strongman AI — client-side progression engine (explainable prescriptions).
 * Implements the deterministic progressive-overload math from the production
 * design spec (double progression, readiness, fatigue, momentum), enough to
 * recommend a load/reps target and return human-readable reason lines.
 */
(function () {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function roundTo(weight, step) {
    var s = step > 0 ? step : 5;
    return Math.round(Number(weight) / s) * s;
  }

  function epleyE1rm(weight, reps, rir) {
    var rtf = Number(reps) + (rir != null ? Number(rir) : 2);
    if (!(weight > 0) || !(rtf > 0) || rtf > 12) return null;
    return weight * (1 + rtf / 30);
  }

  function parseSetLine(line) {
    var s = String(line || '');
    var wm = /(\d+(?:\.\d+)?)\s*(lb|kg)?/i.exec(s);
    var rm = /(\d+)\s*[x×]/i.exec(s) || /[x×]\s*(\d+)/i.exec(s);
    return {
      weight: wm ? parseFloat(wm[1]) : null,
      reps: rm ? parseInt(rm[1], 10) : null,
      unit: wm && wm[2] ? wm[2].toLowerCase() : 'lb',
    };
  }

  function lastSessionForExercise(name) {
    if (
      window.WorkoutSession &&
      typeof window.WorkoutSession.getExercisePerformanceDetail === 'function'
    ) {
      var detail = window.WorkoutSession.getExercisePerformanceDetail(name);
      if (detail && detail.weight != null) {
        return detail;
      }
    }
    if (
      !window.WorkoutSession ||
      typeof window.WorkoutSession.getPreviousPerformance !== 'function'
    ) {
      return null;
    }
    var prev = window.WorkoutSession.getPreviousPerformance(name);
    if (!prev || !prev.length) return null;
    var parsed = prev.map(parseSetLine).filter(function (p) {
      return p.weight != null && p.reps != null;
    });
    if (!parsed.length) return null;
    var best = parsed[0];
    parsed.forEach(function (p) {
      if (p.weight > best.weight || (p.weight === best.weight && p.reps > best.reps)) best = p;
    });
    return {
      weight: best.weight,
      reps: best.reps,
      unit: best.unit || 'lb',
      sets: parsed.length,
      lines: prev,
      momentum: 0.5,
      daysSince: null,
      thirdSetDrop: false,
    };
  }

  function experienceFromUser() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var level = (user && user.experience) || 'beginner';
    if (['beginner', 'intermediate', 'advanced'].indexOf(level) === -1) level = 'beginner';
    var ctx = (user && user.athleteContext) || {};
    var trainingAgeYears = null;
    if (ctx.trainingAgeYears != null) trainingAgeYears = Number(ctx.trainingAgeYears);
    else if (ctx.trainingAge != null) trainingAgeYears = Number(ctx.trainingAge);
    else if (ctx.yearsTraining != null) trainingAgeYears = Number(ctx.yearsTraining);
    if (trainingAgeYears != null && (isNaN(trainingAgeYears) || trainingAgeYears < 0)) {
      trainingAgeYears = null;
    }
    return { level: level, trainingAgeYears: trainingAgeYears };
  }

  function experienceMultiplier(exp) {
    exp = exp || experienceFromUser();
    if (exp.level === 'advanced') return 1.15;
    if (exp.level === 'intermediate') return 1.0;
    return 0.85;
  }

  function overloadThreshold(exp) {
    exp = exp || experienceFromUser();
    if (exp.level === 'beginner') return 65;
    if (exp.level === 'advanced') return 72;
    return 70;
  }

  function readinessFromUser() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ctx = (user && user.athleteContext) || {};
    var check = ctx.readiness || ctx.todayCheckIn || {};
    var sleepHours =
      check.sleepHours != null
        ? Number(check.sleepHours)
        : check.sleep_hours != null
          ? Number(check.sleep_hours)
          : null;
    var sleepQuality = check.sleepQuality != null ? Number(check.sleepQuality) : null;
    var energy = check.energy != null ? Number(check.energy) : null;
    var stress = check.stress != null ? Number(check.stress) : null;
    var soreness = check.soreness != null ? Number(check.soreness) : null;

    // Neutral defaults when the athlete hasn't checked in.
    var parts = [];
    if (sleepQuality != null) parts.push({ w: 0.2, s: (sleepQuality - 1) / 4 });
    if (sleepHours != null) parts.push({ w: 0.1, s: clamp(sleepHours / 8, 0, 1.1) / 1.1 });
    if (energy != null) parts.push({ w: 0.15, s: (energy - 1) / 4 });
    if (stress != null) parts.push({ w: 0.1, s: (5 - stress) / 4 });
    if (soreness != null) parts.push({ w: 0.1, s: (5 - soreness) / 4 });

    var R = 60;
    var present = false;
    if (parts.length) {
      present = true;
      var sw = 0;
      var ss = 0;
      parts.forEach(function (p) {
        sw += p.w;
        ss += p.w * clamp(p.s, 0, 1);
      });
      R = sw > 0 ? 100 * (ss / sw) : 60;
    }

    return {
      R: clamp(R, 0, 100),
      sleepHours: sleepHours,
      sleepQuality: sleepQuality,
      energy: energy,
      stress: stress,
      soreness: soreness,
      present: present,
    };
  }

  function fatigueHints(last, readiness) {
    var hints = [];
    if (last && (last.sets >= 3 || last.thirdSetDrop)) {
      hints.push({
        label: last.thirdSetDrop ? 'set-to-set drop-off' : '3rd set fatigue',
        lbs: -2.5,
        reps: -1,
        code: 'SET_FATIGUE',
      });
    }
    if (last && last.daysSince != null && last.daysSince >= 10) {
      hints.push({
        label: last.daysSince + ' days since last ' + (last.historyCount > 1 ? 'progress' : 'session'),
        lbs: -5,
        reps: -1,
        code: 'LONG_BREAK',
      });
    } else if (last && last.daysSince != null && last.daysSince >= 5) {
      hints.push({
        label: last.daysSince + ' days since last session',
        lbs: -2.5,
        reps: 0,
        code: 'BREAK',
      });
    }
    if (readiness.sleepHours != null && readiness.sleepHours < 6) {
      var deficit = 7 - readiness.sleepHours;
      hints.push({
        label: readiness.sleepHours + ' hours sleep',
        lbs: -roundTo(5 * deficit, 2.5),
        reps: -Math.max(1, Math.round(deficit)),
        code: 'LOW_SLEEP',
      });
    } else if (readiness.sleepQuality != null && readiness.sleepQuality <= 2) {
      hints.push({
        label: 'poor sleep quality',
        lbs: -5,
        reps: -1,
        code: 'LOW_SLEEP_QUALITY',
      });
    }
    if (readiness.soreness != null && readiness.soreness >= 4) {
      hints.push({
        label: 'high soreness',
        lbs: -5,
        reps: -1,
        code: 'HIGH_SORENESS',
      });
    }
    if (readiness.stress != null && readiness.stress >= 4) {
      hints.push({
        label: 'elevated stress',
        lbs: -2.5,
        reps: 0,
        code: 'HIGH_STRESS',
      });
    }
    return hints;
  }

  function stepSize(e1rm, metric, momentum, exp) {
    var basePct = 0.02;
    var m = momentum != null ? momentum : 0.5;
    exp = exp || experienceFromUser();
    var expMult = experienceMultiplier(exp);
    if (exp.trainingAgeYears != null && exp.trainingAgeYears >= 3) expMult += 0.05;
    var raw = (e1rm || 100) * basePct * (0.5 + m) * expMult;
    var minInc = metric ? 2.5 : 5;
    if (exp.level === 'beginner') minInc = metric ? 2.5 : 2.5;
    return Math.max(minInc, roundTo(raw, minInc));
  }

  /**
   * Recommend a prescription for an exercise and return explanation lines.
   * Shape: { weight, reps, sets, unit, action, reasons: string[], scores }
   */
  function recommend(exerciseName, opts) {
    opts = opts || {};
    var name = String(exerciseName || '').trim();
    var metric = !!opts.metric;
    var unit = metric ? 'kg' : 'lb';
    var last = lastSessionForExercise(name);
    var readiness = readinessFromUser();
    var exp = experienceFromUser();
    var reasons = [];
    var repLo = opts.repLow != null ? opts.repLow : 6;
    var repHi = opts.repHigh != null ? opts.repHigh : 10;

    if (!last || last.weight == null) {
      var fallback =
        window.WorkoutPredict && typeof window.WorkoutPredict.predictLoad === 'function'
          ? window.WorkoutPredict.predictLoad(name, { units: metric ? 'metric' : 'imperial' })
          : { weight: metric ? 40 : 95, reps: 8, sets: 3 };
      reasons.push('No recent history — starting guess for calibration.');
      return {
        weight: fallback.weight,
        reps: fallback.reps || 8,
        sets: fallback.sets || 3,
        unit: unit,
        action: 'CALIBRATION',
        reasons: reasons,
        old: null,
        scores: { R: readiness.R, D: null },
      };
    }

    var oldW = last.weight;
    var oldR = last.reps || 8;
    var e1 = epleyE1rm(oldW, oldR, 2) || oldW * 1.25;
    var momentum = last.momentum != null ? last.momentum : 0.55;
    var F_hat = readiness.soreness != null ? clamp(readiness.soreness * 18, 20, 90) : 45;
    var P = exp.level === 'beginner' ? 0.22 : exp.level === 'advanced' ? 0.1 : 0.15;
    if (last.allSetsCompleted === false) P -= 0.05;
    var C = 0.5 * readiness.R + 0.3 * (100 - F_hat) + 0.2 * 70;
    var D =
      100 *
      (0.3 * ((P + 1) / 2) +
        0.25 * (readiness.R / 100) +
        0.25 * (1 - F_hat / 100) +
        0.1 * momentum +
        0.1 * (C / 100));

    var action = 'MAINTAIN';
    var nextW = oldW;
    var nextR = oldR;
    var growthW = oldW;
    var growthR = oldR;
    var overloadAt = overloadThreshold(exp);

    // Double progression estimate for growth (before readiness/fatigue gates).
    if (oldR >= repHi) {
      growthW = oldW + stepSize(e1, metric, momentum, exp);
      growthR = repLo;
    } else {
      growthW = oldW;
      growthR = Math.min(repHi, oldR + 1);
    }

    reasons.push('old weight: ' + oldW + ' × ' + oldR);
    if (last.daysSince != null) {
      reasons.push('Last logged ' + last.daysSince + ' day' + (last.daysSince === 1 ? '' : 's') + ' ago.');
    }
    reasons.push(
      'Training level: ' +
        exp.level +
        (exp.trainingAgeYears != null ? ' · ~' + exp.trainingAgeYears + ' yr lifting' : '') +
        '.'
    );

    if (D >= overloadAt) {
      action = 'OVERLOAD';
      nextW = growthW;
      nextR = growthR;
      if (growthW > oldW) {
        reasons.push('weight update estimate for growth: ' + growthW + ' × ' + growthR);
        reasons.push('Top of rep range hit — load increases, reps reset.');
      } else {
        reasons.push('weight update estimate for growth: ' + growthW + ' × ' + growthR);
        reasons.push('Rep progression toward the top of your range.');
      }
    } else if (D >= 55) {
      action = 'MICRO';
      nextW = oldW;
      nextR = Math.min(repHi, oldR + 1);
      reasons.push('weight update estimate for growth: ' + growthW + ' × ' + growthR);
      reasons.push('Micro day — +1 rep on the first set only.');
    } else if (D >= 40) {
      action = 'MAINTAIN';
      nextW = oldW;
      nextR = oldR;
      reasons.push('weight update estimate for growth: ' + growthW + ' × ' + growthR);
      reasons.push('Holding last successful prescription (D ' + D.toFixed(0) + '/100).');
    } else {
      action = 'REDUCE';
      nextW = roundTo(oldW * 0.95, metric ? 2.5 : 5);
      nextR = oldR;
      reasons.push('weight update estimate for growth: ' + growthW + ' × ' + growthR);
      reasons.push('Recovery day — load pulled back ~5%.');
    }

    var hints = fatigueHints(last, readiness);
    var adjLbs = 0;
    var adjReps = 0;
    hints.forEach(function (h) {
      adjLbs += h.lbs || 0;
      adjReps += h.reps || 0;
      var bits = [];
      if (h.lbs) bits.push((h.lbs > 0 ? '+' : '') + h.lbs + ' lbs');
      if (h.reps) bits.push((h.reps > 0 ? '+' : '') + h.reps + ' reps');
      reasons.push(h.label + ': ' + bits.join(' / '));
    });

    if (adjLbs || adjReps) {
      nextW = roundTo(Math.max(metric ? 2.5 : 5, nextW + adjLbs), metric ? 2.5 : 5);
      nextR = Math.max(1, nextR + adjReps);
    }

    if (!readiness.present) {
      reasons.push('No readiness check-in — using neutral readiness (60/100).');
    } else {
      reasons.push('Readiness today: ' + Math.round(readiness.R) + '/100.');
    }

    return {
      weight: nextW,
      reps: nextR,
      sets: last.sets || 3,
      unit: last.unit || unit,
      action: action,
      reasons: reasons,
      old: { weight: oldW, reps: oldR },
      growth: { weight: growthW, reps: growthR },
      scores: { D: D, R: readiness.R, F: F_hat, P: P, C: C },
    };
  }

  /**
   * Future projection: estimate weeks to hit a goal from recent rate of change.
   */
  function projectGoal(goal) {
    goal = goal || {};
    var type = goal.type || 'lift';
    var start = Number(goal.start);
    var target = Number(goal.target);
    if (!(isFinite(start) && isFinite(target)) || start === target) {
      return { weeks: null, message: 'Need a start and target value.' };
    }
    var delta = target - start;
    var weeklyRate;
    var exp = experienceFromUser();

    if (type === 'bodyweight') {
      // Conservative fat-loss / gain rates (lb/week).
      weeklyRate = delta < 0 ? -1.0 : 0.35;
    } else {
      var pct =
        exp.level === 'beginner' ? 0.01 : exp.level === 'advanced' ? 0.006 : 0.0075;
      if (exp.trainingAgeYears != null && exp.trainingAgeYears >= 5) pct *= 0.85;
      weeklyRate = Math.max(1.25, start * pct);
      if (delta < 0) weeklyRate = -weeklyRate;
    }

    var weeks = Math.ceil(Math.abs(delta / weeklyRate));
    weeks = clamp(weeks, 1, 104);
    var months = (weeks / 4.345).toFixed(1);
    var label =
      type === 'bodyweight'
        ? (delta < 0 ? delta : '+' + delta) + ' lb bodyweight'
        : (goal.lift || 'lift') + ' to ' + target + ' lb';

    return {
      weeks: weeks,
      months: Number(months),
      weeklyRate: Math.round(weeklyRate * 100) / 100,
      label: label,
      message:
        'At a realistic rate of ' +
        (weeklyRate > 0 ? '+' : '') +
        weeklyRate +
        (type === 'bodyweight' ? ' lb/week' : ' lb/week on the bar') +
        ', you reach ' +
        label +
        ' in about ' +
        weeks +
        ' week' +
        (weeks === 1 ? '' : 's') +
        ' (~' +
        months +
        ' months).',
    };
  }

  window.ProgressionEngine = {
    recommend: recommend,
    projectGoal: projectGoal,
    readinessFromUser: readinessFromUser,
    epleyE1rm: epleyE1rm,
  };
})();
