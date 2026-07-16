/**
 * First-login-of-the-day training plan for the Home dashboard.
 * Uses split day, sport schedule, coach memory / timeline injuries, and balance cues.
 */
(function () {
  'use strict';

  var SEEN_KEY_BASE = 'strongman-daily-plan-seen';
  var WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var BODY_AVOID = [
    {
      parts: /\b(knee|knees)\b/i,
      label: 'knees',
      pattern: /\b(squat|lunge|leg press|leg extension|jump|box jump|step.?up|pistol)\b/i,
      swap: 'Favor upper-body or pain-free machine work; keep knee bend shallow.',
    },
    {
      parts: /\b(shoulder|shoulders)\b/i,
      label: 'shoulders',
      pattern: /\b(ohp|overhead|military|shoulder press|lateral raise|upright row|snatch|jerk)\b/i,
      swap: 'Skip pressing overhead — rows, pushdowns, and light laterals only if pain-free.',
    },
    {
      parts: /\b(lower back|low back|lumbar)\b/i,
      label: 'lower back',
      pattern: /\b(deadlift|rdl|good morning|bent.?over row|sit.?up|hyperextension)\b/i,
      swap: 'Keep the spine quiet — prefer machines, chest-supported rows, and short sessions.',
    },
    {
      parts: /\b(back)\b/i,
      label: 'back',
      pattern: /\b(deadlift|row|pulldown|pull.?up|chin)\b/i,
      swap: 'Tone down pulling volume; leave heavy rows for later in the week.',
    },
    {
      parts: /\b(elbow|elbows)\b/i,
      label: 'elbows',
      pattern: /\b(curl|tricep|skull|pushdown|extension|dip)\b/i,
      swap: 'Go easy on isolation elbows — use neutral grips and stop shy of pain.',
    },
    {
      parts: /\b(wrist|wrists)\b/i,
      label: 'wrists',
      pattern: /\b(curl|front squat|clean|press)\b/i,
      swap: 'Neutral-grip or machine options beat max wrist extension today.',
    },
    {
      parts: /\b(hip|hips|groin)\b/i,
      label: 'hips',
      pattern: /\b(squat|lunge|hip thrust|deadlift|kickback|abduct)\b/i,
      swap: 'Reduce deep hip flexion — shorter ROM or swap to upper body.',
    },
    {
      parts: /\b(ankle|ankles|achilles)\b/i,
      label: 'ankles',
      pattern: /\b(calf|jump|sprint|lunge|squat)\b/i,
      swap: 'Skip impact and deep ankle demand; seated machines are safer.',
    },
    {
      parts: /\b(hamstring|hamstrings)\b/i,
      label: 'hamstrings',
      pattern: /\b(rdl|romanian|leg curl|good morning|nordic|deadlift)\b/i,
      swap: 'Leave hinging light or swap for quads/upper if the hammies are angry.',
    },
    {
      parts: /\b(quad|quads)\b/i,
      label: 'quads',
      pattern: /\b(squat|leg press|leg extension|lunge|hack)\b/i,
      swap: 'Dial back quad volume — posterior chain or push/pull focus instead.',
    },
    {
      parts: /\b(chest|pec)\b/i,
      label: 'chest',
      pattern: /\b(bench|chest|fly|push.?up|dip)\b/i,
      swap: 'Skip heavy pressing — pull and legs can carry the day.',
    },
    {
      parts: /\b(neck)\b/i,
      label: 'neck',
      pattern: /\b(shrug|olympic|clean|snatch)\b/i,
      swap: 'No shrugs or max-effort olympic pulls while the neck is irritated.',
    },
  ];

  function userSuffix() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '_guest';
      var u = window.getCurrentUser();
      return u && u.id != null ? '_u' + u.id : '_guest';
    } catch (e) {
      return '_guest';
    }
  }

  function localDateKey(d) {
    d = d || new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function seenKey() {
    return SEEN_KEY_BASE + userSuffix();
  }

  function hasSeenToday() {
    try {
      return localStorage.getItem(seenKey()) === localDateKey();
    } catch (e) {
      return false;
    }
  }

  function markSeenToday() {
    try {
      localStorage.setItem(seenKey(), localDateKey());
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function collectInjuryNotes() {
    var notes = [];
    var cutoff = Date.now() - 21 * 86400000;

    if (window.CoachMemory && typeof window.CoachMemory.load === 'function') {
      window.CoachMemory.load().forEach(function (item) {
        if (!item) return;
        var at = item.at ? Date.parse(item.at) : Date.now();
        if (!isNaN(at) && at < cutoff) return;
        var sticky =
          item.id === 'injury' ||
          item.id === 'sore' ||
          item.id === 'deload' ||
          item.id === 'sick' ||
          item.id === 'fatigue' ||
          item.id === 'poor_sleep';
        if (!sticky) return;
        notes.push({
          source: 'memory',
          id: item.id,
          label: item.label || 'Issue',
          bodyPart: item.bodyPart || '',
          snippet: item.snippet || '',
          at: at,
        });
      });
    }

    if (window.TrainingTimeline && typeof window.TrainingTimeline.loadCustomEvents === 'function') {
      window.TrainingTimeline.loadCustomEvents().forEach(function (ev) {
        if (!ev) return;
        if (ev.type !== 'injury' && ev.type !== 'deload' && ev.type !== 'problem') return;
        var at = ev.at || 0;
        if (at && at < cutoff) return;
        notes.push({
          source: 'timeline',
          id: ev.type,
          label: ev.title || 'Timeline note',
          bodyPart: '',
          snippet: ev.detail || '',
          at: at,
        });
      });
    }

    return notes;
  }

  function matchAvoidRules(notes) {
    var hits = [];
    var seen = {};
    notes.forEach(function (n) {
      var blob = [n.bodyPart, n.label, n.snippet].join(' ');
      BODY_AVOID.forEach(function (rule) {
        if (!rule.parts.test(blob)) return;
        if (seen[rule.label]) return;
        seen[rule.label] = true;
        hits.push(rule);
      });
    });
    return hits;
  }

  function exerciseConflicts(exercises, avoidRules) {
    var flagged = [];
    (exercises || []).forEach(function (ex) {
      var name = ex && ex.name ? String(ex.name) : '';
      if (!name) return;
      avoidRules.forEach(function (rule) {
        if (rule.pattern.test(name)) {
          flagged.push({ name: name, reason: rule.label });
        }
      });
    });
    return flagged;
  }

  function dayNameSuggestion(dayLabel) {
    var d = String(dayLabel || '').toLowerCase();
    if (/rest/.test(d)) {
      return {
        focus: 'Rest / recovery',
        blurb: 'Walk, mobility, or full rest. Save the heavy work for a training day.',
      };
    }
    if (/push/.test(d)) {
      return {
        focus: 'Push (chest, shoulders, triceps)',
        blurb: 'Pressing + triceps. Leave 1–2 reps in the tank.',
      };
    }
    if (/pull/.test(d)) {
      return {
        focus: 'Pull (back, rear delts, biceps)',
        blurb: 'Rows, pulldowns, and curls. Chase a strong back contraction.',
      };
    }
    if (/leg/.test(d) || /lower/.test(d)) {
      return {
        focus: 'Legs',
        blurb: 'Squat/hinge pattern plus accessories. Warm up thoroughly.',
      };
    }
    if (/arm/.test(d)) {
      return {
        focus: 'Arms',
        blurb: 'Biceps and triceps volume — keep ego weight for compound days.',
      };
    }
    if (/chest/.test(d) && /back/.test(d)) {
      return {
        focus: 'Chest + back',
        blurb: 'Pair a press with a pull each supersetted block if you like.',
      };
    }
    if (/chest/.test(d)) {
      return { focus: 'Chest', blurb: 'Horizontal (and optional incline) pressing plus flies.' };
    }
    if (/back/.test(d)) {
      return { focus: 'Back', blurb: 'Vertical + horizontal pulls. Keep the spine braced.' };
    }
    if (/full.?body|upper|lower/.test(d)) {
      return { focus: dayLabel, blurb: 'Hit the big patterns on the menu, then accessories.' };
    }
    return {
      focus: dayLabel || 'Training day',
      blurb: 'Follow your split plan and nudge loads when the last set still looks clean.',
    };
  }

  function buildPlan(user) {
    user = user || (typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null);
    var now = new Date();
    var weekday = WEEKDAY_LONG[now.getDay()];
    var WS = window.WorkoutSplit;
    var AC = window.AthleteContext;
    var splitConfigured = !!(WS && WS.hasUserConfigured && WS.hasUserConfigured());
    var splitState = splitConfigured ? WS.load() : null;
    var dayIdx = WS && WS.mondayIndexFromDate ? WS.mondayIndexFromDate(now) : (now.getDay() + 6) % 7;
    var dayLetter = WS && WS.dayLetters ? WS.dayLetters[dayIdx] : '';
    var dayLabel =
      splitState && splitState.days && splitState.days[dayIdx]
        ? String(splitState.days[dayIdx])
        : '';
    var restDay = splitConfigured && WS.isRestDay ? WS.isRestDay(splitState, now) : /rest/i.test(dayLabel);
    var exercises =
      splitConfigured && WS.exercisesForDate ? WS.exercisesForDate(splitState, now) : [];
    var sessionTitle =
      splitConfigured && WS.defaultSessionTitle
        ? WS.defaultSessionTitle(splitState, now)
        : dayLabel || 'Today’s session';
    var programName =
      splitState && splitState.programName ? String(splitState.programName).trim() : '';

    var sportHint = AC && user && AC.getTodayTrainingHint ? AC.getTodayTrainingHint(user) : null;
    var suggestion = dayNameSuggestion(dayLabel || (sportHint && sportHint.label) || '');
    var injuries = collectInjuryNotes();
    var avoidRules = matchAvoidRules(injuries);
    var conflicts = exerciseConflicts(exercises, avoidRules);

    var modifiers = [];
    if (sportHint) {
      if (sportHint.kind === 'game') {
        modifiers.push({
          tone: 'warn',
          text: sportHint.label + ' — ' + sportHint.hint,
        });
      } else if (sportHint.kind === 'practice') {
        modifiers.push({
          tone: 'neutral',
          text: sportHint.label + ' — ' + sportHint.hint,
        });
      } else if (sportHint.kind === 'rest') {
        modifiers.push({
          tone: 'neutral',
          text: sportHint.label + ' — ' + sportHint.hint,
        });
      } else if (sportHint.hint) {
        modifiers.push({ tone: 'neutral', text: sportHint.hint });
      }
    }

    injuries.forEach(function (n) {
      var bit = n.label;
      if (n.bodyPart) bit += ' (' + n.bodyPart + ')';
      if (n.snippet) bit += ' — “' + n.snippet + '”';
      modifiers.push({
        tone: n.id === 'injury' || n.id === 'sick' ? 'warn' : 'tease',
        text: bit,
      });
    });

    avoidRules.forEach(function (rule) {
      modifiers.push({ tone: 'warn', text: rule.swap });
    });

    if (window.RockyCoachingInsights && window.RockyCoachingInsights.analyzeMuscleBalance) {
      var WL = window.WorkoutLog;
      var sessions = WL && typeof WL.getSessions === 'function' ? WL.getSessions() : [];
      if (sessions.length >= 3) {
        var bal = window.RockyCoachingInsights.analyzeMuscleBalance(sessions);
        if (bal.over && bal.over[0]) {
          modifiers.push({
            tone: 'warn',
            text:
              bal.over[0].label +
              ' was hit hard this week (' +
              bal.over[0].hits +
              '×). Prefer other work or keep volume tiny.',
          });
        }
        if (bal.under && bal.under[0] && bal.under[0].days < 900 && bal.under[0].days >= 10) {
          if (!restDay) {
            modifiers.push({
              tone: 'tease',
              text:
                bal.under[0].label +
                ' is under-trained (' +
                bal.under[0].days +
                ' days). If today’s split allows, feed it.',
            });
          }
        }
      }
    }

    var primaryAction = restDay ? 'rest' : 'train';
    if (sportHint && sportHint.kind === 'game') primaryAction = 'light';
    if (injuries.some(function (n) {
      return n.id === 'injury' || n.id === 'sick';
    })) {
      if (primaryAction === 'train') primaryAction = 'modified';
    }

    var headline;
    if (!splitConfigured) {
      headline = 'Set up your split so Rocky can prescribe today’s work.';
    } else if (restDay) {
      headline = 'Rest day on your split — recover well.';
    } else if (primaryAction === 'light') {
      headline = 'Keep today’s lift light around competition.';
    } else if (primaryAction === 'modified') {
      headline = 'Train smart — adjust around what you’re dealing with.';
    } else {
      headline = 'Today is ' + (dayLabel || sessionTitle) + ' on your split.';
    }

    return {
      weekday: weekday,
      dayLetter: dayLetter,
      dayLabel: dayLabel || (restDay ? 'Rest' : 'Open day'),
      sessionTitle: sessionTitle,
      programName: programName,
      restDay: restDay,
      exercises: exercises,
      suggestion: suggestion,
      sportHint: sportHint,
      injuries: injuries,
      conflicts: conflicts,
      modifiers: modifiers.slice(0, 8),
      primaryAction: primaryAction,
      headline: headline,
      splitConfigured: splitConfigured,
      dateKey: localDateKey(now),
    };
  }

  function exerciseLine(ex) {
    var bits = [ex.name];
    if (ex.sets || ex.reps) {
      bits.push([ex.sets || '?', '×', ex.reps || '?'].join(''));
    }
    return bits.join(' · ');
  }

  function renderCardHtml(plan) {
    var exList = '';
    if (plan.exercises && plan.exercises.length) {
      var shown = plan.exercises.slice(0, 8);
      exList =
        '<ul class="dash-daily-ex">' +
        shown
          .map(function (ex) {
            var conflict = (plan.conflicts || []).some(function (c) {
              return c.name === ex.name;
            });
            return (
              '<li class="dash-daily-ex-item' +
              (conflict ? ' dash-daily-ex-item--caution' : '') +
              '">' +
              escapeHtml(exerciseLine(ex)) +
              (conflict ? ' <span class="dash-daily-caution">modify</span>' : '') +
              '</li>'
            );
          })
          .join('') +
        (plan.exercises.length > shown.length
          ? '<li class="dash-daily-ex-more">+' +
            (plan.exercises.length - shown.length) +
            ' more on your split</li>'
          : '') +
        '</ul>';
    } else if (plan.splitConfigured && !plan.restDay) {
      exList =
        '<p class="dash-daily-ex-fallback">' +
        escapeHtml(plan.suggestion.blurb) +
        ' Add exercises to this day in Customize → Split for a full checklist.</p>';
    } else if (!plan.splitConfigured) {
      exList =
        '<p class="dash-daily-ex-fallback">No split on file yet. Rocky can still coach once you set training days.</p>';
    }

    var mods =
      plan.modifiers && plan.modifiers.length
        ? '<ul class="dash-daily-mods">' +
          plan.modifiers
            .map(function (m) {
              return (
                '<li class="dash-daily-mod dash-daily-mod--' +
                escapeHtml(m.tone || 'neutral') +
                '">' +
                escapeHtml(m.text) +
                '</li>'
              );
            })
            .join('') +
          '</ul>'
        : '';

    var ctaPrimary =
      plan.primaryAction === 'rest'
        ? '<button type="button" class="dash-daily-btn dash-daily-btn--ghost" data-daily-dismiss>Got it</button>'
        : '<button type="button" class="dash-daily-btn dash-daily-btn--primary" data-daily-start>' +
          (plan.primaryAction === 'light' || plan.primaryAction === 'modified'
            ? 'Start adjusted session'
            : 'Start today’s workout') +
          '</button>';

    return (
      '<article class="dash-daily-card" role="dialog" aria-labelledby="dash-daily-title">' +
      '<div class="dash-daily-top">' +
      '<p class="dash-daily-kicker">Today’s plan · ' +
      escapeHtml(plan.weekday) +
      '</p>' +
      '<button type="button" class="dash-daily-dismiss" data-daily-dismiss aria-label="Dismiss today’s plan">×</button>' +
      '</div>' +
      '<h2 class="dash-daily-title" id="dash-daily-title">' +
      escapeHtml(plan.headline) +
      '</h2>' +
      '<div class="dash-daily-chips">' +
      (plan.programName
        ? '<span class="dash-daily-chip">' + escapeHtml(plan.programName) + '</span>'
        : '') +
      '<span class="dash-daily-chip dash-daily-chip--accent">' +
      escapeHtml(plan.dayLabel) +
      (plan.dayLetter ? ' · ' + escapeHtml(plan.dayLetter) : '') +
      '</span>' +
      '<span class="dash-daily-chip">' +
      escapeHtml(plan.suggestion.focus) +
      '</span>' +
      '</div>' +
      (!plan.restDay
        ? '<p class="dash-daily-blurb">' + escapeHtml(plan.suggestion.blurb) + '</p>'
        : '<p class="dash-daily-blurb">Use the day for sleep, food, and light movement. Don’t force volume.</p>') +
      exList +
      mods +
      '<div class="dash-daily-actions">' +
      ctaPrimary +
      (plan.primaryAction !== 'rest'
        ? '<button type="button" class="dash-daily-btn dash-daily-btn--ghost" data-daily-dismiss>Later</button>'
        : '') +
      (!plan.splitConfigured
        ? '<a class="dash-daily-btn dash-daily-btn--link" href="/customize">Set up split →</a>'
        : '') +
      '</div></article>'
    );
  }

  function bindCard(root, plan, opts) {
    opts = opts || {};
    root.querySelectorAll('[data-daily-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        markSeenToday();
        root.hidden = true;
        root.innerHTML = '';
        if (typeof opts.onDismiss === 'function') opts.onDismiss(plan);
      });
    });
    root.querySelectorAll('[data-daily-start]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        markSeenToday();
        root.hidden = true;
        root.innerHTML = '';
        if (typeof opts.onStart === 'function') {
          opts.onStart(plan);
          return;
        }
        try {
          sessionStorage.setItem('strongman-apply-today-routine', '1');
        } catch (e) {}
        window.location.href = '/create';
      });
    });
  }

  function mount(root, opts) {
    opts = opts || {};
    if (!root) return null;
    if (!opts.force && hasSeenToday()) {
      root.hidden = true;
      root.innerHTML = '';
      return null;
    }
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var plan = buildPlan(user);
    root.hidden = false;
    root.innerHTML = renderCardHtml(plan);
    bindCard(root, plan, opts);
    return plan;
  }

  function updateStartHint(el, plan) {
    if (!el) return;
    plan = plan || buildPlan();
    if (plan.restDay) {
      el.textContent = 'Rest day on your split';
      return;
    }
    if (plan.sportHint && plan.sportHint.kind === 'game') {
      el.textContent = plan.sportHint.hint;
      return;
    }
    if (plan.dayLabel && plan.dayLabel !== 'Open day') {
      el.textContent = plan.dayLabel + (plan.primaryAction === 'modified' ? ' · train careful' : ' · ready when you are');
      return;
    }
    if (plan.sportHint && plan.sportHint.hint) {
      el.textContent = plan.sportHint.hint;
    }
  }

  window.DailyPlan = {
    buildPlan: buildPlan,
    hasSeenToday: hasSeenToday,
    markSeenToday: markSeenToday,
    mount: mount,
    updateStartHint: updateStartHint,
  };
})();
