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
  var finishState = null;

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
    var needsRebuild =
      existing &&
      (!document.getElementById('wd-cancel-btn') ||
        !document.getElementById('workout-routine-picker') ||
        !document.getElementById('workout-confirm-dialog') ||
        document.getElementById('wd-coach-mount'));
    if (needsRebuild) {
      existing.parentNode && existing.parentNode.removeChild(existing);
      var oldFab = document.getElementById('workout-dashboard-fab');
      if (oldFab && oldFab.parentNode) oldFab.parentNode.removeChild(oldFab);
      var oldFinish = document.getElementById('workout-dashboard-finish');
      if (oldFinish && oldFinish.parentNode) oldFinish.parentNode.removeChild(oldFinish);
      var oldPicker = document.getElementById('workout-routine-picker');
      if (oldPicker && oldPicker.parentNode) oldPicker.parentNode.removeChild(oldPicker);
      var oldConfirm = document.getElementById('workout-confirm-dialog');
      if (oldConfirm && oldConfirm.parentNode) oldConfirm.parentNode.removeChild(oldConfirm);
      existing = null;
    }
    if (existing) {
      overlay = existing;
      fab = document.getElementById('workout-dashboard-fab');
      if (fab && !fab.classList.contains('wd-fab--orange')) fab.classList.add('wd-fab--orange');
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
      bindSwipeToMinimize();
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
      '<div class="wd-swipe-hint" aria-hidden="true"><span class="wd-swipe-pill"></span></div>' +
      '<header class="wd-topbar">' +
      '<div class="wd-topbar-left">' +
      '<span class="wd-session-label">Workout</span>' +
      '<span class="wd-session-clock" id="wd-session-clock">0:00</span>' +
      '</div>' +
      '<div class="wd-topbar-actions">' +
      '<button type="button" class="wd-btn wd-btn--ghost wd-btn--danger" id="wd-cancel-btn">Cancel</button>' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-minimize-btn" aria-label="Minimize workout">Minimize</button>' +
      '<button type="button" class="wd-btn wd-btn--finish" id="wd-finish-btn">Finish</button>' +
      '</div>' +
      '</header>' +
      '<section class="wd-since-bar" id="wd-since-bar" aria-label="Time since last set">' +
      '<span class="wd-since-label">Time since last set</span>' +
      '<span class="wd-since-clock" id="wd-since-last-clock">—</span>' +
      '</section>' +
      '<section class="wd-log" id="wd-tracker-mount" aria-label="Log sets"></section>' +
      '</div>';
    document.body.appendChild(overlay);

    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'workout-dashboard-fab';
    fab.className = 'wd-fab wd-fab--orange';
    fab.hidden = true;
    fab.setAttribute('aria-label', 'Return to workout');
    fab.innerHTML =
      '<span class="wd-fab-icon" aria-hidden="true">▶</span>' +
      '<span class="wd-fab-label">Continue workout</span>' +
      '<span class="wd-fab-time" id="wd-fab-time" aria-hidden="true"></span>';
    document.body.appendChild(fab);

    var picker = document.createElement('div');
    picker.id = 'workout-routine-picker';
    picker.className = 'wd-routine-picker';
    picker.hidden = true;
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-modal', 'true');
    picker.setAttribute('aria-labelledby', 'wd-routine-picker-title');
    picker.innerHTML =
      '<div class="wd-routine-picker-panel">' +
      '<h2 class="wd-routine-picker-title" id="wd-routine-picker-title">Start workout</h2>' +
      '<p class="wd-routine-picker-lede">Pick a saved split or freestyle with your own exercises.</p>' +
      '<div class="wd-routine-picker-list" id="wd-routine-picker-list"></div>' +
      '<button type="button" class="wd-btn wd-btn--ghost wd-routine-picker-cancel" id="wd-routine-picker-cancel">Cancel</button>' +
      '</div>';
    document.body.appendChild(picker);

    var confirmEl = document.createElement('div');
    confirmEl.id = 'workout-confirm-dialog';
    confirmEl.className = 'wd-confirm';
    confirmEl.hidden = true;
    confirmEl.setAttribute('role', 'dialog');
    confirmEl.setAttribute('aria-modal', 'true');
    confirmEl.innerHTML =
      '<div class="wd-confirm-panel">' +
      '<h2 class="wd-confirm-title" id="wd-confirm-title">Are you sure?</h2>' +
      '<p class="wd-confirm-text" id="wd-confirm-text"></p>' +
      '<div class="wd-confirm-actions">' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-confirm-no">Keep going</button>' +
      '<button type="button" class="wd-btn wd-btn--finish" id="wd-confirm-yes">Confirm</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(confirmEl);

    finishScreen = document.createElement('div');
    finishScreen.id = 'workout-dashboard-finish';
    finishScreen.className = 'wd-finish';
    finishScreen.hidden = true;
    finishScreen.innerHTML =
      '<div class="wd-finish-card wd-finish-card--summary" id="wd-finish-card">' +
      '<div class="wd-finish-mark" id="wd-finish-mark" aria-hidden="true" hidden></div>' +
      '<h2 class="wd-finish-title" id="wd-finish-title" hidden>Session wrap-up</h2>' +
      '<p class="wd-finish-text" id="wd-finish-text" hidden></p>' +
      '<div class="wd-finish-body" id="wd-finish-body" hidden></div>' +
      '<div class="wd-finish-actions" hidden>' +
      '<button type="button" class="wd-btn wd-btn--finish wd-finish-done-btn" id="wd-finish-done-btn" hidden>Done</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(finishScreen);

    sessionClockEl = document.getElementById('wd-session-clock');
    sinceLastClockEl = document.getElementById('wd-since-last-clock');
    coachMount = document.getElementById('wd-coach-mount');
    trackerMount = document.getElementById('wd-tracker-mount');

    bindOverlayActions();
    bindSwipeToMinimize();
  }

  function bindOverlayActions() {
    var minimizeBtn = document.getElementById('wd-minimize-btn');
    var finishBtn = document.getElementById('wd-finish-btn');
    var cancelBtn = document.getElementById('wd-cancel-btn');
    var doneBtn = document.getElementById('wd-finish-done-btn');
    var pickerCancel = document.getElementById('wd-routine-picker-cancel');
    var confirmNo = document.getElementById('wd-confirm-no');
    var confirmYes = document.getElementById('wd-confirm-yes');

    if (minimizeBtn && minimizeBtn.dataset.wdBound !== '1') {
      minimizeBtn.dataset.wdBound = '1';
      minimizeBtn.addEventListener('click', minimize);
    }
    if (finishBtn && finishBtn.dataset.wdBound !== '1') {
      finishBtn.dataset.wdBound = '1';
      finishBtn.addEventListener('click', function () {
        showConfirm({
          title: 'Finish workout?',
          text: 'Wrap up and review your stats? You can keep going if this was accidental.',
          confirmLabel: 'Finish',
          onConfirm: finishWorkout,
        });
      });
    }
    if (cancelBtn && cancelBtn.dataset.wdBound !== '1') {
      cancelBtn.dataset.wdBound = '1';
      cancelBtn.addEventListener('click', function () {
        showConfirm({
          title: 'Cancel workout?',
          text: 'This discards the current session and returns you to the logbook.',
          confirmLabel: 'Cancel workout',
          danger: true,
          onConfirm: cancelWorkout,
        });
      });
    }
    if (doneBtn && doneBtn.dataset.wdBound !== '1') {
      doneBtn.dataset.wdBound = '1';
      doneBtn.addEventListener('click', function () {
        startRestingSequence();
      });
    }
    if (pickerCancel && pickerCancel.dataset.wdBound !== '1') {
      pickerCancel.dataset.wdBound = '1';
      pickerCancel.addEventListener('click', hideRoutinePicker);
    }
    if (confirmNo && confirmNo.dataset.wdBound !== '1') {
      confirmNo.dataset.wdBound = '1';
      confirmNo.addEventListener('click', hideConfirm);
    }
    if (confirmYes && confirmYes.dataset.wdBound !== '1') {
      confirmYes.dataset.wdBound = '1';
      confirmYes.addEventListener('click', function () {
        var fn = confirmCallback;
        hideConfirm();
        if (typeof fn === 'function') fn();
      });
    }
  }

  var confirmCallback = null;
  var swipeState = { startY: 0, startX: 0, tracking: false };

  function showConfirm(options) {
    options = options || {};
    var dialog = document.getElementById('workout-confirm-dialog');
    var title = document.getElementById('wd-confirm-title');
    var text = document.getElementById('wd-confirm-text');
    var yes = document.getElementById('wd-confirm-yes');
    if (!dialog) return;
    if (title) title.textContent = options.title || 'Are you sure?';
    if (text) text.textContent = options.text || '';
    if (yes) {
      yes.textContent = options.confirmLabel || 'Confirm';
      yes.classList.toggle('wd-btn--danger', !!options.danger);
    }
    confirmCallback = options.onConfirm || null;
    dialog.hidden = false;
  }

  function hideConfirm() {
    var dialog = document.getElementById('workout-confirm-dialog');
    if (dialog) dialog.hidden = true;
    confirmCallback = null;
  }

  function cancelWorkout() {
    stopSinceLastTimer(true);
    stopSessionClock();
    if (typeof opts.onCancel === 'function') opts.onCancel();
    deactivate();
  }

  function hideRoutinePicker() {
    var picker = document.getElementById('workout-routine-picker');
    if (picker) picker.hidden = true;
  }

  function showRoutinePicker() {
    injectDom();
    var picker = document.getElementById('workout-routine-picker');
    var list = document.getElementById('wd-routine-picker-list');
    if (!picker || !list) return;
    list.innerHTML = '';

    var freestyle = document.createElement('button');
    freestyle.type = 'button';
    freestyle.className = 'wd-routine-option wd-routine-option--freestyle';
    freestyle.innerHTML =
      '<span class="wd-routine-option-title">Freestyle</span>' +
      '<span class="wd-routine-option-sub">Pick exercises as you go</span>';
    freestyle.addEventListener('click', function () {
      hideRoutinePicker();
      beginWorkout({ mode: 'freestyle' });
    });
    list.appendChild(freestyle);

    var splits =
      typeof opts.listSplitOptions === 'function' ? opts.listSplitOptions() || [] : [];
    splits.forEach(function (split) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wd-routine-option';
      btn.innerHTML =
        '<span class="wd-routine-option-title"></span>' +
        '<span class="wd-routine-option-sub">Use today\'s planned lifts · weights autofilled</span>';
      btn.querySelector('.wd-routine-option-title').textContent =
        split.programName || 'Saved split';
      btn.addEventListener('click', function () {
        hideRoutinePicker();
        beginWorkout({ mode: 'split', splitId: split.id });
      });
      list.appendChild(btn);
    });

    if (!splits.length) {
      var empty = document.createElement('p');
      empty.className = 'wd-routine-empty';
      empty.textContent = 'No saved splits yet — freestyle or set one up in Workout split.';
      list.appendChild(empty);
    }

    picker.hidden = false;
  }

  function bindSwipeToMinimize() {
    if (!overlay || overlay.dataset.wdSwipeBound === '1') return;
    overlay.dataset.wdSwipeBound = '1';
    var shell = overlay.querySelector('.wd-shell');
    if (!shell) return;

    shell.addEventListener(
      'touchstart',
      function (e) {
        if (!e.touches || !e.touches.length) return;
        var t = e.touches[0];
        // Only start from the top region / swipe hint so scrolling cards still works
        var topZone = t.clientY < 120;
        if (!topZone) {
          swipeState.tracking = false;
          return;
        }
        swipeState.startY = t.clientY;
        swipeState.startX = t.clientX;
        swipeState.tracking = true;
      },
      { passive: true }
    );

    shell.addEventListener(
      'touchmove',
      function (e) {
        if (!swipeState.tracking || !e.touches || !e.touches.length) return;
        var t = e.touches[0];
        var dy = t.clientY - swipeState.startY;
        var dx = Math.abs(t.clientX - swipeState.startX);
        if (dy > 30 && dy > dx * 1.2) {
          shell.style.transform = 'translateY(' + Math.min(dy, 160) + 'px)';
          shell.style.opacity = String(Math.max(0.45, 1 - dy / 280));
        }
      },
      { passive: true }
    );

    shell.addEventListener(
      'touchend',
      function (e) {
        if (!swipeState.tracking) return;
        swipeState.tracking = false;
        var changed = e.changedTouches && e.changedTouches[0];
        var dy = changed ? changed.clientY - swipeState.startY : 0;
        shell.style.transform = '';
        shell.style.opacity = '';
        if (dy > 90) minimize();
      },
      { passive: true }
    );
  }

  function handleApplyRoutine() {
    var done =
      typeof opts.applyRoutine === 'function' ? opts.applyRoutine() : Promise.resolve();
    return Promise.resolve(done).then(function () {
      var t = getTracker();
      if (t) t.render();
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
    if (window.CoachMemory && typeof window.CoachMemory.buildPromptBlock === 'function') {
      var memBlock = window.CoachMemory.buildPromptBlock(window.CoachMemory.load());
      if (memBlock) parts.push(memBlock);
    }
    var t = getTracker && getTracker();
    var session = t && t.getSession ? t.getSession() : null;
    if (session && session.exercises && session.exercises.length) {
      var lifts = session.exercises
        .filter(function (ex) {
          return ex && ex.name;
        })
        .map(function (ex) {
          return ex.name;
        })
        .slice(0, 12);
      if (lifts.length) {
        parts.push(
          '[Current workout lifts] ' +
            lifts.join(', ') +
            '\nOnly give cues/advice relevant to these lifts and nearby muscle groups. Do not invent unrelated injuries (e.g. do not mention knee pain during a chest session unless the athlete said so).'
        );
      }
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
    if (window.CoachMemory && typeof window.CoachMemory.ingestUserMessage === 'function') {
      window.CoachMemory.ingestUserMessage(text);
    }

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
    /* Coach mini-chat removed from workout mode for a cleaner UI. */
  }

  function restoreCoachPanel() {
    /* no-op */
  }

  function syncCoachPanel() {
    /* no-op */
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
    if (bar) bar.hidden = false;
    if (!sinceLastState.running) {
      sinceLastClockEl.textContent = '—';
      return;
    }
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
    return t;
  }

  function openQuickLog() {
    injectDom();
    if (dashboardActive && !minimized) {
      minimize();
    }
    if (window.CreateUI && typeof window.CreateUI.showQuickLog === 'function') {
      window.CreateUI.showQuickLog();
    } else {
      var panel = document.getElementById('create-panel-workout');
      if (panel) panel.hidden = false;
      var shell = document.getElementById('create-workout-shell');
      if (shell) shell.setAttribute('data-log-style', 'quick');
    }
    var section = document.getElementById('logbook-quick-section');
    if (section) {
      section.hidden = false;
      section.classList.remove('logbook-quick-section--collapsed');
      window.setTimeout(function () {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
      section.classList.add('logbook-quick-highlight');
      window.setTimeout(function () {
        section.classList.remove('logbook-quick-highlight');
      }, 2200);
    }
    var hero = document.getElementById('logbook-mode-hero');
    if (hero) hero.classList.add('logbook-mode-hero--compact');
    var t = ensureSessionReady();
    if (t) {
      if (isLiveWorkoutActive()) {
        // Don't rewrite the live session into quick-log mode.
        if (t.setViewMode) t.setViewMode('card');
      } else {
        if (typeof t.reset === 'function') t.reset();
        if (typeof t.setLoggingMode === 'function') t.setLoggingMode('quick');
        else if (t.setViewMode) t.setViewMode('card');
      }
    }
  }

  function beginWorkout(choice) {
    injectDom();
    if (!getTracker() && (hasStoredSession() || isLiveWorkoutActive())) {
      window.location.href = '/create?workout=1';
      return;
    }
    var start =
      typeof opts.startFromChoice === 'function'
        ? opts.startFromChoice(choice)
        : Promise.resolve();
    Promise.resolve(start)
      .then(function () {
        var t = getTracker();
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
        if (window.CreateUI && typeof window.CreateUI.showLiveWorkout === 'function') {
          window.CreateUI.showLiveWorkout();
        } else {
          var shell = document.getElementById('create-workout-shell');
          if (shell) shell.setAttribute('data-log-style', 'coach');
        }
        if (typeof t.setLoggingMode === 'function') t.setLoggingMode('live');
        if (t.setViewMode) t.setViewMode('carousel');
        if (typeof t.setCarouselIndex === 'function') t.setCarouselIndex(0);
        lastCompletedCount = countCompletedSets(t.getSession());
        mountTracker();
        syncFab();
      })
      .catch(function () {
        var t = getTracker();
        if (!t) return;
        open({ resume: true, skipPicker: true });
      });
  }

  function open(options) {
    options = options || {};
    injectDom();
    if (!getTracker() && (hasStoredSession() || isLiveWorkoutActive())) {
      window.location.href = '/create?workout=1';
      return;
    }

    // Resume live / mid-session without re-picking routine
    if (options.resume || options.skipPicker || isLiveWorkoutActive()) {
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
      if (t.setViewMode) t.setViewMode('carousel');
      lastCompletedCount = countCompletedSets(t.getSession());
      mountTracker();
      syncFab();
      return;
    }

    showRoutinePicker();
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
    if (finishScreen) {
      finishScreen.hidden = true;
      finishScreen.classList.remove('wd-finish--page');
    }
    document.body.classList.remove('workout-dashboard-open');
    document.body.classList.remove('wd-finish-open');
    restoreTracker();
    restoreCoachPanel();
    syncFab();
  }

  function updatePrimaryWorkoutButtons() {
    var live = isLiveWorkoutActive();
    var elapsed = live ? getElapsedLabel() : '';
    var startBtn = document.getElementById('wd-start-workout-btn');
    if (startBtn) {
      startBtn.textContent = live ? 'Continue workout' : 'Start workout';
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
      finishScreen.classList.add('wd-finish--page');
      document.body.classList.add('wd-finish-open');
      var text = document.getElementById('wd-finish-text');
      var title = document.getElementById('wd-finish-title');
      var body = document.getElementById('wd-finish-body');
      var card = document.getElementById('wd-finish-card');
      var doneBtn = document.getElementById('wd-finish-done-btn');
      if (card) card.classList.toggle('wd-finish-card--resting', !!(html && html.indexOf('wd-resting') !== -1));
      if (text) text.textContent = message || '';
      if (body) {
        if (html) {
          body.innerHTML = html;
          body.hidden = false;
          if (text) text.hidden = true;
          if (title) title.hidden = true;
        } else {
          body.hidden = true;
          body.innerHTML = '';
          if (text) text.hidden = false;
          if (title) title.hidden = true;
        }
      }
      if (doneBtn) {
        var showDone = !!html && options.showDone !== false;
        if (options.hideDone) showDone = false;
        doneBtn.hidden = !showDone;
      }
    }
    if (overlay) overlay.hidden = true;
    if (fab) fab.hidden = true;
  }

  function rockyGeneratingHtml() {
    return (
      '<div class="wd-rocky-generating" id="wd-rocky-generating" aria-live="polite">' +
      '<div class="wd-rocky-generating-orb" aria-hidden="true"></div>' +
      '<p class="wd-rocky-generating-title">Rocky is cooking up the tea…</p>' +
      '<p class="wd-rocky-generating-sub">Stats first. Roast + recovery next.</p>' +
      '<div class="wd-rocky-generating-bars" aria-hidden="true">' +
      '<span></span><span></span><span></span><span></span>' +
      '</div>' +
      '</div>'
    );
  }

  function reviewExerciseRows(session) {
    var rows = [];
    if (session && session.trackerData && Array.isArray(session.trackerData.exercises)) {
      session.trackerData.exercises.forEach(function (ex, idx) {
        if (!ex) return;
        var sets = Array.isArray(ex.sets) ? ex.sets : [];
        var done = sets.filter(function (s) {
          return s && (s.completed || s.done);
        }).length;
        rows.push({
          name: ex.name || 'Exercise',
          meta: done ? done + ' set' + (done === 1 ? '' : 's') : sets.length ? sets.length + ' sets' : '',
          source: 'tracker',
          index: idx,
        });
      });
      return rows;
    }
    if (session && Array.isArray(session.exercises)) {
      session.exercises.forEach(function (ex, idx) {
        if (!ex || !ex.name) return;
        rows.push({
          name: ex.name,
          meta: [ex.sets, ex.reps].filter(Boolean).join(' × ') || '',
          source: 'legacy',
          index: idx,
        });
      });
    }
    return rows;
  }

  function resizeImageFile(file, maxDim, quality, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        try {
          cb(null, c.toDataURL('image/jpeg', quality));
        } catch (err) {
          cb(err);
        }
      };
      img.onerror = function () {
        cb(new Error('image'));
      };
      img.src = fr.result;
    };
    fr.onerror = function () {
      cb(new Error('read'));
    };
    fr.readAsDataURL(file);
  }

  function ensureFinishState(draft, durationMs) {
    finishState = {
      durationMs: durationMs,
      draft: draft || {},
      photos: Array.isArray(draft && draft.photos) ? draft.photos.slice() : [],
      rockyData: null,
      rockyError: null,
    };
    return finishState;
  }

  function getDraft() {
    return (finishState && finishState.draft) || {};
  }

  function syncDraftToFormFields() {
    var d = getDraft();
    var formTitle = document.getElementById('create-session-title');
    var formNotes = document.getElementById('create-notes');
    var formIntensity = document.getElementById('create-session-intensity-user');
    if (formTitle && d.title != null) formTitle.value = d.title;
    if (formNotes && d.notes != null) formNotes.value = d.notes;
    if (formIntensity && d.totalIntensity != null) formIntensity.value = String(d.totalIntensity);
  }

  function closeEditSheet() {
    var sheet = document.getElementById('wd-edit-sheet');
    if (sheet) sheet.remove();
  }

  function openFieldEditor(kind, index) {
    var d = getDraft();
    var detail = document.getElementById('wd-edit-detail');
    if (!detail) return;
    var label = 'Edit';
    var value = '';
    var inputType = 'text';
    if (kind === 'title') {
      label = 'Session title';
      value = d.title || d.splitName || '';
    } else if (kind === 'intensity') {
      label = 'Intensity (0–100)';
      value = d.totalIntensity != null ? String(d.totalIntensity) : '';
      inputType = 'number';
    } else if (kind === 'notes') {
      label = 'Notes for Rocky';
      value = d.notes || '';
      inputType = 'textarea';
    } else if (kind === 'exercise') {
      label = 'Exercise name';
      var rows = reviewExerciseRows(d);
      value = rows[index] ? rows[index].name : '';
    }
    detail.hidden = false;
    detail.innerHTML =
      '<p class="wd-edit-detail-label">' +
      escapeHtml(label) +
      '</p>' +
      (inputType === 'textarea'
        ? '<textarea id="wd-edit-value" rows="3" maxlength="800">' + escapeHtml(value) + '</textarea>'
        : '<input id="wd-edit-value" type="' +
          inputType +
          '" maxlength="80" value="' +
          escapeHtml(value) +
          '"' +
          (inputType === 'number' ? ' min="0" max="100" inputmode="numeric"' : '') +
          '>') +
      '<div class="wd-edit-detail-actions">' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="wd-edit-cancel">Back</button>' +
      '<button type="button" class="wd-btn wd-btn--finish" id="wd-edit-save">Save</button>' +
      '</div>';
    var list = document.getElementById('wd-edit-timeline');
    if (list) list.hidden = true;
    var cancel = document.getElementById('wd-edit-cancel');
    var save = document.getElementById('wd-edit-save');
    if (cancel) {
      cancel.addEventListener('click', function () {
        openEditSheet();
      });
    }
    if (save) {
      save.addEventListener('click', function () {
        var el = document.getElementById('wd-edit-value');
        var next = el ? el.value.trim() : '';
        if (kind === 'title') {
          finishState.draft.title = next || finishState.draft.title;
        } else if (kind === 'intensity') {
          if (next === '') {
            finishState.draft.totalIntensity = null;
          } else {
            var n = parseInt(next, 10);
            if (isNaN(n) || n < 0 || n > 100) {
              if (el) el.classList.add('wd-review-invalid');
              return;
            }
            finishState.draft.totalIntensity = n;
          }
        } else if (kind === 'notes') {
          finishState.draft.notes = next;
        } else if (kind === 'exercise') {
          if (next) {
            if (
              finishState.draft.trackerData &&
              Array.isArray(finishState.draft.trackerData.exercises) &&
              finishState.draft.trackerData.exercises[index]
            ) {
              finishState.draft.trackerData.exercises[index].name = next;
            }
            if (Array.isArray(finishState.draft.exercises) && finishState.draft.exercises[index]) {
              finishState.draft.exercises[index].name = next;
            }
          }
        }
        syncDraftToFormFields();
        openEditSheet();
        renderFinishDashboard();
      });
    }
    var focusEl = document.getElementById('wd-edit-value');
    if (focusEl) focusEl.focus();
  }

  function openEditSheet() {
    closeEditSheet();
    var d = getDraft();
    var lifts = reviewExerciseRows(d);
    var items =
      '<li class="wd-edit-item" data-edit="title">' +
      '<span class="wd-edit-item-type">Title</span>' +
      '<span class="wd-edit-item-value">' +
      escapeHtml(d.title || d.splitName || 'Workout') +
      '</span></li>' +
      '<li class="wd-edit-item" data-edit="intensity">' +
      '<span class="wd-edit-item-type">Intensity</span>' +
      '<span class="wd-edit-item-value">' +
      escapeHtml(d.totalIntensity != null ? String(d.totalIntensity) : 'Not set') +
      '</span></li>' +
      '<li class="wd-edit-item" data-edit="notes">' +
      '<span class="wd-edit-item-type">Notes for Rocky</span>' +
      '<span class="wd-edit-item-value">' +
      escapeHtml(d.notes ? d.notes : 'Tap to add injuries, soreness, etc.') +
      '</span></li>';
    lifts.forEach(function (row, idx) {
      items +=
        '<li class="wd-edit-item" data-edit="exercise" data-ex-index="' +
        idx +
        '">' +
        '<span class="wd-edit-item-type">Exercise</span>' +
        '<span class="wd-edit-item-value">' +
        escapeHtml(row.name) +
        (row.meta ? ' · ' + escapeHtml(row.meta) : '') +
        '</span></li>';
    });

    var sheet = document.createElement('div');
    sheet.id = 'wd-edit-sheet';
    sheet.className = 'wd-edit-sheet';
    sheet.innerHTML =
      '<div class="wd-edit-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="wd-edit-sheet-title">' +
      '<header class="wd-edit-sheet-head">' +
      '<h3 id="wd-edit-sheet-title">Edit session</h3>' +
      '<button type="button" class="wd-edit-sheet-close" id="wd-edit-sheet-close" aria-label="Close">×</button>' +
      '</header>' +
      '<p class="wd-edit-sheet-lede">Tap a row to change it — same idea as your timeline.</p>' +
      '<ol class="wd-edit-timeline" id="wd-edit-timeline">' +
      items +
      '</ol>' +
      '<div class="wd-edit-detail" id="wd-edit-detail" hidden></div>' +
      '</div>';
    document.body.appendChild(sheet);
    document.getElementById('wd-edit-sheet-close').addEventListener('click', closeEditSheet);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) closeEditSheet();
    });
    sheet.querySelectorAll('.wd-edit-item').forEach(function (row) {
      row.addEventListener('click', function () {
        var kind = row.getAttribute('data-edit');
        var idx = parseInt(row.getAttribute('data-ex-index') || '0', 10);
        openFieldEditor(kind, idx);
      });
    });
  }

  function continueWorkoutFromFinish() {
    closeEditSheet();
    destroySummaryCharts();
    if (finishScreen) {
      finishScreen.hidden = true;
      finishScreen.classList.remove('wd-finish--page');
    }
    document.body.classList.remove('wd-finish-open');
    finishState = null;
    if (overlay) {
      overlay.hidden = false;
      document.body.classList.add('workout-dashboard-open');
    }
    minimized = false;
    dashboardActive = true;
    startSessionClock();
    syncFab();
  }

  function bindFinishDashboardActions() {
    var cont = document.getElementById('wd-finish-continue');
    if (cont) {
      cont.addEventListener('click', continueWorkoutFromFinish);
    }
    var editBtn = document.getElementById('wd-finish-edit');
    if (editBtn) {
      editBtn.addEventListener('click', openEditSheet);
    }
    var restBtn = document.getElementById('wd-finish-rest');
    if (restBtn) {
      restBtn.addEventListener('click', startRestingSequence);
    }
    var shareBtn = document.getElementById('wd-finish-share');
    if (shareBtn && window.StorySticker) {
      shareBtn.addEventListener('click', function () {
        var status = document.getElementById('wd-finish-share-status');
        var session = Object.assign({}, getDraft(), {
          photos: (finishState && finishState.photos) || [],
        });
        if (status) status.textContent = 'Saving sticker…';
        window.StorySticker.shareWorkoutToInstagram(
          session,
          {
            incTitle: true,
            incDateTime: true,
            incExercises: true,
            incIntensity: true,
            incNotes: true,
          },
          window.WorkoutLog,
          function (result) {
            if (!status) return;
            if (result && result.blocked) {
              status.textContent = '';
              return;
            }
            if (!result || !result.ok) {
              status.textContent = 'Could not create sticker. Try again.';
              return;
            }
            status.textContent =
              'Sticker saved. In Instagram, add it from Photos and stick it on your Story.';
          }
        );
      });
    }
    var photoBtn = document.getElementById('wd-finish-photo');
    var photoInput = document.getElementById('wd-physique-input');
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', function () {
        photoInput.click();
      });
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;
        resizeImageFile(file, 1400, 0.82, function (err, dataUrl) {
          photoInput.value = '';
          if (err || !dataUrl || !finishState) return;
          finishState.photos.push({
            id: 'phys_' + Date.now().toString(36),
            dataUrl: dataUrl,
            createdAt: new Date().toISOString(),
            kind: 'physique',
          });
          finishState.draft.photos = finishState.photos.slice();
          renderFinishDashboard();
        });
      });
    }
    document.querySelectorAll('[data-remove-photo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-remove-photo');
        if (!finishState || !id) return;
        finishState.photos = finishState.photos.filter(function (p) {
          return p && p.id !== id;
        });
        finishState.draft.photos = finishState.photos.slice();
        renderFinishDashboard();
      });
    });
  }

  function renderFinishDashboard() {
    if (!finishState) return;
    var PWS = window.PostWorkoutSummary;
    var draft = getDraft();
    var durationMs = finishState.durationMs;
    var todaySession =
      PWS && PWS.buildTodaySessionPayload
        ? PWS.buildTodaySessionPayload(draft, durationMs)
        : null;
    var trend =
      PWS && PWS.buildTrendMessage
        ? PWS.buildTrendMessage(draft, todaySession)
        : { tone: 'steady', text: 'Solid work — rest like it matters.' };
    var cards =
      PWS && todaySession && PWS.buildLocalSummaryCards
        ? PWS.buildLocalSummaryCards(todaySession)
        : [];

    var photosHtml = '<div class="wd-physique">';
    photosHtml +=
      '<div class="wd-physique-head"><p class="wd-physique-title">Physique check-in</p>' +
      '<button type="button" class="wd-physique-add" id="wd-finish-photo">Add photo</button></div>';
    photosHtml +=
      '<input type="file" id="wd-physique-input" accept="image/*" capture="environment" hidden>';
    if (finishState.photos.length) {
      photosHtml += '<div class="wd-physique-grid">';
      finishState.photos.forEach(function (p) {
        photosHtml +=
          '<figure class="wd-physique-fig">' +
          '<img src="' +
          escapeHtml(p.dataUrl) +
          '" alt="Physique photo">' +
          '<button type="button" class="wd-physique-remove" data-remove-photo="' +
          escapeHtml(p.id) +
          '">Remove</button></figure>';
      });
      photosHtml += '</div>';
    } else {
      photosHtml +=
        '<p class="wd-physique-empty">Optional: snap a physique photo for your log (stays on this device).</p>';
    }
    photosHtml += '</div>';

    var rockyHtml = '';
    if (finishState.rockyData && PWS && PWS.renderRecoveryHtml) {
      rockyHtml =
        '<div class="wd-finish-rocky">' +
        (finishState.rockyData.summary && finishState.rockyData.summary.headline
          ? '<p class="wd-finish-rocky-kicker">' +
            escapeHtml(finishState.rockyData.summary.headline) +
            '</p>'
          : '') +
        PWS.renderRecoveryHtml(finishState.rockyData.recovery) +
        '</div>';
    } else if (finishState.rockyError) {
      rockyHtml =
        '<p class="wd-recovery-error">' + escapeHtml(finishState.rockyError) + '</p>';
    } else {
      rockyHtml = rockyGeneratingHtml();
    }

    var html =
      '<div class="wd-finish-page" id="wd-finish-dash">' +
      '<header class="wd-finish-page-head">' +
      '<p class="wd-finish-kicker">Session complete</p>' +
      '<h1 class="wd-finish-dash-title">You put in the work</h1>' +
      '<p class="wd-finish-trend wd-finish-trend--' +
      escapeHtml(trend.tone || 'steady') +
      '">' +
      escapeHtml(trend.text) +
      '</p>' +
      '</header>' +
      '<ul class="wd-finish-stat-grid" aria-label="Session stats">';
    cards.slice(0, 6).forEach(function (c) {
      html += '<li class="wd-finish-stat">' + escapeHtml(c) + '</li>';
    });
    html +=
      '</ul>' +
      '<section class="wd-finish-section wd-finish-section--rocky" aria-label="Rocky advice">' +
      rockyHtml +
      '</section>' +
      '<section class="wd-finish-section">' +
      photosHtml +
      '</section>' +
      '<div class="wd-finish-tools">' +
      '<button type="button" class="wd-tool-btn" id="wd-finish-share">Share to Story</button>' +
      '<button type="button" class="wd-tool-btn" id="wd-finish-edit">Edit</button>' +
      '<button type="button" class="wd-tool-btn wd-tool-btn--ghost" id="wd-finish-continue">Keep lifting</button>' +
      '</div>' +
      '<p class="wd-finish-share-status" id="wd-finish-share-status" role="status"></p>' +
      '<div class="wd-finish-footer">' +
      '<button type="button" class="wd-rest-btn" id="wd-finish-rest">Start resting</button>' +
      '</div>' +
      '</div>';

    showFinishScreen('', html, { hideDone: true });
    destroySummaryCharts();
    bindFinishDashboardActions();
  }

  function loadRockyForFinish() {
    var PWS = window.PostWorkoutSummary;
    if (!finishState || !PWS || !PWS.fetchRecoveryAdvice) {
      if (finishState) {
        finishState.rockyError = 'Rocky tips unavailable offline.';
        renderFinishDashboard();
      }
      return;
    }
    PWS.fetchRecoveryAdvice(finishState.draft, finishState.durationMs)
      .then(function (data) {
        if (!finishState) return;
        finishState.rockyData = data;
        finishState.rockyError = null;
        renderFinishDashboard();
      })
      .catch(function (err) {
        if (!finishState) return;
        finishState.rockyError =
          (err && err.message) || 'Rocky got distracted. Your stats still count.';
        renderFinishDashboard();
      });
  }

  function showFinishDashboard(draft, durationMs) {
    ensureFinishState(draft, durationMs);
    syncDraftToFormFields();
    var mark = document.getElementById('wd-finish-mark');
    if (mark) mark.hidden = true;
    renderFinishDashboard();
    loadRockyForFinish();
  }

  function restingMarkHtml() {
    return (
      '<div class="wd-resting" id="wd-resting" aria-live="polite">' +
      '<div class="wd-resting-mark" aria-hidden="true">' +
      '<svg class="wd-resting-svg" viewBox="0 0 52 52" width="88" height="88">' +
      '<circle class="wd-resting-track" cx="26" cy="26" r="22" fill="none" />' +
      '<circle class="wd-resting-arc" cx="26" cy="26" r="22" fill="none" />' +
      '<path class="wd-resting-checkpath" fill="none" d="M15.5 27.2l7.2 7.2 14-14" />' +
      '</svg>' +
      '</div>' +
      '<p class="wd-resting-text" id="wd-resting-text">Saving your session…</p>' +
      '</div>'
    );
  }

  function startRestingSequence() {
    closeEditSheet();
    if (!finishState) {
      deactivate();
      window.location.href = '/home';
      return;
    }
    var draft = Object.assign({}, getDraft(), {
      photos: finishState.photos.slice(),
    });
    var durationMs = finishState.durationMs;
    var notes = draft.notes || '';
    var animStarted = Date.now();

    showFinishScreen('', restingMarkHtml(), { hideDone: true });

    var done =
      typeof opts.onFinish === 'function'
        ? opts.onFinish({
            durationMs: durationMs,
            session: draft,
            photos: draft.photos,
            notes: notes,
            title: draft.title,
            totalIntensity: draft.totalIntensity,
          })
        : Promise.resolve(draft);

    Promise.resolve(done)
      .then(function () {
        if (notes && window.CoachMemory && typeof window.CoachMemory.ingestUserMessage === 'function') {
          window.CoachMemory.ingestUserMessage(notes);
        }
        var minSpin = Math.max(0, 1000 - (Date.now() - animStarted));
        window.setTimeout(function () {
          var root = document.getElementById('wd-resting');
          var textEl = document.getElementById('wd-resting-text');
          if (root) root.classList.add('wd-resting--done');
          if (textEl) textEl.textContent = 'Well done.';
          window.setTimeout(function () {
            destroySummaryCharts();
            finishState = null;
            deactivate();
            window.location.href = '/home';
          }, 950);
        }, minSpin);
      })
      .catch(function (err) {
        showFinishScreen(
          (err && err.message) || 'Could not save workout. Try again.',
          null
        );
        window.setTimeout(function () {
          if (finishState) renderFinishDashboard();
        }, 1600);
      });
  }

  function finishWorkout() {
    stopSinceLastTimer(true);
    stopSessionClock();
    var durationMs = getElapsedMs() || null;
    showFinishScreen('Packing up your stats…', null);
    var preview =
      typeof opts.onFinish === 'function'
        ? opts.onFinish({ durationMs: durationMs, preview: true })
        : Promise.resolve({});
    Promise.resolve(preview)
      .then(function (draft) {
        /* Keep live session so "Keep lifting" can resume */
        minimized = true;
        if (overlay) overlay.hidden = true;
        document.body.classList.remove('workout-dashboard-open');
        showFinishDashboard(draft || {}, durationMs);
      })
      .catch(function (err) {
        showFinishScreen(
          (err && err.message) || 'Could not wrap up workout. Try again.',
          null
        );
        window.setTimeout(function () {
          if (finishScreen) finishScreen.hidden = true;
          if (overlay) {
            overlay.hidden = false;
            document.body.classList.add('workout-dashboard-open');
            minimized = false;
            dashboardActive = true;
            startSessionClock();
            syncFab();
          }
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
      open({ resume: true });
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
