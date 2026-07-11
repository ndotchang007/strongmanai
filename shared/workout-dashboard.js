(function () {
  'use strict';

  var overlay;
  var fab;
  var finishScreen;
  var sessionClockEl;
  var sinceLastClockEl;
  var coachMount;
  var trackerMount;
  var trackerHome = null;
  var opts = {};
  var sessionTimer = null;
  var sessionStart = null;
  var sinceLastState = { running: false, tickStart: null, tick: null, elapsedMs: 0 };
  var lastCompletedCount = 0;
  var lastCompletedSet = null;
  var minimized = true;
  var dashboardActive = false;
  var miniChatPending = false;
  var miniChatMessages = [];
  var summaryCharts = [];

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

  function getSinceLastMs() {
    if (!sinceLastState.running || !sinceLastState.tickStart) return sinceLastState.elapsedMs || 0;
    return Math.max(0, Date.now() - sinceLastState.tickStart);
  }

  function getSinceLastSeconds() {
    return Math.max(0, Math.round(getSinceLastMs() / 1000));
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

  function destroySummaryCharts() {
    summaryCharts.forEach(function (ch) {
      try {
        if (ch && typeof ch.destroy === 'function') ch.destroy();
      } catch (e) {}
    });
    summaryCharts = [];
  }

  function injectDom() {
    var existing = document.getElementById('workout-dashboard-overlay');
    if (existing && !document.getElementById('wd-since-last-clock')) {
      existing.parentNode && existing.parentNode.removeChild(existing);
      var oldFab = document.getElementById('workout-dashboard-fab');
      if (oldFab && oldFab.parentNode) oldFab.parentNode.removeChild(oldFab);
      var oldFinish = document.getElementById('workout-dashboard-finish');
      if (oldFinish && oldFinish.parentNode) oldFinish.parentNode.removeChild(oldFinish);
      existing = null;
    }
    if (existing) {
      overlay = existing;
      fab = document.getElementById('workout-dashboard-fab');
      if (fab && !fab.querySelector('.wd-fab-label')) {
        fab.innerHTML =
          '<span class="wd-fab-icon" aria-hidden="true">▶</span>' +
          '<span class="wd-fab-label">Continue workout</span>' +
          '<span class="wd-fab-time" id="wd-fab-time" aria-hidden="true"></span>';
      }
      finishScreen = document.getElementById('workout-dashboard-finish');
      sessionClockEl = document.getElementById('wd-session-clock');
      sinceLastClockEl = document.getElementById('wd-since-last-clock');
      coachMount = document.getElementById('wd-coach-mount');
      trackerMount = document.getElementById('wd-tracker-mount');
      bindOverlayActions();
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
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-apply-routine-btn">Apply routine</button>' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-minimize-btn" aria-label="Minimize workout">Minimize</button>' +
      '<button type="button" class="wd-btn wd-btn--finish" id="wd-finish-btn">Finish</button>' +
      '</div>' +
      '</header>' +
      '<section class="wd-since-bar" id="wd-since-bar" aria-label="Time since last set" hidden>' +
      '<span class="wd-since-label">Time since last set</span>' +
      '<span class="wd-since-clock" id="wd-since-last-clock">0:00</span>' +
      '</section>' +
      '<section class="wd-coach wd-coach--chat" id="wd-coach-mount" aria-label="Rocky coach">' +
      '<div class="wd-mini-chat">' +
      '<div class="wd-mini-chat-head">' +
      '<span class="wd-mini-chat-title">Rocky</span>' +
      '<a href="/generate" class="wd-coach-open">Full chat →</a>' +
      '</div>' +
      '<div class="wd-mini-chat-thread" id="wd-mini-chat-thread" role="log" aria-live="polite"></div>' +
      '<form class="wd-mini-chat-form" id="wd-mini-chat-form">' +
      '<input type="text" class="wd-mini-chat-input" id="wd-mini-chat-input" placeholder="Ask Rocky for a tip…" autocomplete="off" maxlength="500">' +
      '<button type="submit" class="wd-btn wd-btn--small wd-btn--accent" id="wd-mini-chat-send">Send</button>' +
      '</form>' +
      '<p class="wd-mini-chat-error" id="wd-mini-chat-error" hidden></p>' +
      '</div>' +
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
    sinceLastClockEl = document.getElementById('wd-since-last-clock');
    coachMount = document.getElementById('wd-coach-mount');
    trackerMount = document.getElementById('wd-tracker-mount');

    bindOverlayActions();
  }

  function bindOverlayActions() {
    var minimizeBtn = document.getElementById('wd-minimize-btn');
    var finishBtn = document.getElementById('wd-finish-btn');
    var applyBtn = document.getElementById('wd-apply-routine-btn');
    var chatForm = document.getElementById('wd-mini-chat-form');
    var doneBtn = document.getElementById('wd-finish-done-btn');

    if (minimizeBtn && minimizeBtn.dataset.wdBound !== '1') {
      minimizeBtn.dataset.wdBound = '1';
      minimizeBtn.addEventListener('click', minimize);
    }
    if (finishBtn && finishBtn.dataset.wdBound !== '1') {
      finishBtn.dataset.wdBound = '1';
      finishBtn.addEventListener('click', finishWorkout);
    }
    if (applyBtn && applyBtn.dataset.wdBound !== '1') {
      applyBtn.dataset.wdBound = '1';
      applyBtn.addEventListener('click', handleApplyRoutine);
    }
    if (chatForm && chatForm.dataset.wdBound !== '1') {
      chatForm.dataset.wdBound = '1';
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        sendMiniChat();
      });
    }
    if (doneBtn && doneBtn.dataset.wdBound !== '1') {
      doneBtn.dataset.wdBound = '1';
      doneBtn.addEventListener('click', function () {
        destroySummaryCharts();
        deactivate();
        window.location.href = '/home';
      });
    }
  }

  function handleApplyRoutine() {
    var btn = document.getElementById('wd-apply-routine-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Applying…';
    }
    var done =
      typeof opts.applyRoutine === 'function'
        ? opts.applyRoutine()
        : Promise.resolve();
    Promise.resolve(done)
      .then(function () {
        var t = getTracker();
        if (t) t.render();
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Apply routine';
        }
      })
      .catch(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Apply routine';
        }
      });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getMiniChatWelcome() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (user && (!user.experience || user.experience === 'beginner')) {
      return "Need a form cue or what to do next? Ask me — keep it simple.";
    }
    return 'Need a cue mid-set? Ask me anything.';
  }

  function renderMiniChatThread() {
    var thread = document.getElementById('wd-mini-chat-thread');
    if (!thread) return;
    if (!miniChatMessages.length) {
      thread.innerHTML =
        '<div class="wd-mini-msg wd-mini-msg--rocky"><span class="wd-mini-msg-label">Rocky</span><p>' +
        escapeHtml(getMiniChatWelcome()) +
        '</p></div>';
      return;
    }
    thread.innerHTML = miniChatMessages
      .map(function (m) {
        var cls = m.role === 'user' ? 'wd-mini-msg--user' : 'wd-mini-msg--rocky';
        var label = m.role === 'user' ? 'You' : 'Rocky';
        return (
          '<div class="wd-mini-msg ' +
          cls +
          '"><span class="wd-mini-msg-label">' +
          label +
          '</span><p>' +
          escapeHtml(m.content) +
          '</p></div>'
        );
      })
      .join('');
    thread.scrollTop = thread.scrollHeight;
  }

  function setMiniChatError(msg) {
    var el = document.getElementById('wd-mini-chat-error');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function extractAssistantText(msg) {
    if (!msg) return 'Got it — keep moving.';
    if (msg.content) return String(msg.content);
    if (msg.text) return String(msg.text);
    if (msg.advice && msg.advice.summary) return String(msg.advice.summary);
    if (msg.workout && msg.workout.fyi) return String(msg.workout.fyi);
    return 'Got it — keep moving.';
  }

  function getMiniChatContextBlock() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var extras = { notes: '' };
    try {
      extras.notes = localStorage.getItem('strongman-coach-anything-else') || '';
    } catch (e) {}
    var parts = [];
    if (window.AthleteContext && user && typeof window.AthleteContext.buildCoachPromptBlock === 'function') {
      parts.push(window.AthleteContext.buildCoachPromptBlock(user, extras));
    }
    parts.push(
      '[Workout mode] Athlete is mid-session. Keep replies short (1-3 sentences). Prefer form cues and simple next-step advice. Do not dump a full long workout unless they ask.'
    );
    return parts.filter(Boolean).join('\n\n');
  }

  function sendMiniChat() {
    if (miniChatPending) return;
    var input = document.getElementById('wd-mini-chat-input');
    var sendBtn = document.getElementById('wd-mini-chat-send');
    var text = input && input.value ? input.value.trim() : '';
    if (!text) {
      setMiniChatError('Say something to Rocky.');
      return;
    }
    if (typeof window.apiPost !== 'function') {
      setMiniChatError('Coach unavailable — open Full chat.');
      return;
    }

    setMiniChatError('');
    miniChatPending = true;
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.value = '';

    miniChatMessages.push({ role: 'user', content: text });
    renderMiniChatThread();

    var thread = document.getElementById('wd-mini-chat-thread');
    if (thread) {
      var loading = document.createElement('div');
      loading.className = 'wd-mini-msg wd-mini-msg--rocky wd-mini-msg--loading';
      loading.id = 'wd-mini-chat-loading';
      loading.innerHTML =
        '<span class="wd-mini-msg-label">Rocky</span><p class="wd-mini-typing"><span></span><span></span><span></span></p>';
      thread.appendChild(loading);
      thread.scrollTop = thread.scrollHeight;
    }

    var threadForApi = miniChatMessages.slice(0, -1).map(function (m) {
      return { role: m.role, content: m.content };
    });

    window
      .apiPost('/coach/chat', {
        message: text,
        contextBlock: getMiniChatContextBlock(),
        thread: threadForApi,
      })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (x) {
        var loadingEl = document.getElementById('wd-mini-chat-loading');
        if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        if (!x.res.ok) {
          throw new Error((x.body && x.body.error) || 'Could not reach Rocky.');
        }
        var assistantMsg =
          window.CoachPending && typeof window.CoachPending.buildAssistantMsg === 'function'
            ? window.CoachPending.buildAssistantMsg(x.body)
            : {
                content: (x.body && (x.body.text || (x.body.advice && x.body.advice.summary))) || '',
              };
        miniChatMessages.push({
          role: 'assistant',
          content: extractAssistantText(assistantMsg).slice(0, 600),
        });
        if (miniChatMessages.length > 12) {
          miniChatMessages = miniChatMessages.slice(-12);
        }
        renderMiniChatThread();
      })
      .catch(function (err) {
        var loadingEl = document.getElementById('wd-mini-chat-loading');
        if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        setMiniChatError((err && err.message) || 'Could not reach Rocky.');
        renderMiniChatThread();
      })
      .finally(function () {
        miniChatPending = false;
        if (sendBtn) sendBtn.disabled = false;
      });
  }

  function mountCoachPanel() {
    renderMiniChatThread();
  }

  function restoreCoachPanel() {
    /* Mini chat lives in overlay — nothing to restore. */
  }

  function syncCoachPanel() {
    mountCoachPanel();
  }

  function startSessionClock() {
    stopSessionClock();
    refreshSessionClockDisplay();
    sessionTimer = setInterval(function () {
      refreshSessionClockDisplay();
      updateSinceLastDisplay();
    }, 1000);
  }

  function stopSessionClock() {
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = null;
  }

  function updateSinceLastDisplay() {
    var bar = document.getElementById('wd-since-bar');
    if (!sinceLastClockEl) sinceLastClockEl = document.getElementById('wd-since-last-clock');
    if (!sinceLastClockEl) return;
    if (!sinceLastState.running) {
      if (bar) bar.hidden = true;
      return;
    }
    if (bar) bar.hidden = false;
    sinceLastClockEl.textContent = formatDuration(getSinceLastMs());
  }

  function startSinceLastTimer() {
    stopSinceLastTimer(false);
    sinceLastState.running = true;
    sinceLastState.elapsedMs = 0;
    sinceLastState.tickStart = Date.now();
    updateSinceLastDisplay();
  }

  function stopSinceLastTimer(reset) {
    if (sinceLastState.tick) clearInterval(sinceLastState.tick);
    sinceLastState.tick = null;
    if (reset) {
      sinceLastState.running = false;
      sinceLastState.elapsedMs = 0;
      sinceLastState.tickStart = null;
    }
    updateSinceLastDisplay();
  }

  function applySinceLastToSet(target, seconds) {
    if (!target || !seconds) return;
    var t = getTracker();
    if (t && typeof t.setRestSeconds === 'function') {
      t.setRestSeconds(target.exerciseId, target.setId, seconds);
    }
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
    stopSinceLastTimer(true);
    destroySummaryCharts();
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

  function showFinishScreen(message, html, options) {
    options = options || {};
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
      if (doneBtn) {
        var showDone = !!html && options.showDone !== false;
        if (options.hideDone) showDone = false;
        doneBtn.hidden = !showDone;
      }
    }
    if (overlay) overlay.hidden = true;
  }

  function rockyGeneratingHtml() {
    return (
      '<div class="wd-rocky-generating" id="wd-rocky-generating" aria-live="polite">' +
      '<div class="wd-rocky-generating-orb" aria-hidden="true"></div>' +
      '<p class="wd-rocky-generating-title">Rocky is putting together your summary…</p>' +
      '<p class="wd-rocky-generating-sub">Hang tight — recovery tips and charts are on the way.</p>' +
      '<div class="wd-rocky-generating-bars" aria-hidden="true">' +
      '<span></span><span></span><span></span><span></span>' +
      '</div>' +
      '</div>'
    );
  }

  function showPostWorkoutSummary(savedSession, durationMs) {
    var PWS = window.PostWorkoutSummary;
    durationMs = durationMs != null ? durationMs : getElapsedMs() || null;
    var todaySession =
      PWS && PWS.buildTodaySessionPayload
        ? PWS.buildTodaySessionPayload(savedSession, durationMs)
        : null;

    var titleEl = document.getElementById('wd-finish-title');
    if (titleEl) titleEl.textContent = 'Workout saved';

    if (PWS && todaySession) {
      var chartsHtml =
        typeof PWS.renderChartsHtml === 'function' ? PWS.renderChartsHtml(savedSession, todaySession) : '';
      var localHtml =
        '<div class="wd-summary-block">' +
        '<h2 class="wd-summary-headline">Nice session</h2>' +
        '<ul class="wd-summary-stats">' +
        PWS.buildLocalSummaryCards(todaySession)
          .map(function (c) {
            return '<li>' + escapeHtml(c) + '</li>';
          })
          .join('') +
        '</ul></div>' +
        chartsHtml +
        rockyGeneratingHtml();
      showFinishScreen('', localHtml, { hideDone: true });
      if (typeof PWS.mountCharts === 'function') {
        window.setTimeout(function () {
          summaryCharts = PWS.mountCharts(document.getElementById('wd-finish-body'), savedSession) || [];
        }, 40);
      }
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
        var chartsHtml =
          typeof PWS.renderChartsHtml === 'function' ? PWS.renderChartsHtml(savedSession, todaySession) : '';
        var html = PWS.renderSummaryHtml(data, todaySession, { chartsHtml: chartsHtml });
        showFinishScreen('', html, { showDone: true });
        if (typeof PWS.mountCharts === 'function') {
          window.setTimeout(function () {
            summaryCharts = PWS.mountCharts(document.getElementById('wd-finish-body'), savedSession) || [];
          }, 40);
        }
      })
      .catch(function (err) {
        var chartsHtml =
          typeof PWS.renderChartsHtml === 'function' ? PWS.renderChartsHtml(savedSession, todaySession) : '';
        var errHtml =
          (PWS.renderSummaryHtml
            ? PWS.renderSummaryHtml(null, todaySession, { chartsHtml: chartsHtml })
            : '') +
          '<p class="wd-recovery-error">' +
          escapeHtml(
            err && err.message ? err.message : 'Recovery advice unavailable.'
          ) +
          '</p>';
        showFinishScreen('', errHtml, { showDone: true });
        if (typeof PWS.mountCharts === 'function') {
          window.setTimeout(function () {
            summaryCharts = PWS.mountCharts(document.getElementById('wd-finish-body'), savedSession) || [];
          }, 40);
        }
      });
  }

  function finishWorkout() {
    stopSinceLastTimer(true);
    stopSessionClock();
    var durationMs = getElapsedMs() || null;
    showFinishScreen('Saving your session…', null);
    var done =
      typeof opts.onFinish === 'function' ? opts.onFinish({ durationMs: durationMs }) : Promise.resolve();
    Promise.resolve(done)
      .then(function (savedSession) {
        deactivate();
        showPostWorkoutSummary(savedSession || {}, durationMs);
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
    if (sinceLastState.running && lastCompletedSet) {
      var seconds = getSinceLastSeconds();
      if (seconds > 0) applySinceLastToSet(lastCompletedSet, seconds);
    }
    lastCompletedSet = { exerciseId: exerciseId, setId: setId };
    startSinceLastTimer();
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
      updateSinceLastDisplay();
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
  };
})();
