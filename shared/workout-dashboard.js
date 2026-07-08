(function () {
  'use strict';

  var overlay;
  var fab;
  var finishScreen;
  var sessionClockEl;
  var restClockEl;
  var coachMount;
  var trackerMount;
  var trackerHome = null;
  var opts = {};
  var sessionTimer = null;
  var sessionStart = null;
  var restState = { running: false, paused: false, elapsedMs: 0, tick: null, tickStart: null };
  var lastCompletedCount = 0;
  var lastCompletedSet = null;
  var pendingRestSeconds = 0;
  var coachHome = null;
  var minimized = true;
  var dashboardActive = false;

  var AUTO_REST_KEY = 'strongman-workout-auto-save-rest';
  var LIVE_WORKOUT_KEY_BASE = 'strongman_live_workout_v1';

  function storageUserSuffix() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '_guest';
      var u = window.getCurrentUser();
      return u && u.id != null ? '_u' + u.id : '_guest';
    } catch (e) {
      return '_guest';
    }
  }

  function liveWorkoutStorageKey() {
    return LIVE_WORKOUT_KEY_BASE + storageUserSuffix();
  }

  function loadLiveWorkoutRecord() {
    try {
      var raw = localStorage.getItem(liveWorkoutStorageKey());
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.active || !data.startedAt) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveLiveWorkoutRecord(record) {
    try {
      localStorage.setItem(liveWorkoutStorageKey(), JSON.stringify(record));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearLiveWorkoutRecord() {
    try {
      localStorage.removeItem(liveWorkoutStorageKey());
    } catch (e) {}
  }

  function notifyLiveWorkoutChanged() {
    try {
      document.dispatchEvent(new CustomEvent('workout-live-changed'));
    } catch (e) {}
  }

  function persistLiveWorkout() {
    if (!dashboardActive || !sessionStart) {
      clearLiveWorkoutRecord();
      notifyLiveWorkoutChanged();
      return;
    }
    saveLiveWorkoutRecord({
      active: true,
      startedAt: sessionStart,
      minimized: minimized,
    });
    notifyLiveWorkoutChanged();
  }

  function restoreSessionStartFromStorage() {
    var live = loadLiveWorkoutRecord();
    if (live && live.startedAt) return live.startedAt;
    return null;
  }

  function restoreLiveWorkoutState() {
    var live = loadLiveWorkoutRecord();
    if (!live) return false;
    dashboardActive = true;
    sessionStart = live.startedAt;
    minimized = live.minimized !== false;
    return true;
  }

  function getElapsedMs() {
    if (!sessionStart) {
      var live = loadLiveWorkoutRecord();
      if (live && live.startedAt) sessionStart = live.startedAt;
    }
    if (!sessionStart) return 0;
    return Math.max(0, Date.now() - sessionStart);
  }

  function getElapsedLabel() {
    return formatDuration(getElapsedMs());
  }

  function isLiveWorkoutActive() {
    if (dashboardActive && sessionStart) return true;
    return !!loadLiveWorkoutRecord();
  }

  function updateFabDisplay() {
    if (!fab) return;
    var timeEl = document.getElementById('wd-fab-time');
    var labelEl = fab.querySelector('.wd-fab-label');
    if (timeEl) timeEl.textContent = getElapsedLabel();
    if (labelEl) labelEl.textContent = 'Continue workout';
  }

  function refreshSessionClockDisplay() {
    if (sessionClockEl && sessionStart) {
      sessionClockEl.textContent = formatDuration(getElapsedMs());
    }
    updateFabDisplay();
    if (typeof window.refreshHomeWorkoutCta === 'function' && document.getElementById('dash-start-workout')) {
      window.refreshHomeWorkoutCta();
    }
  }

  function isAutoSaveRest() {
    try {
      return localStorage.getItem(AUTO_REST_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function getElapsedRestSeconds() {
    var ms = restState.elapsedMs;
    if (restState.running && !restState.paused && restState.tickStart) {
      ms = Date.now() - restState.tickStart;
    }
    return Math.max(0, Math.round(ms / 1000));
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDuration(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ':' + pad(m) + ':' + pad(sec);
    return m + ':' + pad(sec);
  }

  function hasStoredSession() {
    var S = window.WorkoutSession;
    if (!S || typeof S.loadSession !== 'function') return false;
    var s = S.loadSession();
    return !!(s && s.status === 'active' && s.exercises && s.exercises.length);
  }

  function getTracker() {
    if (typeof opts.getTracker === 'function') return opts.getTracker();
    return window.WorkoutTracker && window.WorkoutTracker.getInstance
      ? window.WorkoutTracker.getInstance()
      : null;
  }

  function countCompletedSets(session) {
    var n = 0;
    if (!session || !session.exercises) return 0;
    session.exercises.forEach(function (ex) {
      (ex.sets || []).forEach(function (s) {
        if (s.completed) n++;
      });
    });
    return n;
  }

  function injectDom() {
    if (document.getElementById('workout-dashboard-overlay')) {
      overlay = document.getElementById('workout-dashboard-overlay');
      fab = document.getElementById('workout-dashboard-fab');
      if (fab && !fab.querySelector('.wd-fab-label')) {
        fab.innerHTML =
          '<span class="wd-fab-icon" aria-hidden="true">▶</span>' +
          '<span class="wd-fab-label">Continue workout</span>' +
          '<span class="wd-fab-time" id="wd-fab-time" aria-hidden="true"></span>';
      }
      finishScreen = document.getElementById('workout-dashboard-finish');
      sessionClockEl = document.getElementById('wd-session-clock');
      restClockEl = document.getElementById('wd-rest-clock');
      coachMount = document.getElementById('wd-coach-mount');
      trackerMount = document.getElementById('wd-tracker-mount');
      bindTrackerListeners();
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'workout-dashboard-overlay';
    overlay.className = 'wd-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Workout mode');
    overlay.innerHTML =
      '<div class="wd-shell">' +
      '<header class="wd-topbar">' +
      '<div class="wd-topbar-left">' +
      '<span class="wd-session-label">Workout</span>' +
      '<span class="wd-session-clock" id="wd-session-clock">0:00</span>' +
      '</div>' +
      '<div class="wd-topbar-actions">' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-minimize-btn" aria-label="Minimize workout">Minimize</button>' +
      '<button type="button" class="wd-btn wd-btn--finish" id="wd-finish-btn">Finish</button>' +
      '</div>' +
      '</header>' +
      '<section class="wd-rest-bar" aria-label="Rest timer">' +
      '<div class="wd-rest-meta">' +
      '<span class="wd-rest-label">Rest</span>' +
      '<span class="wd-rest-clock" id="wd-rest-clock">0:00</span>' +
      '</div>' +
      '<div class="wd-rest-controls">' +
      '<button type="button" class="wd-btn wd-btn--small" id="wd-rest-pause">Pause</button>' +
      '<button type="button" class="wd-btn wd-btn--small wd-btn--accent" id="wd-start-next-set">Start next set</button>' +
      '<button type="button" class="wd-btn wd-btn--small" id="wd-rest-reset">Reset</button>' +
      '</div>' +
      '<div class="wd-rest-save" id="wd-rest-save" hidden>' +
      '<span class="wd-rest-save-label" id="wd-rest-save-label">Save rest time?</span>' +
      '<button type="button" class="wd-btn wd-btn--small wd-btn--accent" id="wd-rest-save-yes">Save rest</button>' +
      '<button type="button" class="wd-btn wd-btn--small" id="wd-rest-save-skip">Skip</button>' +
      '</div>' +
      '</section>' +
      '<section class="wd-coach" id="wd-coach-mount" aria-label="Rocky coach">' +
      '<div class="wd-coach-head">' +
      '<a href="/generate" class="wd-coach-open">Chat with Rocky →</a>' +
      '</div>' +
      '<div class="wd-coach-body" id="wd-coach-body"></div>' +
      '</section>' +
      '<section class="wd-log" id="wd-tracker-mount" aria-label="Log sets"></section>' +
      '</div>';
    document.body.appendChild(overlay);

    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'workout-dashboard-fab';
    fab.className = 'wd-fab';
    fab.hidden = true;
    fab.setAttribute('aria-label', 'Return to workout');
    fab.innerHTML =
      '<span class="wd-fab-icon" aria-hidden="true">▶</span>' +
      '<span class="wd-fab-label">Continue workout</span>' +
      '<span class="wd-fab-time" id="wd-fab-time" aria-hidden="true"></span>';
    document.body.appendChild(fab);

    finishScreen = document.createElement('div');
    finishScreen.id = 'workout-dashboard-finish';
    finishScreen.className = 'wd-finish';
    finishScreen.hidden = true;
    finishScreen.innerHTML =
      '<div class="wd-finish-card wd-finish-card--summary">' +
      '<div class="wd-finish-mark" aria-hidden="true">✓</div>' +
      '<h2 class="wd-finish-title" id="wd-finish-title">Workout saved</h2>' +
      '<p class="wd-finish-text" id="wd-finish-text">Building your summary…</p>' +
      '<div class="wd-finish-body" id="wd-finish-body" hidden></div>' +
      '<div class="wd-finish-actions">' +
      '<button type="button" class="wd-btn wd-btn--finish wd-finish-done-btn" id="wd-finish-done-btn" hidden>Back to dashboard</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(finishScreen);

    sessionClockEl = document.getElementById('wd-session-clock');
    restClockEl = document.getElementById('wd-rest-clock');
    coachMount = document.getElementById('wd-coach-mount');
    trackerMount = document.getElementById('wd-tracker-mount');

    document.getElementById('wd-minimize-btn').addEventListener('click', minimize);
    document.getElementById('wd-finish-btn').addEventListener('click', finishWorkout);
    document.getElementById('wd-rest-pause').addEventListener('click', toggleRestPause);
    document.getElementById('wd-rest-reset').addEventListener('click', function () {
      stopRestTimer(true);
      hideRestSavePrompt();
    });
    document.getElementById('wd-start-next-set').addEventListener('click', handleStartNextSet);
    document.getElementById('wd-rest-save-yes').addEventListener('click', confirmSaveRest);
    document.getElementById('wd-rest-save-skip').addEventListener('click', hideRestSavePrompt);
    bindTrackerListeners();

    var doneBtn = document.getElementById('wd-finish-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        deactivate();
        window.location.href = '/home';
      });
    }
  }

  function bindTrackerListeners() {
    if (!trackerMount || trackerMount.dataset.wdBound === '1') return;
    trackerMount.dataset.wdBound = '1';
    trackerMount.addEventListener(
      'focusin',
      function (e) {
        if (!restState.running || !dashboardActive) return;
        var inp = e.target.closest('[data-wt-field="set-weight"], [data-wt-field="set-reps"]');
        if (!inp) return;
        var exId = inp.getAttribute('data-exercise-id');
        var setId = inp.getAttribute('data-set-id');
        var t = getTracker();
        if (!t || typeof t.findSet !== 'function') return;
        var found = t.findSet(exId, setId);
        if (found && found.set && !found.set.completed) {
          handleStartNextSet();
        }
      },
      true
    );
    trackerMount.addEventListener('click', function (e) {
      if (!restState.running) return;
      if (e.target.closest('[data-wt-action="focus-next"]')) handleStartNextSet();
    });
  }

  function hideRestSavePrompt() {
    var el = document.getElementById('wd-rest-save');
    if (el) el.hidden = true;
    pendingRestSeconds = 0;
  }

  function showRestSavePrompt(seconds) {
    pendingRestSeconds = seconds;
    var wrap = document.getElementById('wd-rest-save');
    var label = document.getElementById('wd-rest-save-label');
    if (!wrap || !label) return;
    label.textContent = 'Save ' + formatDuration(seconds * 1000) + ' as rest time?';
    wrap.hidden = false;
  }

  function applyRestToLastSet(seconds) {
    var target = lastCompletedSet || findFirstSetNeedingRest();
    if (!target || !seconds) return;
    var t = getTracker();
    if (t && typeof t.setRestSeconds === 'function') {
      t.setRestSeconds(target.exerciseId, target.setId, seconds);
    }
    hideRestSavePrompt();
  }

  function findFirstSetNeedingRest() {
    var t = getTracker();
    if (!t || typeof t.getSession !== 'function') return null;
    var session = t.getSession();
    if (!session || !session.exercises) return null;
    var target = null;
    session.exercises.forEach(function (ex) {
      (ex.sets || []).forEach(function (set) {
        if (set.completed && (set.restSeconds == null || set.restSeconds === 0)) {
          target = { exerciseId: ex.id, setId: set.id };
        }
      });
    });
    return target;
  }

  function pauseRestAndCapture() {
    if (!restState.running) return 0;
    if (!restState.paused && restState.tickStart) {
      restState.paused = true;
      restState.elapsedMs = Date.now() - restState.tickStart;
    }
    if (restState.tick) clearInterval(restState.tick);
    restState.tick = null;
    restState.running = false;
    updateRestDisplay();
    return getElapsedRestSeconds();
  }

  function handleStartNextSet() {
    if (!restState.running && !restState.paused) return;
    var seconds = pauseRestAndCapture();
    if (!seconds || !lastCompletedSet) {
      hideRestSavePrompt();
      return;
    }
    if (isAutoSaveRest()) {
      applyRestToLastSet(seconds);
      return;
    }
    showRestSavePrompt(seconds);
  }

  function confirmSaveRest() {
    applyRestToLastSet(pendingRestSeconds || getElapsedRestSeconds());
  }

  function mountCoachPanel() {
    var body = document.getElementById('wd-coach-body');
    if (!body) return;
    var sessions = [];
    var WL = window.WorkoutLog;
    if (WL && typeof WL.getSessions === 'function') {
      sessions = WL.getSessions() || [];
    }
    if (window.RockyCoachingInsights && typeof window.RockyCoachingInsights.renderInto === 'function') {
      window.RockyCoachingInsights.renderInto(body, sessions, { compact: true, limit: 2 });
      return;
    }
    body.innerHTML =
      '<div class="wd-coach-fallback"><p class="wd-coach-eyebrow">Rocky</p><p class="wd-coach-line">Open Coach for workouts, recovery tips, and straight talk.</p></div>';
  }

  function restoreCoachPanel() {
    /* Coach panel renders inline — nothing to restore. */
  }

  function syncCoachPanel() {
    mountCoachPanel();
  }

  function startSessionClock() {
    stopSessionClock();
    refreshSessionClockDisplay();
    sessionTimer = setInterval(function () {
      refreshSessionClockDisplay();
    }, 1000);
  }

  function stopSessionClock() {
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = null;
  }

  function updateRestDisplay() {
    if (!restClockEl) return;
    var ms = restState.elapsedMs;
    if (restState.running && !restState.paused && restState.tickStart) {
      ms = Date.now() - restState.tickStart;
    }
    restClockEl.textContent = formatDuration(ms);
    var pauseBtn = document.getElementById('wd-rest-pause');
    if (pauseBtn) pauseBtn.textContent = restState.paused ? 'Resume' : 'Pause';
  }

  function startRestTimer() {
    stopRestTimer(false);
    restState.running = true;
    restState.paused = false;
    restState.elapsedMs = 0;
    restState.tickStart = Date.now();
    restState.tick = setInterval(function () {
      if (!restState.running || restState.paused) return;
      updateRestDisplay();
    }, 250);
    updateRestDisplay();
  }

  function toggleRestPause() {
    if (!restState.running) {
      startRestTimer();
      return;
    }
    if (restState.paused) {
      restState.paused = false;
      restState.tickStart = Date.now() - restState.elapsedMs;
    } else {
      restState.paused = true;
      restState.elapsedMs = Date.now() - restState.tickStart;
    }
    updateRestDisplay();
  }

  function stopRestTimer(reset) {
    if (restState.tick) clearInterval(restState.tick);
    restState.tick = null;
    if (reset) {
      restState.running = false;
      restState.paused = false;
      restState.elapsedMs = 0;
      restState.tickStart = null;
    }
    updateRestDisplay();
  }

  function rememberTrackerHome() {
    var root = document.getElementById('workout-tracker-root');
    if (root && root.parentElement) trackerHome = root.parentElement;
  }

  function mountTracker() {
    var root = document.getElementById('workout-tracker-root');
    if (!root || !trackerMount) return;
    if (!trackerHome) rememberTrackerHome();
    trackerMount.appendChild(root);
    var t = getTracker();
    if (t) t.render();
  }

  function restoreTracker() {
    var root = document.getElementById('workout-tracker-root');
    if (!root || !trackerHome) return;
    trackerHome.appendChild(root);
    var t = getTracker();
    if (t) t.render();
  }

  function ensureSessionReady() {
    var t = getTracker();
    if (!t) return null;
    if (typeof opts.bootstrapSession === 'function') {
      opts.bootstrapSession(t);
    }
    if (!t.session.exercises || !t.session.exercises.length) {
      t.addExercise('');
    }
    return t;
  }

  function openQuickLog() {
    injectDom();
    if (dashboardActive && !minimized) {
      minimize();
    }
    var section =
      document.getElementById('logbook-quick-section') ||
      document.getElementById('create-workout-form') ||
      document.querySelector('.session-logbook-zone');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.classList.add('logbook-quick-highlight');
      window.setTimeout(function () {
        section.classList.remove('logbook-quick-highlight');
      }, 2200);
    }
    var t = ensureSessionReady();
    if (t && t.setViewMode && !isMobileViewport()) {
      t.setViewMode('card');
    }
  }

  function open(options) {
    options = options || {};
    injectDom();
    if (!getTracker() && (hasStoredSession() || isLiveWorkoutActive())) {
      window.location.href = '/create?workout=1';
      return;
    }
    var t = ensureSessionReady();
    if (!t) return;
    minimized = false;
    dashboardActive = true;
    overlay.hidden = false;
    document.body.classList.add('workout-dashboard-open');
    if (!sessionStart) {
      sessionStart = restoreSessionStartFromStorage() || Date.now();
    }
    persistLiveWorkout();
    startSessionClock();
    if (t.setViewMode) t.setViewMode('focus');
    lastCompletedCount = countCompletedSets(t.getSession());
    mountTracker();
    syncCoachPanel();
    if (typeof opts.refreshCoach === 'function') opts.refreshCoach();
    syncFab();
  }

  function minimize() {
    minimized = true;
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('workout-dashboard-open');
    restoreTracker();
    restoreCoachPanel();
    persistLiveWorkout();
    syncFab();
  }

  function deactivate() {
    dashboardActive = false;
    minimized = true;
    sessionStart = null;
    lastCompletedSet = null;
    stopSessionClock();
    stopRestTimer(true);
    hideRestSavePrompt();
    clearLiveWorkoutRecord();
    notifyLiveWorkoutChanged();
    if (overlay) overlay.hidden = true;
    if (finishScreen) finishScreen.hidden = true;
    document.body.classList.remove('workout-dashboard-open');
    restoreTracker();
    restoreCoachPanel();
    syncFab();
  }

  function updatePrimaryWorkoutButtons() {
    var live = isLiveWorkoutActive();
    var elapsed = live ? getElapsedLabel() : '';
    var startBtn = document.getElementById('wd-start-workout-btn');
    if (startBtn) {
      startBtn.textContent = live ? 'Continue workout mode' : 'Start workout mode';
      startBtn.classList.toggle('wd-start-btn--resume', live);
      if (live && elapsed) {
        startBtn.setAttribute('aria-description', elapsed + ' elapsed');
      } else {
        startBtn.removeAttribute('aria-description');
      }
    }
  }

  function syncFab() {
    if (!fab) return;
    var live = isLiveWorkoutActive();
    var show = live && minimized;
    fab.hidden = !show;
    fab.classList.toggle('wd-fab--wiggle', show);
    fab.classList.toggle('wd-fab--live', live);
    if (show) updateFabDisplay();
    updatePrimaryWorkoutButtons();
  }

  function showFinishScreen(message, html) {
    if (finishScreen) {
      finishScreen.hidden = false;
      var text = document.getElementById('wd-finish-text');
      var body = document.getElementById('wd-finish-body');
      var doneBtn = document.getElementById('wd-finish-done-btn');
      if (text) text.textContent = message || '';
      if (body) {
        if (html) {
          body.innerHTML = html;
          body.hidden = false;
          if (text) text.hidden = true;
        } else {
          body.hidden = true;
          body.innerHTML = '';
          if (text) text.hidden = false;
        }
      }
      if (doneBtn) doneBtn.hidden = !html;
    }
    if (overlay) overlay.hidden = true;
  }

  function showPostWorkoutSummary(savedSession) {
    var PWS = window.PostWorkoutSummary;
    var durationMs = getElapsedMs() || null;
    var todaySession =
      PWS && PWS.buildTodaySessionPayload
        ? PWS.buildTodaySessionPayload(savedSession, durationMs)
        : null;

    var titleEl = document.getElementById('wd-finish-title');
    if (titleEl) titleEl.textContent = 'Workout saved';

    if (PWS && todaySession) {
      var localHtml =
        '<div class="wd-summary-block">' +
        '<h2 class="wd-summary-headline">Nice session</h2>' +
        '<ul class="wd-summary-stats">' +
        PWS.buildLocalSummaryCards(todaySession)
          .map(function (c) {
            return '<li>' + c.replace(/</g, '&lt;') + '</li>';
          })
          .join('') +
        '</ul></div>' +
        '<p class="wd-recovery-loading">Rocky is putting together recovery advice…</p>';
      showFinishScreen('', localHtml);
    } else {
      showFinishScreen('Workout saved. Nice session!', null);
      var doneBtn = document.getElementById('wd-finish-done-btn');
      if (doneBtn) doneBtn.hidden = false;
      return;
    }

    if (!PWS || !PWS.fetchRecoveryAdvice) {
      var doneBtnFallback = document.getElementById('wd-finish-done-btn');
      if (doneBtnFallback) doneBtnFallback.hidden = false;
      return;
    }

    PWS.fetchRecoveryAdvice(savedSession, durationMs)
      .then(function (data) {
        var html = PWS.renderSummaryHtml(data, todaySession);
        showFinishScreen('', html);
      })
      .catch(function (err) {
        var errHtml =
          (PWS.renderSummaryHtml
            ? PWS.renderSummaryHtml(null, todaySession)
            : '') +
          '<p class="wd-recovery-error">' +
          (err && err.message
            ? String(err.message).replace(/</g, '&lt;')
            : 'Recovery advice unavailable.') +
          '</p>';
        showFinishScreen('', errHtml);
      });
  }

  function finishWorkout() {
    stopRestTimer(true);
    stopSessionClock();
    showFinishScreen('Saving your session…', null);
    var durationMs = getElapsedMs() || null;
    var done =
      typeof opts.onFinish === 'function' ? opts.onFinish({ durationMs: durationMs }) : Promise.resolve();
    Promise.resolve(done)
      .then(function (savedSession) {
        deactivate();
        showPostWorkoutSummary(savedSession || {});
      })
      .catch(function (err) {
        showFinishScreen((err && err.message) || 'Could not save — try again from Log.', null);
        setTimeout(function () {
          if (finishScreen) finishScreen.hidden = true;
          open();
        }, 2200);
      });
  }

  function onSetCompleted(exerciseId, setId) {
    if (!dashboardActive) return;
    lastCompletedSet = { exerciseId: exerciseId, setId: setId };
    hideRestSavePrompt();
    startRestTimer();
  }

  function onTrackerChange(session) {
    if (!session) return;
    if (session.exercises && session.exercises.length && isLiveWorkoutActive()) {
      dashboardActive = true;
    }
    var completed = countCompletedSets(session);
    lastCompletedCount = completed;
    syncFab();
  }

  function hasActiveSession() {
    return isLiveWorkoutActive();
  }

  function resumeWorkout() {
    if (getTracker()) {
      open();
      return;
    }
    window.location.href = '/create?workout=1';
  }

  function bindGlobalListeners() {
    if (document.body && document.body.dataset.wdGlobalBound === '1') return;
    if (document.body) document.body.dataset.wdGlobalBound = '1';

    document.addEventListener('visibilitychange', function () {
      if (document.hidden || !isLiveWorkoutActive()) return;
      refreshSessionClockDisplay();
    });

    window.addEventListener('storage', function (e) {
      if (e.key !== liveWorkoutStorageKey()) return;
      if (e.newValue) {
        restoreLiveWorkoutState();
      } else {
        dashboardActive = false;
        sessionStart = null;
        minimized = true;
      }
      syncFab();
      refreshSessionClockDisplay();
    });

    document.addEventListener('workout-live-changed', function () {
      syncFab();
      refreshSessionClockDisplay();
    });
  }

  function init(options) {
    opts = options || {};
    injectDom();
    rememberTrackerHome();
    bindTrackerListeners();
    bindGlobalListeners();

    var hadLive = restoreLiveWorkoutState();
    if (hadLive) {
      refreshSessionClockDisplay();
      if (!minimized && getTracker()) {
        open({ resume: true });
      } else {
        startSessionClock();
        syncFab();
      }
    } else {
      syncFab();
    }

    updatePrimaryWorkoutButtons();

    if (!fab.dataset.wdBound) {
      fab.dataset.wdBound = '1';
      fab.addEventListener('click', resumeWorkout);
    }

    var startBtn = document.getElementById('wd-start-workout-btn');
    if (startBtn && startBtn.dataset.wdBound !== '1') {
      startBtn.dataset.wdBound = '1';
      startBtn.addEventListener('click', open);
    }
    var quickBtn = document.getElementById('wd-quick-log-btn');
    if (quickBtn && quickBtn.dataset.wdBound !== '1') {
      quickBtn.dataset.wdBound = '1';
      quickBtn.addEventListener('click', openQuickLog);
    }

    if (window.location.search.indexOf('workout=1') >= 0) {
      open();
    }
  }

  function isMobileViewport() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
  }

  window.WorkoutDashboard = {
    init: init,
    open: open,
    openQuickLog: openQuickLog,
    minimize: minimize,
    deactivate: deactivate,
    resumeWorkout: resumeWorkout,
    refreshCoachPanel: syncCoachPanel,
    onTrackerChange: onTrackerChange,
    onSetCompleted: onSetCompleted,
    isActive: function () {
      return dashboardActive && !minimized;
    },
    isLiveWorkoutActive: isLiveWorkoutActive,
    getElapsedMs: getElapsedMs,
    getElapsedLabel: getElapsedLabel,
    hasActiveSession: hasActiveSession,
    AUTO_REST_KEY: AUTO_REST_KEY,
  };
})();
