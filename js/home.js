(function () {
  var welcomeEl = document.getElementById('home-welcome-title');
  var athleteContextEl = document.getElementById('dash-athlete-context');
  var countdownsEl = document.getElementById('dash-countdowns');
  var sportTipEl = document.getElementById('dash-sport-tip');
  var startBtn = document.getElementById('dash-start-workout');
  var startHintEl = document.getElementById('dash-start-hint');
  var roastsListEl = document.getElementById('dash-roasts-list');
  var rockyBannerEl = document.getElementById('dash-rocky-banner');

  function renderRoasts(sessions) {
    if (!roastsListEl) return;
    roastsListEl.innerHTML = '';
    var RCI = window.RockyCoachingInsights;
    if (RCI && typeof RCI.renderInto === 'function') {
      RCI.renderInto(roastsListEl, sessions);
      return;
    }
  }

  function sessionDateKey(s) {
    if (s && s.date) return String(s.date).slice(0, 10);
    if (s && s.createdAt) {
      var d = new Date(s.createdAt);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

  function computeStats(sessions) {
    var now = new Date();
    var weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    var weekMs = weekAgo.getTime();
    var weekCount = 0;
    var totalSets = 0;
    var weekSets = 0;
    var dayKeys = {};

    (sessions || []).forEach(function (s) {
      totalSets += countSetsInSession(s);
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
      totalSets: totalSets
    };
  }

  function renderStats(sessions) {
    var stats = computeStats(sessions);
    var weekEl = document.getElementById('dash-stat-week');
    var streakEl = document.getElementById('dash-stat-streak');
    var volumeEl = document.getElementById('dash-stat-volume');
    var totalEl = document.getElementById('dash-stat-total');
    if (weekEl) weekEl.textContent = String(stats.weekCount);
    if (streakEl) streakEl.textContent = String(stats.streak);
    if (volumeEl) volumeEl.textContent = String(stats.weekSets);
    if (totalEl) totalEl.textContent = String(stats.totalSessions);
  }

  function renderWelcome() {
    if (!welcomeEl) return;
    var hour = new Date().getHours();
    var timeGreeting =
      hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var firstName = null;
    if (typeof window.getCurrentUser === 'function') {
      var user = window.getCurrentUser();
      if (user && user.firstName) firstName = user.firstName;
    }
    welcomeEl.textContent = firstName ? timeGreeting + ', ' + firstName : timeGreeting;
  }

  function renderAthleteContext() {
    if (athleteContextEl) {
      athleteContextEl.textContent = '';
      athleteContextEl.hidden = true;
    }
    if (sportTipEl) {
      sportTipEl.textContent = '';
      sportTipEl.hidden = true;
    }
    var AC = window.AthleteContext;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (countdownsEl && AC && user) {
      var items = AC.getUpcomingCountdowns(user, 3);
      if (items.length) {
        countdownsEl.innerHTML = items
          .map(function (item) {
            return (
              '<span class="dash-countdown-chip">' +
              '<strong>' +
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
    if (startHintEl && AC && user) {
      var ctx = AC.loadAthleteContext(user);
      var sports = AC.getSports(ctx);
      if (
        sports.length ||
        (ctx.practiceDays && ctx.practiceDays.length) ||
        (ctx.gameDays && ctx.gameDays.length)
      ) {
        startHintEl.textContent = AC.getTodayTrainingHint(user).hint;
      }
    }
  }

  function showRockyBanner(html) {
    if (!rockyBannerEl) return;
    rockyBannerEl.innerHTML = html;
    rockyBannerEl.hidden = false;
  }

  function hideRockyBanner() {
    if (!rockyBannerEl) return;
    rockyBannerEl.hidden = true;
    rockyBannerEl.innerHTML = '';
  }

  function refreshRockyCoachStatus() {
    var CP = window.CoachPending;
    if (!CP) return;

    if (CP.isReplyReady()) {
      showRockyBanner(
        '<span class="dash-rocky-banner-text">Rocky replied while you were away.</span>' +
          '<a href="/generate" class="dash-rocky-banner-link">Read message →</a>'
      );
      return;
    }

    if (CP.hasPendingReply()) {
      showRockyBanner(
        '<span class="dash-rocky-banner-text">Rocky is finishing your reply…</span>' +
          '<span class="dash-rocky-banner-sub">You can stay here — we will save it to Coach.</span>'
      );
      CP.resume({
        onSuccess: function () {
          showRockyBanner(
            '<span class="dash-rocky-banner-text">Rocky replied — your message is ready.</span>' +
              '<a href="/generate" class="dash-rocky-banner-link">Open Coach →</a>'
          );
        },
        onError: function (msg, retriable) {
          if (retriable && CP.hasPendingReply()) {
            showRockyBanner(
              '<span class="dash-rocky-banner-text">Still waiting on Rocky…</span>' +
                '<a href="/generate" class="dash-rocky-banner-link">Open Coach</a>'
            );
          } else if (msg) {
            showRockyBanner(
              '<span class="dash-rocky-banner-text">' + msg + '</span>' +
                '<a href="/generate" class="dash-rocky-banner-link">Try again in Coach →</a>'
            );
          }
        },
      });
      return;
    }

    hideRockyBanner();
  }

  function refreshWorkoutCta() {
    var WD = window.WorkoutDashboard;
    if (!startBtn || !WD) return;
    var live = typeof WD.isLiveWorkoutActive === 'function' && WD.isLiveWorkoutActive();
    var strong = startBtn.querySelector('.dash-start-text strong');
    var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    startBtn.classList.toggle('dash-start-btn--live', live);
    startBtn.classList.toggle('dash-start-btn--wiggle', live && isMobile);
    if (live) {
      if (strong) strong.textContent = 'Get back to your workout';
      if (startHintEl && typeof WD.getElapsedLabel === 'function') {
        startHintEl.textContent = WD.getElapsedLabel() + ' elapsed · tap to continue';
      }
    } else if (strong) {
      strong.textContent = 'Start workout';
    }
  }

  function refreshDashboard() {
    var WL = window.WorkoutLog;
    var sessions = WL && typeof WL.getSessions === 'function' ? WL.getSessions() : [];
    renderStats(sessions);
    renderRoasts(sessions);
    renderAthleteContext();
    refreshWorkoutCta();
    if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
      window.RockySetupAlert.renderAll();
    }
  }

  function loadDashboard() {
    var TS = window.TrainingSync;
    if (TS && typeof TS.syncAll === 'function') {
      var cu = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (cu && cu.token) {
        TS.syncAll({ callback: function () { refreshDashboard(); } });
        return;
      }
    }
    refreshDashboard();
  }

  window.addEventListener('strongman:training-synced', function () {
    refreshDashboard();
  });

  renderWelcome();
  renderAthleteContext();
  refreshRockyCoachStatus();
  loadDashboard();

  if (startBtn) {
    startBtn.addEventListener('click', function () {
      var WD = window.WorkoutDashboard;
      if (WD && typeof WD.isLiveWorkoutActive === 'function' && WD.isLiveWorkoutActive()) {
        if (typeof WD.resumeWorkout === 'function') {
          WD.resumeWorkout();
        } else {
          window.location.href = '/create?workout=1';
        }
        return;
      }
      try {
        sessionStorage.setItem('strongman-apply-today-routine', '1');
      } catch (e) {}
      window.location.href = '/create';
    });
  }

  document.addEventListener('workout-live-changed', function () {
    refreshWorkoutCta();
  });

  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('strongman_live_workout_v1') === 0) {
      refreshWorkoutCta();
    }
  });

  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('strongman_workouts') === 0) {
      refreshDashboard();
    }
    if (e.key && e.key.indexOf('strongman-coach-') === 0) {
      refreshRockyCoachStatus();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.body.getAttribute('data-current-page') === 'home') {
      refreshRockyCoachStatus();
      if (window.TrainingSync && typeof window.TrainingSync.syncAll === 'function') {
        window.TrainingSync.syncAll({ callback: function () { refreshDashboard(); } });
      } else {
        loadDashboard();
      }
      refreshWorkoutCta();
    }
  });

  window.refreshHomeWorkoutCta = refreshWorkoutCta;
})();
