(function () {
  'use strict';

  var LEG_PATTERNS = /\b(leg|squat|lunge|deadlift|calf|hamstring|quad|glute|rdl|hip thrust)\b/i;
  var PUSH_PATTERNS = /\b(bench|press|push|chest|shoulder|tricep|dip|fly|ohp)\b/i;
  var PULL_PATTERNS = /\b(pull|row|lat|back|bicep|chin|curl)\b/i;
  var ARM_PATTERNS = /\b(curl|tricep|bicep|arm|skull)\b/i;
  var CHEST_PATTERNS = /\b(bench|chest|fly|flies|pec|push.?up|pushup|incline|decline|db press|dumbbell press)\b/i;

  /** Named muscle groups Rocky watches for over/under-training. */
  var MUSCLE_GROUPS = [
    {
      id: 'chest',
      label: 'chest',
      pattern:
        /\b(bench|chest|fly|flies|pec|push.?up|pushup|incline|decline|cable crossover|pec deck)\b/i,
      underDays: 10,
      overHits7d: 4,
    },
    {
      id: 'back',
      label: 'back',
      pattern: /\b(pull.?up|chin.?up|lat|row|pulldown|deadlift|back|meadows|seal row)\b/i,
      underDays: 10,
      overHits7d: 4,
    },
    {
      id: 'quads',
      label: 'quads / legs',
      pattern: /\b(squat|leg press|lunge|leg extension|quad|hack squat|split squat|step.?up)\b/i,
      underDays: 10,
      overHits7d: 4,
    },
    {
      id: 'hamstrings',
      label: 'hamstrings',
      pattern: /\b(rdl|romanian|hamstring|leg curl|good morning|nordic)\b/i,
      underDays: 12,
      overHits7d: 4,
    },
    {
      id: 'shoulders',
      label: 'shoulders',
      pattern: /\b(shoulder|ohp|overhead press|lateral raise|rear delt|face pull|military press|arnold)\b/i,
      underDays: 10,
      overHits7d: 5,
    },
    {
      id: 'arms',
      label: 'arms',
      pattern: /\b(curl|tricep|bicep|skull|pushdown|hammer curl|preacher)\b/i,
      underDays: 12,
      overHits7d: 5,
    },
    {
      id: 'glutes',
      label: 'glutes',
      pattern: /\b(hip thrust|glute|kickback|abduct|cable pull.?through)\b/i,
      underDays: 12,
      overHits7d: 4,
    },
    {
      id: 'core',
      label: 'core',
      pattern: /\b(core|ab\b|crunch|plank|hanging leg|cable crunch|pallof)\b/i,
      underDays: 14,
      overHits7d: 6,
    },
  ];

  function sessionDateKey(s) {
    if (s && s.date) return String(s.date).slice(0, 10);
    if (s && s.createdAt) {
      var d = new Date(s.createdAt);
      if (!isNaN(d.getTime())) {
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
        );
      }
    }
    return '';
  }

  function sessionTimestamp(s) {
    if (s && s.createdAt) {
      var t = Date.parse(s.createdAt);
      if (!isNaN(t)) return t;
    }
    var key = sessionDateKey(s);
    if (key) {
      var p = key.split('-');
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  }

  function daysBetween(fromMs, toMs) {
    return Math.floor((toMs - fromMs) / 86400000);
  }

  function exerciseNamesInSession(s) {
    var names = [];
    (s.exercises || []).forEach(function (ex) {
      if (ex && ex.name) names.push(String(ex.name));
    });
    if (s.blocks) {
      (s.blocks || []).forEach(function (blk) {
        (blk.exercises || []).forEach(function (ex) {
          if (ex && ex.name) names.push(String(ex.name));
        });
      });
    }
    return names;
  }

  function sessionMatchesPattern(s, pattern) {
    return exerciseNamesInSession(s).some(function (name) {
      return pattern.test(name);
    });
  }

  function sessionHasChestWork(s) {
    return exerciseNamesInSession(s).some(function (name) {
      return CHEST_PATTERNS.test(name);
    });
  }

  function daysSinceLastMatch(sessions, pattern) {
    var now = Date.now();
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      });
    for (var i = 0; i < sorted.length; i++) {
      if (sessionMatchesPattern(sorted[i], pattern)) {
        return daysBetween(sessionTimestamp(sorted[i]), now);
      }
    }
    return sorted.length ? 999 : null;
  }

  function avgRecentIntensity(sessions, limit) {
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      })
      .slice(0, limit || 5);
    var sum = 0;
    var n = 0;
    sorted.forEach(function (s) {
      var v = parseInt(s.totalIntensity, 10);
      if (!isNaN(v) && v >= 0) {
        sum += v;
        n += 1;
      }
    });
    return n ? sum / n : null;
  }

  function findLastPushSession(sessions) {
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      });
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      if (s.split && /\bpush\b/i.test(String(s.split))) return s;
      if (s.title && /\bpush\b/i.test(String(s.title))) return s;
      if (sessionMatchesPattern(s, PUSH_PATTERNS)) return s;
    }
    return null;
  }

  function hasSeenInfoGuide() {
    try {
      return localStorage.getItem('strongman-info-seen') === '1';
    } catch (e) {
      return false;
    }
  }

  function hasSeenLearnGuide() {
    try {
      return localStorage.getItem('strongman-learn-seen') === '1';
    } catch (e) {
      return false;
    }
  }

  function getUserExperience() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '';
      var u = window.getCurrentUser();
      return u && u.experience ? String(u.experience).toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  function isBeginnerUser() {
    var exp = getUserExperience();
    return !exp || exp === 'beginner';
  }

  function hasConsistentUse(sessions) {
    var list = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(a) - sessionTimestamp(b);
      });
    if (list.length < 3) return false;
    var firstMs = sessionTimestamp(list[0]);
    var lastMs = sessionTimestamp(list[list.length - 1]);
    if (daysBetween(firstMs, lastMs) >= 6) return true;
    var dayKeys = {};
    list.forEach(function (s) {
      var k = sessionDateKey(s);
      if (k) dayKeys[k] = true;
    });
    return Object.keys(dayKeys).length >= 4;
  }

  function normalizeExerciseKey(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseWeight(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(/[^\d.]/g, ''));
    return isNaN(n) || n <= 0 ? null : n;
  }

  function parseReps(v) {
    if (v == null || v === '') return null;
    var n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return isNaN(n) || n <= 0 ? null : n;
  }

  /** Best working-set load proxy for an exercise entry. */
  function exercisePeakLoad(ex) {
    if (!ex) return null;
    var peaks = [];
    var weights = Array.isArray(ex.setWeights) ? ex.setWeights : [];
    var reps = Array.isArray(ex.setReps) ? ex.setReps : [];
    var i;
    for (i = 0; i < Math.max(weights.length, reps.length); i++) {
      var w = parseWeight(weights[i] != null ? weights[i] : ex.weight);
      var r = parseReps(reps[i] != null ? reps[i] : ex.reps);
      if (w != null) peaks.push(w * (r != null ? Math.min(r, 12) : 1));
    }
    if (!peaks.length) {
      var w0 = parseWeight(ex.weight);
      if (w0 == null) return null;
      var r0 = parseReps(ex.reps) || 1;
      return w0 * Math.min(r0, 12);
    }
    return Math.max.apply(null, peaks);
  }

  function collectExerciseHistory(sessions) {
    var map = {};
    (sessions || []).forEach(function (s) {
      var ts = sessionTimestamp(s);
      var day = sessionDateKey(s);
      var list = [];
      (s.exercises || []).forEach(function (ex) {
        list.push(ex);
      });
      (s.blocks || []).forEach(function (blk) {
        (blk.exercises || []).forEach(function (ex) {
          list.push(ex);
        });
      });
      list.forEach(function (ex) {
        if (!ex || !ex.name) return;
        var key = normalizeExerciseKey(ex.name);
        if (!key || key.length < 3) return;
        var load = exercisePeakLoad(ex);
        if (load == null) return;
        if (!map[key]) map[key] = { name: String(ex.name), samples: [] };
        map[key].samples.push({ ts: ts, day: day, load: load });
      });
    });
    Object.keys(map).forEach(function (key) {
      map[key].samples.sort(function (a, b) {
        return a.ts - b.ts;
      });
    });
    return map;
  }

  /**
   * Flag lifts that stayed flat/down across the last 3+ logged performances
   * over at least ~10 days (enough runway to expect overload).
   */
  function detectStalledProgressiveOverload(sessions) {
    var history = collectExerciseHistory(sessions);
    var stalled = [];
    Object.keys(history).forEach(function (key) {
      var samples = history[key].samples;
      if (samples.length < 3) return;
      var recent = samples.slice(-4);
      if (recent.length < 3) return;
      var spanDays = daysBetween(recent[0].ts, recent[recent.length - 1].ts);
      if (spanDays < 10) return;
      var first = recent[0].load;
      var last = recent[recent.length - 1].load;
      if (!(first > 0)) return;
      var change = (last - first) / first;
      var mid = recent[Math.floor(recent.length / 2)].load;
      var flatish = change <= 0.02 && mid <= first * 1.03;
      if (flatish || change < -0.03) {
        stalled.push({
          name: history[key].name,
          changePct: Math.round(change * 100),
          sessions: recent.length,
          days: spanDays,
        });
      }
    });
    stalled.sort(function (a, b) {
      return a.changePct - b.changePct;
    });
    return stalled;
  }

  function analyzeMuscleBalance(sessions) {
    var now = Date.now();
    var weekAgo = now - 7 * 86400000;
    var over = [];
    var under = [];
    MUSCLE_GROUPS.forEach(function (g) {
      var hits7 = 0;
      var lastTs = 0;
      (sessions || []).forEach(function (s) {
        if (!sessionMatchesPattern(s, g.pattern)) return;
        var ts = sessionTimestamp(s);
        if (ts >= weekAgo) hits7 += 1;
        if (ts > lastTs) lastTs = ts;
      });
      if (hits7 >= g.overHits7d) {
        over.push({ label: g.label, hits: hits7, id: g.id });
      }
      if (lastTs > 0) {
        var gap = daysBetween(lastTs, now);
        if (gap >= g.underDays) {
          under.push({ label: g.label, days: gap, id: g.id });
        }
      } else if ((sessions || []).length >= 4) {
        // Trained enough overall that a complete miss still counts as under.
        under.push({ label: g.label, days: 999, id: g.id });
      }
    });
    over.sort(function (a, b) {
      return b.hits - a.hits;
    });
    under.sort(function (a, b) {
      return b.days - a.days;
    });
    return { over: over, under: under };
  }

  function buildCoachingCallouts(sessions, opts) {
    opts = opts || {};
    var callouts = [];
    var list = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      });
    var beginner = isBeginnerUser();
    var limit = opts.limit || 6;

    if (beginner) {
      callouts.push({
        text: 'New to working out? Learn here',
        tone: 'neutral',
        linkHref: '/learn',
        linkLabel: 'Beginner guide',
      });
    }

    if (!list.length) {
      if (beginner) {
        callouts.push({
          text: 'No sessions yet — ask Rocky for a simple machine workout and hit Start workout on Home.',
          tone: 'neutral',
          linkHref: '/generate',
          linkLabel: 'Ask Rocky',
        });
        return callouts.slice(0, limit);
      }
      if (!hasSeenInfoGuide()) {
        callouts.push({
          text: 'Woah there — you look new here. Head to the info page and learn what to do on Strongman AI.',
          tone: 'neutral',
          linkHref: '/info',
          linkLabel: 'Open the guide',
        });
      } else {
        callouts.push({
          text: 'No workouts logged yet. The barbell is getting lonely — go say hi.',
          tone: 'tease',
        });
      }
      return callouts.slice(0, limit);
    }

    if (!hasConsistentUse(list)) {
      if (beginner) {
        callouts.push({
          text: 'Keep logging — after a week of consistent training, Rocky’s tips get sharper. Stick with machines and cables for now.',
          tone: 'neutral',
          linkHref: hasSeenLearnGuide() ? '/generate' : '/learn',
          linkLabel: hasSeenLearnGuide() ? 'Ask Rocky' : 'Beginner guide',
        });
      } else {
        callouts.push({
          text: 'You seem new here — better criticism will come after a week of consistent use.',
          tone: 'neutral',
        });
      }
      return callouts.slice(0, limit);
    }

    var balance = analyzeMuscleBalance(list);
    if (balance.over.length) {
      var o = balance.over[0];
      callouts.push({
        text:
          'You hit ' +
          o.label +
          ' ' +
          o.hits +
          ' times in the last 7 days — that’s overworking the area. Give it more recovery before you bury it again.',
        tone: 'warn',
      });
    }
    if (balance.under.length) {
      var u = balance.under[0];
      var gapLabel = u.days >= 900 ? 'basically ever' : u.days + ' days';
      callouts.push({
        text:
          u.days >= 900
            ? 'Your logs barely touch ' + u.label + '. Under-training that area will catch up with you.'
            : "You haven't trained " + u.label + ' in ' + gapLabel + '. That’s under-training — slot it back in.',
        tone: 'tease',
      });
      if (balance.under.length > 1 && callouts.length < limit) {
        var u2 = balance.under[1];
        if (u2.days < 900 && u2.days >= 10) {
          callouts.push({
            text: u2.label + ' is also quiet (' + u2.days + ' days). Balance the split.',
            tone: 'tease',
          });
        }
      }
    }

    var stalled = detectStalledProgressiveOverload(list);
    if (stalled.length) {
      var top = stalled[0];
      var verb =
        top.changePct < 0
          ? 'slipped about ' + Math.abs(top.changePct) + '%'
          : 'hasn’t moved';
      callouts.push({
        text:
          top.name +
          ' ' +
          verb +
          ' across your last ' +
          top.sessions +
          ' logs (~' +
          top.days +
          ' days). No progressive overload — add a little weight, a rep, or tighten rest.',
        tone: 'warn',
      });
      if (stalled.length > 1 && callouts.length < limit) {
        callouts.push({
          text:
            stalled
              .slice(1, 3)
              .map(function (s) {
                return s.name;
              })
              .join(' and ') + ' look stuck too. Chase small week-to-week wins.',
          tone: 'tease',
        });
      }
    }

    var legDays = daysSinceLastMatch(list, LEG_PATTERNS);
    if (legDays != null && legDays >= 10 && !balance.under.some(function (x) {
      return x.id === 'quads' || x.id === 'hamstrings';
    })) {
      callouts.push({
        text: "You haven't trained legs in " + legDays + ' days. Talk about a bro split.',
        tone: 'tease',
      });
    }

    var lastPush = findLastPushSession(list);
    if (lastPush && !sessionHasChestWork(lastPush)) {
      var pushLabel = lastPush.split && /\bpush\b/i.test(String(lastPush.split)) ? 'push day' : 'push session';
      callouts.push({
        text:
          'Your last ' +
          pushLabel +
          " didn't include any chest work — bench, flies, or push-ups would balance things out.",
        tone: 'tease',
      });
    }

    var avgIntensity = avgRecentIntensity(list, 4);
    if (avgIntensity != null && avgIntensity >= 78) {
      callouts.push({
        text: beginner
          ? "You're pushing pretty hard — leave 1–2 reps in the tank and keep form clean."
          : "You're pushing too hard during your workouts! Slow down before you get injured!",
        tone: 'warn',
      });
    } else if (avgIntensity != null && avgIntensity <= 35 && list.length >= 3) {
      callouts.push({
        text: beginner
          ? 'Sessions have been light lately — when form feels solid, nudge the weight up a little.'
          : 'Your last few sessions were softer than a yoga mat. Time to turn up the heat.',
        tone: 'tease',
      });
    }

    var lastSessionMs = sessionTimestamp(list[0]);
    var daysSinceWorkout = daysBetween(lastSessionMs, Date.now());
    if (daysSinceWorkout >= 5) {
      callouts.push({
        text:
          daysSinceWorkout +
          ' days without a workout? Your muscles filed a missing persons report.',
        tone: 'tease',
      });
    }

    var weekSessions = list.filter(function (s) {
      return sessionTimestamp(s) >= Date.now() - 7 * 86400000;
    });
    var armOnlyWeek =
      weekSessions.length >= 2 &&
      weekSessions.every(function (s) {
        var names = exerciseNamesInSession(s).join(' ');
        return ARM_PATTERNS.test(names) && !LEG_PATTERNS.test(names) && !PUSH_PATTERNS.test(names);
      });
    if (armOnlyWeek) {
      callouts.push({
        text: 'Arms every session this week? Even your sleeves are confused.',
        tone: 'tease',
      });
    }

    var pushDays = daysSinceLastMatch(list, PUSH_PATTERNS);
    var pullDays = daysSinceLastMatch(list, PULL_PATTERNS);
    if (pushDays != null && pullDays != null && pushDays <= 3 && pullDays >= 14) {
      callouts.push({
        text: 'All push, no pull — enjoy that hunchback cosplay.',
        tone: 'tease',
      });
    }

    var WS = window.WorkoutSplit;
    if (WS && WS.hasUserConfigured && WS.hasUserConfigured()) {
      var state = WS.load();
      var todayIdx = WS.mondayIndexFromDate(new Date());
      var todayName = (state.days && state.days[todayIdx]) || '';
      if (todayName && !/rest/i.test(todayName)) {
        var todayKey = sessionDateKey({ createdAt: new Date().toISOString() });
        var trainedToday = list.some(function (s) {
          return sessionDateKey(s) === todayKey;
        });
        if (!trainedToday) {
          callouts.push({
            text: 'Today is ' + todayName + ' on your split. The gym is waiting.',
            tone: 'neutral',
          });
        }
      }
    }

    if (!callouts.length) {
      callouts.push({
        text: "You're showing up and training smart. Rocky approves — for now.",
        tone: 'neutral',
      });
    }

    return callouts.slice(0, limit);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCalloutHtml(callout, compact) {
    var tone = callout.tone || 'neutral';
    var linkHtml = callout.linkHref
      ? '<a href="' +
        escapeHtml(callout.linkHref) +
        '" class="' +
        (compact ? 'wd-coach-insight-link' : 'dash-roast-link') +
        '">' +
        escapeHtml(callout.linkLabel || 'Learn more') +
        ' →</a>'
      : '';
    if (compact) {
      return (
        '<article class="wd-coach-insight wd-coach-insight--' +
        tone +
        '" role="listitem"><p class="wd-coach-insight-text">' +
        escapeHtml(callout.text) +
        '</p>' +
        linkHtml +
        '</article>'
      );
    }
    return null;
  }

  function renderInto(container, sessions, opts) {
    opts = opts || {};
    if (!container) return;
    var callouts = buildCoachingCallouts(sessions, opts);
    if (opts.compact) {
      container.innerHTML =
        '<p class="wd-coach-insights-label">Rocky noticed</p>' +
        '<div class="wd-coach-insights-list" role="list">' +
        callouts
          .map(function (c) {
            return renderCalloutHtml(c, true);
          })
          .join('') +
        '</div>';
      return;
    }
    container.innerHTML = '';
    callouts.forEach(function (c) {
      var tone = c.tone || 'neutral';
      var article = document.createElement('article');
      article.className = 'dash-roast-card dash-roast-card--' + tone;
      article.setAttribute('role', 'listitem');
      var icon =
        tone === 'warn'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
          : tone === 'tease'
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.2 3.6L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.4L12 3z"/></svg>';
      var linkHtml = c.linkHref
        ? '<a href="' +
          escapeHtml(c.linkHref) +
          '" class="dash-roast-link">' +
          escapeHtml(c.linkLabel || 'Learn more') +
          ' →</a>'
        : '';
      article.innerHTML =
        '<span class="dash-roast-icon" aria-hidden="true">' +
        icon +
        '</span><div class="dash-roast-copy"><p class="dash-roast-text">' +
        escapeHtml(c.text) +
        '</p>' +
        linkHtml +
        '</div>';
      container.appendChild(article);
    });
  }

  window.RockyCoachingInsights = {
    buildCallouts: buildCoachingCallouts,
    renderInto: renderInto,
    hasConsistentUse: hasConsistentUse,
    isBeginnerUser: isBeginnerUser,
    analyzeMuscleBalance: analyzeMuscleBalance,
    detectStalledProgressiveOverload: detectStalledProgressiveOverload,
  };
})();
