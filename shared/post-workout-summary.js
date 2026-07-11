(function () {
  'use strict';

  var RECENT_WORKOUT_LIMIT = 3;

  function formatShortDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  }

  function legacyExerciseLine(ex) {
    if (!ex || !ex.name) return '';
    var w = ex.weight != null ? String(ex.weight) : '';
    return (
      ex.name +
      ' ' +
      String(ex.sets || '?') +
      '×' +
      String(ex.reps || '?') +
      (w ? ' @ ' + w : '')
    );
  }

  function trackerExerciseLine(ex) {
    if (!ex || !ex.name) return '';
    var sets = (ex.sets || []).filter(function (s) {
      return s && s.completed;
    });
    if (!sets.length) return ex.name + ' (no completed sets)';
    var parts = sets.map(function (s) {
      var w = s.weight != null ? s.weight : '?';
      var r = s.reps != null ? s.reps : '?';
      var rest =
        s.restSeconds != null && s.restSeconds > 0 ? ' (' + s.restSeconds + 's rest)' : '';
      return w + '×' + r + rest;
    });
    return ex.name + ': ' + parts.join(', ');
  }

  function computeSessionStats(payload) {
    var exerciseCount = 0;
    var completedSetCount = 0;
    var totalVolume = 0;
    var lifts = [];

    if (payload.trackerData && Array.isArray(payload.trackerData.exercises)) {
      payload.trackerData.exercises.forEach(function (ex) {
        if (!ex || !ex.name) return;
        exerciseCount++;
        var completed = (ex.sets || []).filter(function (s) {
          return s && s.completed;
        });
        completedSetCount += completed.length;
        var setParts = [];
        completed.forEach(function (s) {
          var w = parseFloat(s.weight);
          var r = parseFloat(s.reps);
          if (!isNaN(w) && !isNaN(r)) totalVolume += w * r;
          setParts.push(
            (s.weight != null ? s.weight : '?') +
              '×' +
              (s.reps != null ? s.reps : '?')
          );
        });
        lifts.push({
          name: ex.name,
          summary: setParts.length ? setParts.join(', ') : 'no completed sets',
        });
      });
    } else if (Array.isArray(payload.exercises)) {
      payload.exercises.forEach(function (ex) {
        if (!ex || !ex.name) return;
        exerciseCount++;
        lifts.push({
          name: ex.name,
          summary: legacyExerciseLine(ex).replace(ex.name + ' ', ''),
        });
        var sets = parseInt(ex.sets, 10);
        var reps = parseInt(ex.reps, 10);
        var w = parseFloat(ex.weight);
        if (!isNaN(sets) && sets > 0) completedSetCount += sets;
        if (!isNaN(w) && !isNaN(reps) && !isNaN(sets)) totalVolume += w * reps * sets;
      });
    }

    return {
      exerciseCount: exerciseCount,
      completedSetCount: completedSetCount,
      totalVolume: Math.round(totalVolume),
      lifts: lifts,
    };
  }

  function buildTodaySessionPayload(savedSession, durationMs) {
    var stats = computeSessionStats(savedSession || {});
    var durationMin =
      durationMs != null && durationMs > 0 ? Math.max(1, Math.round(durationMs / 60000)) : null;
    return {
      title: savedSession.title || savedSession.splitName || 'Workout',
      splitName: savedSession.splitName || '',
      durationMin: durationMin,
      exerciseCount: stats.exerciseCount,
      completedSetCount: stats.completedSetCount,
      totalVolume: stats.totalVolume,
      intensity: savedSession.totalIntensity != null ? savedSession.totalIntensity : null,
      lifts: stats.lifts.slice(0, 30),
      notes: savedSession.notes ? String(savedSession.notes).slice(0, 2000) : '',
    };
  }

  function buildLocalSummaryCards(todaySession) {
    var cards = [];
    if (todaySession.durationMin) {
      cards.push(todaySession.durationMin + ' min session');
    }
    if (todaySession.exerciseCount) {
      cards.push(
        todaySession.exerciseCount +
          ' exercise' +
          (todaySession.exerciseCount === 1 ? '' : 's')
      );
    }
    if (todaySession.completedSetCount) {
      cards.push(
        todaySession.completedSetCount +
          ' set' +
          (todaySession.completedSetCount === 1 ? '' : 's') +
          ' logged'
      );
    }
    if (todaySession.totalVolume > 0) {
      cards.push(todaySession.totalVolume.toLocaleString() + ' lb total volume');
    }
    if (todaySession.intensity != null) {
      cards.push('Intensity ' + todaySession.intensity + '/100');
    }
    if (todaySession.splitName) {
      cards.push(todaySession.splitName);
    }
    return cards;
  }

  /** Past 3 workouts only — compact text, excludes the session just saved. */
  function buildRecentWorkoutsText(excludeSessionId) {
    var WL = window.WorkoutLog;
    if (!WL || typeof WL.getSessions !== 'function') return '';
    var sessions = WL.getSessions();
    var lines = [];
    for (var i = 0; i < sessions.length && lines.length < RECENT_WORKOUT_LIMIT; i++) {
      var s = sessions[i];
      if (!s || s.sessionType === 'cardio') continue;
      if (excludeSessionId && s.id === excludeSessionId) continue;
      var hasTracker =
        s.trackerData &&
        Array.isArray(s.trackerData.exercises) &&
        s.trackerData.exercises.length;
      var hasLegacy = Array.isArray(s.exercises) && s.exercises.length;
      if (!hasTracker && !hasLegacy) continue;

      var dt = formatShortDate(s.createdAt || s.date);
      var head = (dt ? '[' + dt + '] ' : '') + (s.title || s.splitName || 'Workout');
      var exParts = [];
      if (hasTracker) {
        s.trackerData.exercises.forEach(function (ex) {
          var ln = trackerExerciseLine(ex);
          if (ln) exParts.push(ln);
        });
      } else {
        s.exercises.forEach(function (ex) {
          var ln = legacyExerciseLine(ex);
          if (ln) exParts.push(ln);
        });
      }
      if (!exParts.length) continue;
      lines.push(head + ' — ' + exParts.join('; '));
    }
    return lines.join('\n');
  }

  function buildAthleteContext() {
    var AC = window.AthleteContext;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!AC || !user || typeof AC.buildCoachPromptBlock !== 'function') return '';
    var extras = {};
    try {
      extras.notes = localStorage.getItem('strongman-coach-anything-else') || '';
    } catch (e) {}
    return AC.buildCoachPromptBlock(user, extras);
  }

  function fetchRecoveryAdvice(savedSession, durationMs) {
    if (typeof window.apiPost !== 'function') {
      return Promise.reject(new Error('Offline — could not reach recovery coach.'));
    }
    var todaySession = buildTodaySessionPayload(savedSession, durationMs);
    var recentWorkouts = buildRecentWorkoutsText(savedSession && savedSession.id);
    return window
      .apiPost('/post-workout-recovery', {
        todaySession: todaySession,
        recentWorkouts: recentWorkouts,
        athleteContext: buildAthleteContext(),
      })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (x) {
        if (!x.res.ok) {
          var msg =
            (x.body && x.body.error) ||
            (x.res.status === 429
              ? 'Daily AI limit reached — your stats are saved.'
              : 'Recovery advice unavailable.');
          throw new Error(msg);
        }
        return x.body;
      });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function renderRecoveryHtml(recovery) {
    if (!recovery) return '';
    var html =
      '<div class="wd-recovery-block">' +
      '<h3 class="wd-recovery-title">' +
      escapeHtml(recovery.title || 'Recovery') +
      '</h3>';
    if (recovery.summary) {
      html +=
        '<p class="wd-recovery-summary">' + escapeHtml(recovery.summary) + '</p>';
    }
    if (recovery.points && recovery.points.length) {
      html += '<ul class="wd-recovery-points">';
      recovery.points.forEach(function (p) {
        html +=
          '<li class="wd-recovery-point wd-recovery-point--' +
          escapeHtml(p.style || 'tip') +
          '">' +
          escapeHtml(p.text) +
          '</li>';
      });
      html += '</ul>';
    }
    if (recovery.closing) {
      html +=
        '<p class="wd-recovery-closing">' + escapeHtml(recovery.closing) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function renderSummaryHtml(data, todaySession, opts) {
    opts = opts || {};
    var summary = (data && data.summary) || {};
    var localCards = buildLocalSummaryCards(todaySession);
    var stats = summary.stats && summary.stats.length ? summary.stats : localCards;
    var html =
      '<div class="wd-summary-block">' +
      '<h2 class="wd-summary-headline">' +
      escapeHtml(summary.headline || 'Great work!') +
      '</h2>' +
      '<ul class="wd-summary-stats">';
    stats.forEach(function (s) {
      html += '<li>' + escapeHtml(s) + '</li>';
    });
    html += '</ul>';
    if (summary.highlights && summary.highlights.length) {
      html += '<div class="wd-summary-highlights"><p class="wd-summary-sub">Highlights</p><ul>';
      summary.highlights.forEach(function (h) {
        html += '<li>' + escapeHtml(h) + '</li>';
      });
      html += '</ul></div>';
    }
    html += '</div>';
    if (opts.chartsHtml) html += opts.chartsHtml;
    if (data && data.recovery) {
      html += renderRecoveryHtml(data.recovery);
    }
    return html;
  }

  function sessionVolume(s) {
    if (!s) return 0;
    var total = 0;
    if (s.trackerData && Array.isArray(s.trackerData.exercises)) {
      s.trackerData.exercises.forEach(function (ex) {
        (ex.sets || []).forEach(function (set) {
          if (!set || !set.completed) return;
          var w = parseFloat(set.weight);
          var r = parseFloat(set.reps);
          if (!isNaN(w) && !isNaN(r)) total += w * r;
        });
      });
    } else if (Array.isArray(s.exercises)) {
      s.exercises.forEach(function (ex) {
        var sets = parseInt(ex.sets, 10);
        var reps = parseInt(ex.reps, 10);
        var w = parseFloat(ex.weight);
        if (!isNaN(w) && !isNaN(reps) && !isNaN(sets)) total += w * reps * sets;
      });
    }
    return Math.round(total);
  }

  function sessionSetCount(s) {
    if (!s) return 0;
    var n = 0;
    if (s.trackerData && Array.isArray(s.trackerData.exercises)) {
      s.trackerData.exercises.forEach(function (ex) {
        (ex.sets || []).forEach(function (set) {
          if (set && set.completed) n++;
        });
      });
    } else if (Array.isArray(s.exercises)) {
      s.exercises.forEach(function (ex) {
        var sets = parseInt(ex.sets, 10);
        if (!isNaN(sets) && sets > 0) n += sets;
      });
    }
    return n;
  }

  function buildHistorySeries(savedSession) {
    var WL = window.WorkoutLog;
    var points = [];
    var sessions = WL && typeof WL.getSessions === 'function' ? WL.getSessions() || [] : [];
    var seen = {};
    sessions.forEach(function (s) {
      if (!s || s.sessionType === 'cardio') return;
      var id = s.id != null ? String(s.id) : '';
      if (id) seen[id] = true;
      var ts = Date.parse(s.createdAt || s.date || '') || 0;
      if (!ts) return;
      points.push({
        t: ts,
        label: formatShortDate(s.createdAt || s.date),
        volume: sessionVolume(s),
        sets: sessionSetCount(s),
        intensity: s.totalIntensity != null ? Number(s.totalIntensity) : null,
      });
    });
    if (savedSession && savedSession.id != null && !seen[String(savedSession.id)]) {
      var stats = computeSessionStats(savedSession);
      var ts = Date.parse(savedSession.createdAt || '') || Date.now();
      points.push({
        t: ts,
        label: formatShortDate(savedSession.createdAt) || 'Today',
        volume: stats.totalVolume,
        sets: stats.completedSetCount,
        intensity: savedSession.totalIntensity != null ? Number(savedSession.totalIntensity) : null,
      });
    }
    points.sort(function (a, b) {
      return a.t - b.t;
    });
    return points.slice(-12);
  }

  function buildTodaySetSeries(savedSession) {
    var points = [];
    var cumulative = 0;
    var idx = 0;
    var exercises =
      savedSession && savedSession.trackerData && Array.isArray(savedSession.trackerData.exercises)
        ? savedSession.trackerData.exercises
        : [];
    exercises.forEach(function (ex) {
      (ex.sets || []).forEach(function (set) {
        if (!set || !set.completed) return;
        idx += 1;
        var w = parseFloat(set.weight);
        var r = parseFloat(set.reps);
        var vol = !isNaN(w) && !isNaN(r) ? w * r : 0;
        cumulative += vol;
        points.push({
          label: String(idx),
          volume: Math.round(cumulative),
          setVolume: Math.round(vol),
          name: ex.name || 'Set',
        });
      });
    });
    return points;
  }

  function renderChartsHtml(savedSession, todaySession) {
    var history = buildHistorySeries(savedSession);
    var todaySets = buildTodaySetSeries(savedSession);
    if (history.length < 1 && todaySets.length < 1) return '';
    return (
      '<div class="wd-summary-charts" id="wd-summary-charts">' +
      '<p class="wd-summary-sub">Your training</p>' +
      (history.length
        ? '<div class="wd-chart-card"><p class="wd-chart-title">Volume over time</p><canvas id="wd-chart-volume" height="160" aria-label="Volume over time"></canvas></div>'
        : '') +
      (todaySets.length
        ? '<div class="wd-chart-card"><p class="wd-chart-title">Volume this session</p><canvas id="wd-chart-session" height="140" aria-label="Session volume by set"></canvas></div>'
        : '') +
      (history.some(function (p) {
        return p.intensity != null;
      })
        ? '<div class="wd-chart-card"><p class="wd-chart-title">Intensity over time</p><canvas id="wd-chart-intensity" height="140" aria-label="Intensity over time"></canvas></div>'
        : '') +
      '</div>'
    );
  }

  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20,20,20,0.92)',
          titleColor: '#ffb347',
          bodyColor: '#f4f4f5',
          borderColor: 'rgba(255,140,0,0.35)',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.55)', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: 'rgba(255,255,255,0.55)' },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    };
  }

  function mountCharts(container, savedSession) {
    if (!container || typeof window.Chart !== 'function') return [];
    var charts = [];
    var history = buildHistorySeries(savedSession);
    var todaySets = buildTodaySetSeries(savedSession);
    var defaults = chartDefaults();

    var volCanvas = container.querySelector('#wd-chart-volume');
    if (volCanvas && history.length) {
      charts.push(
        new window.Chart(volCanvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: history.map(function (p) {
              return p.label;
            }),
            datasets: [
              {
                label: 'Volume (lb)',
                data: history.map(function (p) {
                  return p.volume;
                }),
                borderColor: '#ff9f40',
                backgroundColor: 'rgba(255, 159, 64, 0.18)',
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: '#ffb347',
              },
            ],
          },
          options: defaults,
        })
      );
    }

    var sessionCanvas = container.querySelector('#wd-chart-session');
    if (sessionCanvas && todaySets.length) {
      charts.push(
        new window.Chart(sessionCanvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: todaySets.map(function (p) {
              return 'Set ' + p.label;
            }),
            datasets: [
              {
                label: 'Cumulative volume (lb)',
                data: todaySets.map(function (p) {
                  return p.volume;
                }),
                borderColor: '#ff6a00',
                backgroundColor: 'rgba(255, 106, 0, 0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: '#ff8c00',
              },
            ],
          },
          options: Object.assign({}, defaults, {
            plugins: Object.assign({}, defaults.plugins, {
              tooltip: Object.assign({}, defaults.plugins.tooltip, {
                callbacks: {
                  afterLabel: function (ctx) {
                    var p = todaySets[ctx.dataIndex];
                    return p && p.name ? p.name : '';
                  },
                },
              }),
            }),
          }),
        })
      );
    }

    var intCanvas = container.querySelector('#wd-chart-intensity');
    var intensityPoints = history.filter(function (p) {
      return p.intensity != null && !isNaN(p.intensity);
    });
    if (intCanvas && intensityPoints.length) {
      charts.push(
        new window.Chart(intCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: intensityPoints.map(function (p) {
              return p.label;
            }),
            datasets: [
              {
                label: 'Intensity',
                data: intensityPoints.map(function (p) {
                  return p.intensity;
                }),
                backgroundColor: 'rgba(255, 179, 71, 0.55)',
                borderRadius: 6,
              },
            ],
          },
          options: Object.assign({}, defaults, {
            scales: Object.assign({}, defaults.scales, {
              y: Object.assign({}, defaults.scales.y, { max: 100 }),
            }),
          }),
        })
      );
    }

    return charts;
  }

  window.PostWorkoutSummary = {
    RECENT_WORKOUT_LIMIT: RECENT_WORKOUT_LIMIT,
    buildTodaySessionPayload: buildTodaySessionPayload,
    buildLocalSummaryCards: buildLocalSummaryCards,
    buildRecentWorkoutsText: buildRecentWorkoutsText,
    buildAthleteContext: buildAthleteContext,
    fetchRecoveryAdvice: fetchRecoveryAdvice,
    renderSummaryHtml: renderSummaryHtml,
    renderRecoveryHtml: renderRecoveryHtml,
    renderChartsHtml: renderChartsHtml,
    mountCharts: mountCharts,
  };
})();
