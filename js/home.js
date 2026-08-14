(function () {
  var welcomeEl = document.getElementById('home-welcome-title');
  var planDateEl = document.getElementById('dash-plan-date');
  var athleteContextEl = document.getElementById('dash-athlete-context');
  var countdownsEl = document.getElementById('dash-countdowns');
  var sportTipEl = document.getElementById('dash-sport-tip');
  var startBtn = document.getElementById('dash-start-workout');
  var startHintEl = document.getElementById('dash-start-hint');
  var workoutTitleEl = document.getElementById('dash-comp-workout-title');
  var coachTip1TitleEl = document.getElementById('dash-coach-tip-1-title');
  var coachTip1BodyEl = document.getElementById('dash-coach-tip-1-body');
  var coachTip2TitleEl = document.getElementById('dash-coach-tip-2-title');
  var coachTip2BodyEl = document.getElementById('dash-coach-tip-2-body');
  var dailyRootEl = document.getElementById('dash-daily-root');
  var rockyBannerEl = document.getElementById('dash-rocky-banner');
  var heroDurationEl = document.getElementById('dash-hero-duration');
  var weekStripEl = document.getElementById('dash-week-strip');
  var ringFillEl = document.getElementById('dash-week-ring-fill');
  var ringPctEl = document.getElementById('dash-week-ring-pct');
  var statusTitleEl = document.getElementById('dash-status-title');
  var statusSubEl = document.getElementById('dash-status-sub');
  var statusPillEl = document.getElementById('dash-status-pill');
  var RING_C = 2 * Math.PI * 32;

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

  function countSetsInSession(s) {
    var total = 0;
    function countEx(ex) {
      if (!ex) return;
      var sw = Array.isArray(ex.setWeights) ? ex.setWeights.length : 0;
      var sr = Array.isArray(ex.setReps) ? ex.setReps.length : 0;
      if (sw || sr) total += Math.max(sw, sr);
      else if (ex.sets) {
        var n = parseInt(ex.sets, 10);
        if (!isNaN(n) && n > 0) total += n;
        else if (ex.reps || ex.weight) total += 1;
      } else if (ex.reps || ex.weight) total += 1;
    }
    (s.exercises || []).forEach(countEx);
    (s.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(countEx);
    });
    return total;
  }

  function countExercisesInSession(s) {
    var n = (s.exercises || []).length;
    (s.blocks || []).forEach(function (blk) {
      n += (blk.exercises || []).length;
    });
    return n;
  }

  function weeklyGoalTarget() {
    var WS = window.WorkoutSplit;
    if (WS && typeof WS.hasUserConfigured === 'function' && WS.hasUserConfigured()) {
      var state = typeof WS.load === 'function' ? WS.load() : null;
      var days = (state && state.days) || [];
      var training = days.filter(function (d) {
        return d && !/rest/i.test(String(d));
      });
      if (training.length) return Math.min(6, Math.max(2, training.length));
    }
    return 4;
  }

  function computeStats(sessions) {
    var now = new Date();
    var weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    var weekMs = weekAgo.getTime();
    var weekCount = 0;
    var weekSets = 0;
    var dayKeys = {};

    (sessions || []).forEach(function (s) {
      var ts = sessionTimestamp(s);
      var key = sessionDateKey(s);
      if (key) dayKeys[key] = true;
      if (ts >= weekMs) {
        weekCount += 1;
        weekSets += countSetsInSession(s);
      }
    });

    var streak = 0;
    var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (var i = 0; i < 365; i++) {
      var k =
        cursor.getFullYear() +
        '-' +
        String(cursor.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(cursor.getDate()).padStart(2, '0');
      if (dayKeys[k]) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      } else {
        break;
      }
    }

    return {
      weekCount: weekCount,
      streak: streak,
      weekSets: weekSets,
      totalSessions: (sessions || []).length,
      weekGoal: weeklyGoalTarget(),
      dayKeys: dayKeys,
    };
  }

  function formatRelativeDay(ts) {
    if (!ts) return '';
    var now = new Date();
    var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var startThat = new Date(ts);
    startThat = new Date(startThat.getFullYear(), startThat.getMonth(), startThat.getDate()).getTime();
    var diffDays = Math.round((startToday - startThat) / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function sessionDisplayTitle(s) {
    if (!s) return 'Last session';
    var title = (s.title || s.splitName || s.split || '').trim();
    if (title) return title;
    var n = countExercisesInSession(s);
    if (n) return n + (n === 1 ? ' exercise' : ' exercises');
    return 'Training session';
  }

  function getTodayPlan() {
    if (window.DailyPlan && typeof window.DailyPlan.buildPlan === 'function') {
      return window.DailyPlan.buildPlan();
    }
    return null;
  }

  function getFocusShort(plan) {
    if (!plan) return 'Training';
    if (plan.restDay) return 'Rest';
    if (plan.dayLabel) return String(plan.dayLabel);
    if (plan.suggestion && plan.suggestion.focus) {
      var f = String(plan.suggestion.focus);
      return f.indexOf('(') > 0 ? f.slice(0, f.indexOf('(')).trim() : f;
    }
    return 'Training';
  }

  function weekOfYear(d) {
    var date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dayNum = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - dayNum + 3);
    var firstThursday = new Date(date.getFullYear(), 0, 4);
    var week =
      1 +
      Math.round(
        ((date.getTime() - firstThursday.getTime()) / 86400000 -
          3 +
          ((firstThursday.getDay() + 6) % 7)) /
          7
      );
    return week;
  }

  function renderHeader() {
    if (welcomeEl) {
      var hour = new Date().getHours();
      var timeGreeting =
        hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      var firstName = null;
      if (typeof window.getCurrentUser === 'function') {
        var user = window.getCurrentUser();
        if (user && user.firstName) firstName = String(user.firstName).trim();
      }
      welcomeEl.textContent = firstName ? timeGreeting + ', ' + firstName : timeGreeting;
    }
    if (planDateEl) {
      planDateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    }
  }

  var RING_METRIC_KEY = 'strongman_dash_ring_metric';
  var RING_GOAL_KEY = 'strongman_dash_ring_goal';

  function getRingMetric() {
    try {
      var m = localStorage.getItem(RING_METRIC_KEY);
      if (m === 'goal_progress' || m === 'week_sessions') return m;
    } catch (e) {}
    return 'week_sessions';
  }

  function setRingMetric(metric) {
    try {
      localStorage.setItem(RING_METRIC_KEY, metric);
    } catch (e) {}
  }

  function getRingGoal() {
    try {
      var raw = localStorage.getItem(RING_GOAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function setRingGoal(goal) {
    try {
      if (goal) localStorage.setItem(RING_GOAL_KEY, JSON.stringify(goal));
      else localStorage.removeItem(RING_GOAL_KEY);
    } catch (e) {}
  }

  function promptForRingGoal() {
    var kind = window.prompt(
      'Goal type: type "weight" for bodyweight change, or "lift" for a strength target.',
      'lift'
    );
    if (!kind) return null;
    kind = String(kind).toLowerCase().trim();
    if (kind.indexOf('weight') !== -1 || kind === 'bw' || kind === 'body') {
      var delta = window.prompt('How many pounds do you want to change? (negative to lose, e.g. -45)', '-45');
      var d = parseFloat(delta);
      if (isNaN(d) || d === 0) return null;
      var currentBw = window.prompt('Current bodyweight (lb)?', '180');
      var bw = parseFloat(currentBw);
      if (isNaN(bw) || bw <= 0) return null;
      return {
        type: 'bodyweight',
        start: bw,
        target: bw + d,
        label: (d < 0 ? d : '+' + d) + ' lb bodyweight',
      };
    }
    var lift = window.prompt('Lift name?', 'Bench Press');
    if (!lift) return null;
    var target = window.prompt('Target weight (lb)?', '225');
    var t = parseFloat(target);
    if (isNaN(t) || t <= 0) return null;
    var current = window.prompt('Current best for that lift (lb)?', '185');
    var c = parseFloat(current);
    if (isNaN(c) || c < 0) return null;
    return {
      type: 'lift',
      lift: String(lift).trim(),
      start: c,
      target: t,
      label: String(lift).trim() + ' → ' + t + ' lb',
    };
  }

  function computeGoalProgressPct(goal) {
    if (!goal || goal.start == null || goal.target == null) return 0;
    var start = Number(goal.start);
    var target = Number(goal.target);
    if (start === target) return 100;
    var current = start;
    if (goal.type === 'lift') {
      var PR = window.PRLog;
      if (PR && typeof PR.getRecords === 'function') {
        var name = String(goal.lift || '').toLowerCase();
        var best = start;
        PR.getRecords().forEach(function (r) {
          if (!r || r.discipline !== 'weightlifting') return;
          if (String(r.eventLabel || '').toLowerCase().indexOf(name) === -1) return;
          if (r.weight != null && r.weight > best) best = Number(r.weight);
        });
        current = best;
      }
    } else if (goal.type === 'bodyweight') {
      var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (user && user.weight != null && !isNaN(Number(user.weight))) {
        current = Number(user.weight);
      }
    }
    var span = target - start;
    var done = current - start;
    var pct = Math.round((done / span) * 100);
    return Math.max(0, Math.min(100, pct));
  }

  function renderSummary(stats) {
    var metric = getRingMetric();
    var pct = 0;
    var shortTag = 'Week';
    if (metric === 'goal_progress') {
      var goal = getRingGoal();
      if (!goal) {
        metric = 'week_sessions';
        setRingMetric('week_sessions');
      } else {
        pct = computeGoalProgressPct(goal);
        shortTag = 'Goal';
      }
    }
    if (metric === 'week_sessions') {
      var weekGoal = stats.weekGoal || 4;
      pct = weekGoal > 0 ? Math.min(100, Math.round((stats.weekCount / weekGoal) * 100)) : 0;
      shortTag = 'Week';
    }
    if (ringFillEl) {
      ringFillEl.style.strokeDasharray = String(RING_C);
      ringFillEl.style.strokeDashoffset = String(RING_C * (1 - pct / 100));
    }
    if (ringPctEl) ringPctEl.textContent = pct + '%';
    var tagEl = document.getElementById('dash-ring-tag');
    if (tagEl) tagEl.textContent = shortTag;
    var metricEl = document.getElementById('dash-ring-metric');
    if (metricEl) metricEl.remove();

    renderStatusRank();

    var weekEl = document.getElementById('dash-stat-week');
    var streakEl = document.getElementById('dash-stat-streak');
    var volumeEl = document.getElementById('dash-stat-volume');
    var totalEl = document.getElementById('dash-stat-total');
    if (weekEl) weekEl.textContent = String(stats.weekCount);
    if (streakEl) streakEl.textContent = String(stats.streak);
    if (volumeEl) volumeEl.textContent = String(stats.weekSets);
    if (totalEl) totalEl.textContent = String(stats.totalSessions);
    renderXpBar();

    document.querySelectorAll('[data-ring-metric]').forEach(function (btn) {
      var id = btn.getAttribute('data-ring-metric');
      btn.classList.toggle('is-active', id === getRingMetric());
    });
  }

  function renderStatusRank() {
    var XP = window.StrongmanXp;
    var snap =
      XP && typeof XP.getSnapshot === 'function'
        ? XP.getSnapshot()
        : { level: { level: 1 }, rank: { title: 'Kickoff', levelsToNext: 10, nextTitle: 'First Fire', nextMinLevel: 11 } };
    var level = (snap.level && snap.level.level) || 1;
    var rank = snap.rank || (XP && XP.rankForLevel ? XP.rankForLevel(level) : null);
    if (!rank) {
      rank = {
        title: 'Kickoff',
        levelsToNext: Math.max(0, 11 - level),
        nextTitle: 'First Fire',
        nextMinLevel: 11,
      };
    }
    if (statusTitleEl) statusTitleEl.textContent = rank.title;
    if (statusPillEl) statusPillEl.textContent = 'Lv ' + level;
    if (statusSubEl) {
      if (rank.nextTitle && rank.levelsToNext > 0) {
        statusSubEl.textContent =
          'Level ' +
          level +
          ' · ' +
          rank.levelsToNext +
          ' more to ' +
          rank.nextTitle;
      } else if (rank.nextTitle) {
        statusSubEl.textContent = 'Level ' + level + ' · next title unlocked';
      } else {
        statusSubEl.textContent = 'Level ' + level + ' · top of the ladder';
      }
    }
    var card = document.getElementById('dash-status-card');
    if (card) {
      card.setAttribute(
        'aria-label',
        'Training rank ' +
          rank.title +
          ', level ' +
          level +
          '. Open to see the title ladder.'
      );
    }
  }

  function renderXpBar() {
    var XP = window.StrongmanXp;
    if (!XP || typeof XP.getSnapshot !== 'function') return;
    var snap = XP.getSnapshot();
    var level = snap.level || XP.levelFromXp(snap.totalXp || 0);
    var levelEl = document.getElementById('dash-xp-level');
    var totalEl = document.getElementById('dash-xp-total');
    var fillEl = document.getElementById('dash-xp-fill');
    var metaEl = document.getElementById('dash-xp-meta');
    var trackEl = document.getElementById('dash-xp-track');
    var pct = Math.round((level.progress || 0) * 100);
    if (level.maxed) pct = 100;
    if (levelEl) levelEl.textContent = 'Level ' + level.level;
    if (totalEl) {
      totalEl.textContent =
        (typeof XP.formatXp === 'function' ? XP.formatXp(level.totalXp) : String(level.totalXp)) +
        ' XP';
    }
    if (fillEl) fillEl.style.width = pct + '%';
    if (trackEl) {
      trackEl.setAttribute('aria-valuenow', String(pct));
      trackEl.setAttribute(
        'aria-valuetext',
        level.maxed
          ? 'Level ' + level.level + ', max rank'
          : 'Level ' + level.level + ', ' + pct + ' percent to next level'
      );
    }
    if (metaEl) {
      if (level.maxed || !level.needForNext) {
        metaEl.textContent = 'Max level ' + (snap.maxLevel || 100);
      } else {
        metaEl.textContent =
          Math.round(level.intoLevel) +
          ' / ' +
          Math.round(level.needForNext) +
          ' XP to Level ' +
          (level.level + 1);
      }
    }
    renderStatusRank();
  }

  function renderXpStats() {
    renderXpBar();
  }

  function closeRankDialog() {
    var backdrop = document.getElementById('dash-rank-backdrop');
    var dialog = document.getElementById('dash-rank-dialog');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) {
      dialog.hidden = true;
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  function openRankDialog() {
    var XP = window.StrongmanXp;
    var backdrop = document.getElementById('dash-rank-backdrop');
    var dialog = document.getElementById('dash-rank-dialog');
    var bodyEl = document.getElementById('dash-rank-body');
    if (!dialog || !bodyEl) return;

    var snap =
      XP && typeof XP.getSnapshot === 'function'
        ? XP.getSnapshot()
        : { level: { level: 1 }, rank: null, maxLevel: 100 };
    var level = (snap.level && snap.level.level) || 1;
    var rank =
      snap.rank ||
      (XP && typeof XP.rankForLevel === 'function' ? XP.rankForLevel(level) : null);
    var tiers =
      XP && typeof XP.rankTier === 'function'
        ? XP.rankTier()
        : XP && XP.RANK_TIERS
          ? XP.RANK_TIERS.slice()
          : [];

    var summaryBits = [];
    summaryBits.push(
      '<div class="dash-rank-summary"><strong>' +
        (rank ? rank.title : 'Kickoff') +
        '</strong><p>Level ' +
        level +
        (rank && rank.nextTitle
          ? ' · ' +
            rank.levelsToNext +
            ' level' +
            (rank.levelsToNext === 1 ? '' : 's') +
            ' to ' +
            rank.nextTitle +
            ' (Lv ' +
            rank.nextMinLevel +
            ')'
          : ' · Immortal ceiling') +
        '</p></div>'
    );

    var items = tiers
      .map(function (tier, idx) {
        var nextTier = tiers[idx + 1] || null;
        var maxLvl = nextTier ? nextTier.minLevel - 1 : snap.maxLevel || 100;
        var unlocked = level >= tier.minLevel;
        var current = rank && rank.title === tier.title;
        var state = '';
        if (current) {
          state =
            rank.nextTitle && rank.levelsToNext > 0
              ? rank.levelsToNext + ' to go'
              : 'Current';
        } else if (unlocked) {
          state = 'Cleared';
        } else {
          var need = Math.max(0, tier.minLevel - level);
          state = need + ' lvl' + (need === 1 ? '' : 's');
        }
        return (
          '<li class="dash-rank-item' +
          (current ? ' is-current' : '') +
          (!unlocked ? ' is-locked' : '') +
          '">' +
          '<span class="dash-rank-item-lvl">Lv ' +
          tier.minLevel +
          (maxLvl > tier.minLevel ? '–' + maxLvl : '') +
          '</span>' +
          '<div><p class="dash-rank-item-title">' +
          tier.title +
          '</p><p class="dash-rank-item-blurb">' +
          (tier.blurb || '') +
          '</p></div>' +
          '<span class="dash-rank-item-state">' +
          state +
          '</span></li>'
        );
      })
      .join('');

    bodyEl.innerHTML =
      summaryBits.join('') + '<ul class="dash-rank-list">' + items + '</ul>';

    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    dialog.hidden = false;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function collectSessionExercises(s) {
    var out = [];
    function pushEx(ex) {
      if (!ex || !ex.name) return;
      out.push(ex);
    }
    (s.exercises || []).forEach(pushEx);
    (s.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(pushEx);
    });
    if (s.trackerData && Array.isArray(s.trackerData.exercises)) {
      s.trackerData.exercises.forEach(pushEx);
    }
    return out;
  }

  function sessionsForDay(sessions, dayKey) {
    return (sessions || []).filter(function (s) {
      return sessionDateKey(s) === dayKey;
    });
  }

  function closeDayDetail() {
    var backdrop = document.getElementById('dash-day-backdrop');
    var dialog = document.getElementById('dash-day-dialog');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) {
      dialog.hidden = true;
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  function openDayDetail(dayKey, label) {
    var backdrop = document.getElementById('dash-day-backdrop');
    var dialog = document.getElementById('dash-day-dialog');
    var titleEl = document.getElementById('dash-day-title');
    var bodyEl = document.getElementById('dash-day-body');
    if (!dialog || !bodyEl) return;
    var sessions = [];
    if (window.WorkoutLog && typeof window.WorkoutLog.getSessions === 'function') {
      sessions = sessionsForDay(window.WorkoutLog.getSessions(), dayKey);
    }
    if (titleEl) titleEl.textContent = label || dayKey;

    var exercises = [];
    sessions.forEach(function (s) {
      collectSessionExercises(s).forEach(function (ex) {
        exercises.push(ex);
      });
    });

    var html = '';
    if (!sessions.length) {
      html += '<p class="dash-day-empty">No workouts logged this day.</p>';
    } else {
      html += '<ul class="dash-day-session-list">';
      sessions.forEach(function (s) {
        var title = s.title || s.splitName || 'Workout';
        var meta = [];
        if (s.time) meta.push(String(s.time).slice(0, 5));
        var n = collectSessionExercises(s).length;
        if (n) meta.push(n + (n === 1 ? ' exercise' : ' exercises'));
        html +=
          '<li class="dash-day-session">' +
          '<strong class="dash-day-session-title">' +
          String(title).replace(/</g, '&lt;') +
          '</strong>' +
          (meta.length
            ? '<span class="dash-day-session-meta">' + meta.join(' · ') + '</span>'
            : '') +
          '</li>';
      });
      html += '</ul>';
    }

    if (window.MuscleMap && typeof window.MuscleMap.renderPair === 'function' && exercises.length) {
      html +=
        '<section class="dash-day-muscles" aria-label="Muscles hit">' +
        window.MuscleMap.renderPair(exercises, { title: 'Muscles hit' }) +
        '</section>';
    } else if (sessions.length) {
      html += '<p class="dash-day-empty">No clear muscle targets from these sessions.</p>';
    }

    bodyEl.innerHTML = html;
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    dialog.hidden = false;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function workoutIconHtml() {
    if (window.TrainingTimeline && typeof window.TrainingTimeline.iconForType === 'function') {
      return window.TrainingTimeline.iconForType('workout');
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6.5 9.5v5M17.5 9.5v5M4 11v2M20 11v2M8 8h8v8H8z"/></svg>'
    );
  }

  function sessionSubtitleLines(s) {
    var lines = [];
    var names = collectSessionExercises(s)
      .map(function (ex) {
        return String(ex.name || '').trim();
      })
      .filter(Boolean);
    names.slice(0, 3).forEach(function (name) {
      lines.push(name);
    });
    if (names.length > 3) lines.push('+' + (names.length - 3) + ' more');
    if (!lines.length) {
      if (s.cardio && s.cardio.minutes) {
        lines.push((s.cardio.activity || 'Cardio') + ' · ' + s.cardio.minutes + ' min');
      } else if (s.notes) {
        lines.push(String(s.notes).slice(0, 60));
      }
    }
    return lines;
  }

  function renderRecentWorkouts(sessions) {
    var rail = document.getElementById('dash-rw-rail');
    var empty = document.getElementById('dash-rw-empty');
    if (!rail) return;
    var list = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      })
      .slice(0, 8);

    rail.innerHTML = '';
    if (empty) empty.hidden = list.length > 0;
    if (!list.length) return;

    list.forEach(function (s) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'dash-rw-card';
      card.setAttribute('role', 'listitem');

      var icon = document.createElement('span');
      icon.className = 'dash-rw-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = workoutIconHtml();

      var when = document.createElement('span');
      when.className = 'dash-rw-card-when';
      when.textContent = formatRelativeDay(sessionTimestamp(s));

      var title = document.createElement('div');
      title.className = 'dash-rw-card-title';
      title.textContent = sessionDisplayTitle(s);

      var lines = document.createElement('div');
      lines.className = 'dash-rw-card-lines';
      sessionSubtitleLines(s)
        .slice(0, 3)
        .forEach(function (text) {
          var line = document.createElement('span');
          line.className = 'dash-rw-card-line';
          line.textContent = text;
          lines.appendChild(line);
        });

      var foot = document.createElement('div');
      foot.className = 'dash-rw-card-foot';
      var sets = countSetsInSession(s);
      if (sets) {
        var setChip = document.createElement('span');
        setChip.className = 'dash-rw-card-chip';
        setChip.textContent = sets + ' set' + (sets === 1 ? '' : 's');
        foot.appendChild(setChip);
      }
      if (s.totalIntensity != null && s.totalIntensity !== '' && !isNaN(s.totalIntensity)) {
        var intChip = document.createElement('span');
        intChip.className = 'dash-rw-card-chip dash-rw-card-chip--accent';
        intChip.textContent = 'RPE ' + s.totalIntensity;
        foot.appendChild(intChip);
      }
      var chev = document.createElement('span');
      chev.className = 'dash-rw-card-chevron';
      chev.setAttribute('aria-hidden', 'true');
      chev.textContent = '›';
      foot.appendChild(chev);

      card.appendChild(icon);
      card.appendChild(when);
      card.appendChild(title);
      if (lines.childNodes.length) card.appendChild(lines);
      card.appendChild(foot);

      var dayKey = sessionDateKey(s);
      var dayLabel = new Date(sessionTimestamp(s)).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      card.title = dayLabel + ' — view workouts';
      card.addEventListener('click', function () {
        openDayDetail(dayKey, dayLabel);
      });
      rail.appendChild(card);
    });
  }

  function renderWeekStrip(stats) {
    if (!weekStripEl) return;
    var labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Sunday-start week
    var start = new Date(today);
    start.setDate(today.getDate() - today.getDay());

    var todayKey =
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0');

    weekStripEl.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      var key =
        day.getFullYear() +
        '-' +
        String(day.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(day.getDate()).padStart(2, '0');
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'dash-week-day';
      el.textContent = labels[i];
      var label = day.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      el.title = label + ' — view workouts';
      el.setAttribute('aria-label', label + ', view logged workouts');
      el.setAttribute('data-day-key', key);
      if (stats.dayKeys && stats.dayKeys[key]) el.classList.add('is-done');
      if (key === todayKey) el.classList.add('is-today');
      el.addEventListener('click', function (e) {
        var btn = e.currentTarget;
        openDayDetail(btn.getAttribute('data-day-key'), btn.title.replace(' — view workouts', ''));
      });
      weekStripEl.appendChild(el);
    }
  }

  function renderWorkoutComp(sessions) {
    var plan = getTodayPlan();
    var focus = getFocusShort(plan);
    var WD = window.WorkoutDashboard;
    var live = WD && typeof WD.isLiveWorkoutActive === 'function' && WD.isLiveWorkoutActive();
    var now = new Date();
    var todayKey =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0');
    var trainedToday = (sessions || []).some(function (s) {
      return sessionDateKey(s) === todayKey;
    });

    if (startBtn) {
      startBtn.classList.toggle('dash-comp--live', !!live);
      startBtn.classList.toggle('is-done', !live && trainedToday);
      startBtn.classList.toggle('dash-start-btn--live', !!live);
    }

    if (workoutTitleEl) {
      if (live) workoutTitleEl.textContent = 'Gym: Continue workout';
      else if (plan && plan.restDay) workoutTitleEl.textContent = 'Recovery / mobility';
      else workoutTitleEl.textContent = 'Gym: ' + focus + ' workout';
    }

    var exCount = plan && Array.isArray(plan.exercises) ? plan.exercises.length : 0;
    var mins = exCount > 0 ? Math.min(90, Math.max(30, exCount * 8 + 15)) : 45;
    if (heroDurationEl) {
      heroDurationEl.textContent = live ? 'Live' : '~' + mins + ' min';
    }

    if (startHintEl) {
      if (live && WD && typeof WD.getElapsedLabel === 'function') {
        startHintEl.textContent = WD.getElapsedLabel() + ' elapsed · tap to resume';
      } else if (trainedToday) {
        startHintEl.textContent = 'Already trained today — optional second session.';
      } else if (plan && plan.primaryAction === 'modified') {
        startHintEl.textContent = 'Train careful — sport load is high.';
      } else if (plan && plan.restDay) {
        startHintEl.textContent = 'Optional mobility or full rest.';
      } else {
        startHintEl.textContent = 'Tap to start today’s session.';
      }
    }
  }

  function splitCoachTip(callout) {
    var text = String((callout && (callout.text || callout.body)) || '').trim();
    if (callout && callout.title) {
      return { title: String(callout.title).trim(), body: text || String(callout.title).trim() };
    }
    if (!text) {
      return { title: 'Talk to Rocky', body: 'Open Coach for a fresh read on your training.' };
    }
    var em = text.split(/\s*[—–]\s+/);
    if (em.length >= 2 && em[0].length >= 8 && em[0].length <= 56) {
      return { title: em[0].trim(), body: em.slice(1).join(' — ').trim() || text };
    }
    var sent = text.match(/^([^.!?]{8,56}[.!?])\s+(.+)$/);
    if (sent) {
      return {
        title: sent[1].replace(/[.!?]+$/, '').trim(),
        body: sent[2].trim() || text,
      };
    }
    if (text.length > 48) {
      var cut = text.slice(0, 44).replace(/\s+\S*$/, '');
      return { title: cut + '…', body: text };
    }
    return { title: text, body: 'Tap through to Coach when you want the full plan.' };
  }

  function renderRockyComp(sessions) {
    var defaults = [
      {
        title: 'Show up today',
        body: 'Consistency beats perfect programming. Get one honest session in.',
      },
      {
        title: 'Log what you lift',
        body: 'The more you log, the sharper Rocky’s tips get week to week.',
      },
    ];
    var tips = defaults.slice();
    var RCI = window.RockyCoachingInsights;
    if (RCI && typeof RCI.buildCallouts === 'function') {
      var callouts = RCI.buildCallouts(sessions, { limit: 2 }) || [];
      if (callouts.length) {
        tips = callouts.slice(0, 2).map(splitCoachTip);
        while (tips.length < 2) tips.push(defaults[tips.length]);
      }
    }

    if (coachTip1TitleEl) coachTip1TitleEl.textContent = tips[0].title;
    if (coachTip1BodyEl) coachTip1BodyEl.textContent = tips[0].body;
    if (coachTip2TitleEl) coachTip2TitleEl.textContent = tips[1].title;
    if (coachTip2BodyEl) coachTip2BodyEl.textContent = tips[1].body;
  }

  function renderRecentComp() {
    /* Catch-up comps replaced by XP bar */
  }

  function renderPrComp() {
    /* Catch-up comps replaced by XP bar */
  }

  function renderAthleteContext() {
    if (sportTipEl) {
      sportTipEl.textContent = '';
      sportTipEl.hidden = true;
    }
    var AC = window.AthleteContext;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (countdownsEl && AC && user) {
      var items = AC.getUpcomingCountdowns(user, 2);
      if (items.length) {
        countdownsEl.innerHTML = items
          .map(function (item) {
            return (
              '<span class="dash-countdown-chip"><strong>' +
              item.countdown +
              '</strong> ' +
              item.label +
              ' · ' +
              item.sport +
              '</span>'
            );
          })
          .join('');
        countdownsEl.hidden = false;
      } else {
        countdownsEl.innerHTML = '';
        countdownsEl.hidden = true;
      }
    }
  }

  function renderDailyPlan() {
    /* Home uses the plan complications UI instead of the daily card. */
    if (dailyRootEl) {
      dailyRootEl.hidden = true;
      dailyRootEl.innerHTML = '';
    }
  }

  function showRockyBanner(html) {
    if (!rockyBannerEl) return;
    if (!html || !String(html).trim()) {
      hideRockyBanner();
      return;
    }
    rockyBannerEl.innerHTML = html;
    rockyBannerEl.hidden = false;
    rockyBannerEl.setAttribute('aria-hidden', 'false');
  }

  function hideRockyBanner() {
    if (!rockyBannerEl) return;
    rockyBannerEl.hidden = true;
    rockyBannerEl.setAttribute('aria-hidden', 'true');
    rockyBannerEl.innerHTML = '';
  }

  function refreshRockyCoachStatus() {
    var CP = window.CoachPendingRequest;
    if (!CP) {
      hideRockyBanner();
      return;
    }
    if (typeof CP.hasUnreadReply === 'function' && CP.hasUnreadReply()) {
      showRockyBanner(
        '<span class="dash-rocky-banner-text">Rocky replied while you were away.</span>' +
          '<a href="/coach" class="dash-rocky-banner-link">Read →</a>'
      );
      return;
    }
    if (CP.hasPendingReply()) {
      showRockyBanner(
        '<span class="dash-rocky-banner-text">Rocky is finishing your reply…</span>'
      );
      CP.resume({
        onSuccess: function () {
          showRockyBanner(
            '<span class="dash-rocky-banner-text">Rocky replied.</span>' +
              '<a href="/coach" class="dash-rocky-banner-link">Open Coach →</a>'
          );
        },
        onError: function () {},
      });
      return;
    }
    hideRockyBanner();
  }

  function refreshWorkoutCta() {
    var WL = window.WorkoutLog;
    var sessions = WL && typeof WL.getSessions === 'function' ? WL.getSessions() : [];
    renderWorkoutComp(sessions);
  }

  function refreshDashboard() {
    var WL = window.WorkoutLog;
    var sessions = WL && typeof WL.getSessions === 'function' ? WL.getSessions() : [];
    var stats = computeStats(sessions);
    renderHeader();
    renderSummary(stats);
    renderWeekStrip(stats);
    renderWorkoutComp(sessions);
    renderRockyComp(sessions);
    renderRecentComp(sessions);
    renderRecentWorkouts(sessions);
    renderPrComp();
    renderAthleteContext();
    renderDailyPlan();
    if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
      window.RockySetupAlert.renderAll();
    }
    if (window.Achievements && typeof window.Achievements.celebrateNewUnlocks === 'function') {
      var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (u && u.id) {
        var fresh = window.Achievements.celebrateNewUnlocks(u) || [];
        if (fresh.length) persistHomeBadges(fresh);
      }
    }
    renderHomeBadges();
  }

  var HOME_BADGES_KEY = 'strongman-home-new-badges';

  function persistHomeBadges(fresh) {
    if (!fresh || !fresh.length) return;
    var existing = loadHomeBadges();
    var seen = {};
    existing.forEach(function (b) {
      if (b && b.id) seen[b.id] = true;
    });
    fresh.forEach(function (a) {
      if (!a || !a.id || seen[a.id]) return;
      var iconHtml = '';
      if (window.Achievements && typeof window.Achievements.iconSvgForKind === 'function') {
        iconHtml = window.Achievements.iconSvgForKind(a.kind);
      }
      existing.unshift({
        id: a.id,
        name: a.title || a.name || 'Badge',
        iconHtml: iconHtml,
      });
      seen[a.id] = true;
    });
    try {
      sessionStorage.setItem(HOME_BADGES_KEY, JSON.stringify(existing.slice(0, 12)));
    } catch (e) {}
  }

  function loadHomeBadges() {
    try {
      var raw = sessionStorage.getItem(HOME_BADGES_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function clearHomeBadges() {
    try {
      sessionStorage.removeItem(HOME_BADGES_KEY);
    } catch (e) {}
  }

  function renderHomeBadges() {
    var strip = document.getElementById('dash-badges-strip');
    var list = document.getElementById('dash-badges-list');
    if (!strip || !list) return;
    var badges = loadHomeBadges();
    if (!badges.length) {
      strip.hidden = true;
      list.innerHTML = '';
      return;
    }
    strip.hidden = false;
    list.innerHTML = '';
    badges.forEach(function (b) {
      var a = document.createElement('a');
      a.href = '/profile#badges';
      a.className = 'dash-badge-chip';
      var icon = document.createElement('span');
      icon.className = 'dash-badge-chip-icon';
      icon.setAttribute('aria-hidden', 'true');
      if (b.iconHtml) icon.innerHTML = b.iconHtml;
      else icon.textContent = '★';
      var name = document.createElement('span');
      name.className = 'dash-badge-chip-name';
      name.textContent = b.name || 'Badge';
      var neu = document.createElement('span');
      neu.className = 'dash-badge-chip-new';
      neu.textContent = 'New';
      a.appendChild(icon);
      a.appendChild(name);
      a.appendChild(neu);
      list.appendChild(a);
    });
  }

  (function bindHomeBadgesDismiss() {
    var btn = document.getElementById('dash-badges-dismiss');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      clearHomeBadges();
      renderHomeBadges();
    });
  })();

  function loadDashboard() {
    var TS = window.TrainingSync;
    var afterSync = function () {
      if (window.CoachMemory && typeof window.CoachMemory.syncFromServerAsync === 'function') {
        window.CoachMemory.syncFromServerAsync().then(
          function () {
            refreshDashboard();
          },
          function () {
            refreshDashboard();
          }
        );
        return;
      }
      refreshDashboard();
    };
    if (TS && typeof TS.syncAll === 'function') {
      var cu = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (cu && cu.token) {
        TS.syncAll({ callback: afterSync });
        return;
      }
    }
    afterSync();
  }

  function closeRingDialog() {
    var backdrop = document.getElementById('dash-ring-backdrop');
    var dialog = document.getElementById('dash-ring-dialog');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) {
      dialog.hidden = true;
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  function openRingDialog() {
    var backdrop = document.getElementById('dash-ring-backdrop');
    var dialog = document.getElementById('dash-ring-dialog');
    if (!dialog) return;
    document.querySelectorAll('[data-ring-metric]').forEach(function (btn) {
      var id = btn.getAttribute('data-ring-metric');
      btn.classList.toggle('is-active', id === getRingMetric());
    });
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    dialog.hidden = false;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  (function bindRingMetricPicker() {
    var btn = document.getElementById('dash-ring-btn');
    var closeBtn = document.getElementById('dash-ring-close');
    var backdrop = document.getElementById('dash-ring-backdrop');
    var body = document.getElementById('dash-ring-body');
    if (btn) btn.addEventListener('click', openRingDialog);
    if (closeBtn) closeBtn.addEventListener('click', closeRingDialog);
    if (backdrop) backdrop.addEventListener('click', closeRingDialog);
    if (body) {
      body.addEventListener('click', function (e) {
        var opt = e.target.closest && e.target.closest('[data-ring-metric]');
        if (!opt || opt.disabled) return;
        var metric = opt.getAttribute('data-ring-metric');
        if (metric === 'coming_soon') return;
        if (metric === 'goal_progress') {
          var goal = promptForRingGoal();
          if (!goal) return;
          setRingGoal(goal);
        }
        setRingMetric(metric);
        closeRingDialog();
        refreshDashboard();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var rankDialog = document.getElementById('dash-rank-dialog');
      if (rankDialog && !rankDialog.hidden) {
        closeRankDialog();
        return;
      }
      var dialog = document.getElementById('dash-ring-dialog');
      if (dialog && !dialog.hidden) closeRingDialog();
    });
  })();

  (function bindRankCard() {
    var card = document.getElementById('dash-status-card');
    var closeBtn = document.getElementById('dash-rank-close');
    var backdrop = document.getElementById('dash-rank-backdrop');
    if (card) card.addEventListener('click', openRankDialog);
    if (closeBtn) closeBtn.addEventListener('click', closeRankDialog);
    if (backdrop) backdrop.addEventListener('click', closeRankDialog);
  })();

  window.addEventListener('strongman:training-synced', function () {
    refreshDashboard();
  });

  document.addEventListener('strongman:xp-updated', function () {
    renderXpBar();
  });

  renderHeader();
  refreshRockyCoachStatus();
  loadDashboard();

  function launchWorkoutFromDashboard() {
    var WD = window.WorkoutDashboard;
    if (WD && typeof WD.isLiveWorkoutActive === 'function' && WD.isLiveWorkoutActive()) {
      if (typeof WD.resumeWorkout === 'function') WD.resumeWorkout();
      else window.location.href = '/log?workout=1';
      return;
    }
    try {
      if (window.WorkoutSession && typeof window.WorkoutSession.clearSession === 'function') {
        window.WorkoutSession.clearSession();
      }
      if (window.WorkoutPredict && typeof window.WorkoutPredict.clearSessionEquipment === 'function') {
        window.WorkoutPredict.clearSessionEquipment();
      }
      localStorage.removeItem('strongman-wd-adv-supersets');
      localStorage.removeItem('strongman-wd-adv-dropsets');
      localStorage.removeItem('strongman-session-equipment');
      sessionStorage.removeItem('strongman-apply-today-routine');
    } catch (e) {}
    window.location.href = '/log?workout=1';
  }

  if (startBtn) {
    startBtn.addEventListener('click', launchWorkoutFromDashboard);
  }

  document.addEventListener('strongman:xp-updated', function () {
    renderXpStats();
  });
  if (window.StrongmanXp && typeof window.StrongmanXp.pullFromServer === 'function') {
    window.StrongmanXp.pullFromServer().then(function () {
      renderXpStats();
    });
  } else {
    renderXpStats();
  }

  (function bindDayDetail() {
    var closeBtn = document.getElementById('dash-day-close');
    var backdrop = document.getElementById('dash-day-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeDayDetail);
    if (backdrop) backdrop.addEventListener('click', closeDayDetail);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var dialog = document.getElementById('dash-day-dialog');
      if (dialog && dialog.classList.contains('is-open')) {
        closeDayDetail();
        e.preventDefault();
      }
    });
  })();

  document.addEventListener('workout-live-changed', function () {
    refreshWorkoutCta();
    var WL = window.WorkoutLog;
    renderRecentComp(WL && typeof WL.getSessions === 'function' ? WL.getSessions() : []);
  });

  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('strongman_live_workout_v1') === 0) refreshWorkoutCta();
    if (e.key && e.key.indexOf('strongman_workouts') === 0) refreshDashboard();
    if (e.key && e.key.indexOf('strongman-coach-') === 0) refreshRockyCoachStatus();
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.body.getAttribute('data-current-page') === 'home') {
      refreshRockyCoachStatus();
      if (window.TrainingSync && typeof window.TrainingSync.syncAll === 'function') {
        window.TrainingSync.syncAll({ callback: function () { refreshDashboard(); } });
      } else {
        loadDashboard();
      }
    }
  });

  window.refreshHomeWorkoutCta = refreshWorkoutCta;
})();
