(function () {
  var WL = window.WorkoutLog;
  var STORY_W = 1080;
  var STORY_H = 1920;

  var currentPage = document.body.getAttribute('data-current-page');
  if (currentPage) {
    document.querySelectorAll('.sidebar-link').forEach(function (link) {
      if (link.getAttribute('data-page') === currentPage) {
        link.classList.add('sidebar-link-active');
      } else {
        link.classList.remove('sidebar-link-active');
      }
    });
  }

  var tabSplit = document.getElementById('create-tab-split');
  var panelWorkout = document.getElementById('create-panel-workout');
  var panelTracking = document.getElementById('create-panel-tracking');
  var panelSplit = document.getElementById('create-panel-split');
  var progressShell = document.getElementById('create-progress-shell');
  var gotoProgressLink = document.getElementById('create-goto-progress-link');
  var primaryTrackingTabs = document.querySelectorAll('.tracking-mode-tabs .tracking-mode-tab');

  function applySplitAutofillFromPicker() {
    var WS = window.WorkoutSplit;
    var splitInp = document.getElementById('create-split');
    var dtInp = document.getElementById('create-datetime');
    if (!WS || !splitInp || !dtInp) return;
    var dtVal = dtInp.value;
    var d;
    if (dtVal) {
      var p = dtVal.split('T');
      if (p[0]) {
        var ps = p[0].split('-');
        if (ps.length === 3) {
          d = new Date(parseInt(ps[0], 10), parseInt(ps[1], 10) - 1, parseInt(ps[2], 10));
        }
      }
    }
    if (!d || isNaN(d.getTime())) d = new Date();
    splitInp.value = WS.splitFieldLineForDate(null, d);
  }

  function mountSplitEditor() {
    var mount = document.getElementById('create-split-editor-mount');
    if (!mount || !window.WorkoutSplitEditor) return;
    if (mount.getAttribute('data-split-editor-mounted') === '1') {
      window.WorkoutSplitEditor.loadActiveSplit();
      return;
    }
    window.WorkoutSplitEditor.mount(mount, {
      manageLibrary: true,
      onChange: function () {
        applySplitAutofillFromPicker();
        refreshSplitBadges();
      },
    });
    mount.setAttribute('data-split-editor-mounted', '1');
  }

  function loadSplitEditorForm() {
    mountSplitEditor();
    if (window.WorkoutSplitEditor) {
      window.WorkoutSplitEditor.loadActiveSplit();
      if (window.WorkoutSplitEditor.syncSetCurrentButton) {
        window.WorkoutSplitEditor.syncSetCurrentButton();
      }
    }
  }

  function dateFromDatetimeLocal(val) {
    if (!val) return new Date();
    var p = val.split('T');
    if (p[0]) {
      var ps = p[0].split('-');
      if (ps.length === 3) {
        var d = new Date(parseInt(ps[0], 10), parseInt(ps[1], 10) - 1, parseInt(ps[2], 10));
        if (!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  }

  function showRockySplitRec(title, body) {
    var box = document.getElementById('create-rocky-split-rec');
    var titleEl = document.getElementById('create-rocky-split-rec-title');
    var bodyEl = document.getElementById('create-rocky-split-rec-body');
    if (!box || !titleEl || !bodyEl) return;
    if (!title) {
      box.hidden = true;
      titleEl.textContent = '';
      bodyEl.textContent = '';
      return;
    }
    titleEl.textContent = title;
    bodyEl.textContent = body || '';
    box.hidden = false;
  }

  function refreshSplitBadges() {
    var WS = window.WorkoutSplit;
    if (!WS) return;
    var count = WS.getUnseenSplitCount ? WS.getUnseenSplitCount() : 0;
    var tabBadge = document.getElementById('create-split-tab-badge');
    if (tabBadge) {
      if (count > 0) {
        tabBadge.hidden = false;
        tabBadge.textContent = count > 9 ? '9+' : String(count);
      } else {
        tabBadge.hidden = true;
        tabBadge.textContent = '';
      }
    }
  }

  function renderSplitPickerSelect() {
    refreshSplitBadges();
    if (window.WorkoutSplitEditor && typeof window.WorkoutSplitEditor.renderLibrary === 'function') {
      window.WorkoutSplitEditor.renderLibrary();
    }
  }

  function enrichExercisesWithHistory(exercises) {
    var S = window.WorkoutSession;
    if (!S || !exercises || !exercises.length) return exercises || [];
    return exercises.map(function (ex) {
      var next = Object.assign({}, ex);
      var hasWeight = next.weight != null && String(next.weight).trim() !== '';
      var hasReps = next.reps != null && String(next.reps).trim() !== '';
      if (hasWeight && hasReps) return next;
      var prev = S.getPreviousPerformance(next.name);
      if (!prev || !prev.length) return next;
      var weights = [];
      var repsList = [];
      prev.forEach(function (line) {
        var parts = String(line).split('×').map(function (p) {
          return p.trim();
        });
        weights.push(parts[0] || '');
        if (parts[1]) repsList.push(parts[1]);
      });
      if (!hasWeight) {
        var allSame = weights.every(function (w) {
          return w === weights[0];
        });
        if (allSame && weights[0]) next.weight = weights[0];
        else if (weights.some(Boolean)) next.setWeights = weights;
      }
      if (!hasReps && repsList.length) {
        var repsSame = repsList.every(function (r) {
          return r === repsList[0];
        });
        next.reps = repsSame ? repsList[0] : repsList[repsList.length - 1];
      }
      if (!next.sets || String(next.sets).trim() === '') {
        next.sets = String(Math.max(1, prev.length));
      }
      return next;
    });
  }

  function applyTodayRoutineIfEmpty(force, withRecommendations) {
    var WS = window.WorkoutSplit;
    if (!WS || !workoutTracker) return Promise.resolve();
    if (!force && workoutTracker.hasExercises()) return Promise.resolve();
    var d = dateFromDatetimeLocal(datetimeInput && datetimeInput.value);
    var exercises = WS.exercisesForDate(null, d);
    if (!exercises.length && !force) return Promise.resolve();

    var titleEl = document.getElementById('create-session-title');
    if (titleEl && !titleEl.value.trim()) {
      titleEl.value = WS.defaultSessionTitle(null, d);
    }
    applySplitAutofillFromPicker();
    if (datetimeInput && datetimeInput.value) {
      workoutTracker.setWorkoutDate(datetimeInput.value.split('T')[0]);
    }

    if (!exercises.length) {
      updateLiftsCount();
      return Promise.resolve();
    }

    exercises = enrichExercisesWithHistory(exercises);

    var shouldRecommend = withRecommendations !== false && (force || withRecommendations === true);
    if (!shouldRecommend || !window.SplitRecommendations) {
      workoutTracker.loadFromLegacyExercises(exercises);
      updateLiftsCount();
      refreshOverloadCoachUi();
      return Promise.resolve();
    }

    showRockySplitRec('Loading Rocky\'s recommendations…', 'Using your split and past workouts.');
    return window.SplitRecommendations.fetchForExercises(exercises)
      .then(function (result) {
        var merged = window.SplitRecommendations.applyToExercises(exercises, result.recommendations);
        merged = enrichExercisesWithHistory(merged);
        workoutTracker.loadFromLegacyExercises(merged);
        var msg = window.SplitRecommendations.formatBannerMessage(result, exercises);
        showRockySplitRec(msg.title, msg.body);
        updateLiftsCount();
        refreshOverloadCoachUi();
      })
      .catch(function () {
        workoutTracker.loadFromLegacyExercises(exercises);
        showRockySplitRec(
          'Split loaded — weights filled from your last session where available.',
          'Tap complete set as you go. Adjust any weight that doesn\'t look right.'
        );
        updateLiftsCount();
        refreshOverloadCoachUi();
      });
  }

  function startWorkoutFromChoice(choice) {
    choice = choice || { mode: 'freestyle' };
    if (!workoutTracker) return Promise.resolve();
    var WS = window.WorkoutSplit;

    // Always start from a clean session for a new workout.
    workoutTracker.reset();

    if (choice.mode === 'freestyle') {
      if (typeof workoutTracker.openExercisePicker === 'function') {
        workoutTracker.openExercisePicker();
      }
      updateLiftsCount();
      return Promise.resolve({ freestyle: true });
    }

    if (choice.splitId && WS && typeof WS.setActiveSplit === 'function') {
      WS.setActiveSplit(choice.splitId);
    }
    return applyTodayRoutineIfEmpty(true, true).then(function () {
      if (!workoutTracker.hasExercises() && typeof workoutTracker.openExercisePicker === 'function') {
        workoutTracker.openExercisePicker();
      }
      return { freestyle: false };
    });
  }

  function trackingSubPanelFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h === 'archive' || h === 'history' || h === 'prs' || h === 'pr') return 'archive';
    if (h === 'stats' || h === 'progress' || h === 'tracking') return 'stats';
    return 'stats';
  }

  function activateTrackingSubPanel(key) {
    if (window.TrackingUI && typeof window.TrackingUI.setActivePanel === 'function') {
      window.TrackingUI.setActivePanel(key);
    }
  }

  function syncPrimaryTabState(mode, trackingPanel) {
    var isSplit = mode === 'split';
    primaryTrackingTabs.forEach(function (tab) {
      var key = tab.getAttribute('data-tracking-panel');
      var on = !isSplit && key === trackingPanel;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (tabSplit) {
      tabSplit.classList.toggle('active', isSplit);
      tabSplit.setAttribute('aria-selected', isSplit ? 'true' : 'false');
    }
  }

  function setMode(mode, opts) {
    opts = opts || {};
    var isWorkout = mode === 'workout';
    var isTracking = mode === 'tracking' || isWorkout;
    var isSplit = mode === 'split';
    var trackingPanel = opts.trackingPanel || trackingSubPanelFromHash() || 'stats';
    var leavingSplit = panelSplit && !panelSplit.hidden && !isSplit;
    if (
      leavingSplit &&
      window.WorkoutSplitEditor &&
      typeof window.WorkoutSplitEditor.leaveEditor === 'function'
    ) {
      window.WorkoutSplitEditor.leaveEditor();
    }

    if (progressShell) progressShell.hidden = isSplit;

    if (panelWorkout) {
      panelWorkout.classList.toggle('create-panel--active', isWorkout);
      panelWorkout.hidden = !isWorkout;
    }
    if (panelTracking) {
      panelTracking.classList.toggle('create-panel--active', isTracking && !isWorkout);
      /* keep tracking panels mounted while quick-logging; hide when on split */
      panelTracking.hidden = isSplit;
      if (isWorkout) panelTracking.hidden = false;
    }
    if (panelSplit) {
      panelSplit.classList.toggle('create-panel--active', isSplit);
      panelSplit.hidden = !isSplit;
    }

    syncPrimaryTabState(isSplit ? 'split' : 'tracking', trackingPanel);

    if (isWorkout) {
      applySplitAutofillFromPicker();
    }
    if (isTracking) {
      activateTrackingSubPanel(trackingPanel);
    }
    if (isSplit) {
      if (window.WorkoutSplit && window.WorkoutSplit.markAllSplitsSeen) {
        window.WorkoutSplit.markAllSplitsSeen();
      }
      loadSplitEditorForm();
      renderSplitPickerSelect();
      refreshSplitBadges();
    }
  }

  function applyHashToMode() {
    var h = location.hash;
    if (h === '#split') {
      setMode('split');
      return;
    }
    if (h === '#workout' || h === '#session' || h === '#today') {
      setMode('workout');
      return;
    }
    if (
      h === '#stats' ||
      h === '#archive' ||
      h === '#history' ||
      h === '#prs' ||
      h === '#pr' ||
      h === '#progress' ||
      h === '#tracking'
    ) {
      setMode('tracking', { trackingPanel: trackingSubPanelFromHash() });
      return;
    }
    setMode('tracking', { trackingPanel: 'stats' });
  }

  if (gotoProgressLink) {
    gotoProgressLink.addEventListener('click', function (e) {
      e.preventDefault();
      setMode('tracking', { trackingPanel: 'archive' });
      if (history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search + '#archive');
      }
    });
  }
  if (tabSplit) {
    tabSplit.addEventListener('click', function () {
      setMode('split');
      if (history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search + '#split');
      }
    });
  }

  window.CreateUI = {
    setMode: setMode,
    showQuickLog: function () {
      setMode('workout');
      var shell = document.getElementById('create-workout-shell');
      if (shell) shell.setAttribute('data-log-style', 'quick');
      if (history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search + '#workout');
      }
    },
    showLiveWorkout: function () {
      setMode('workout');
      var shell = document.getElementById('create-workout-shell');
      if (shell) {
        var style =
          window.strongmanPreferredLogStyle &&
          typeof window.strongmanPreferredLogStyle.get === 'function'
            ? window.strongmanPreferredLogStyle.get()
            : 'coach';
        shell.setAttribute('data-log-style', style || 'coach');
      }
    },
  };

  window.addEventListener('hashchange', applyHashToMode);
  applyHashToMode();

  var workoutShell = document.getElementById('create-workout-shell');
  if (workoutShell) {
    var preferredStyle =
      window.strongmanPreferredLogStyle &&
      typeof window.strongmanPreferredLogStyle.get === 'function'
        ? window.strongmanPreferredLogStyle.get()
        : 'coach';
    workoutShell.setAttribute('data-log-style', preferredStyle || 'coach');
  }

  var exerciseList = document.getElementById('create-exercise-list');
  var template = document.getElementById('create-exercise-row-template');
  var blockTemplate = document.getElementById('create-block-template');
  var addExerciseRowContainer = document.getElementById('create-add-exercise-row');
  var addExerciseBtn = document.getElementById('create-add-exercise');
  var liftsCountEl = document.getElementById('create-lifts-count');
  var liftsEmptyEl = document.getElementById('create-lifts-empty');
  var workoutTrackerRoot = document.getElementById('workout-tracker-root');
  var workoutTracker = null;
  if (workoutTrackerRoot && window.WorkoutTracker) {
    workoutTracker = window.WorkoutTracker.init(workoutTrackerRoot, {
      onChange: function (session) {
        updateLiftsCount();
        refreshOverloadCoachUi();
        if (window.WorkoutDashboard && window.WorkoutDashboard.onTrackerChange) {
          window.WorkoutDashboard.onTrackerChange(session);
        }
      },
      onSetCompleted: function (exerciseId, setId) {
        if (window.WorkoutDashboard && window.WorkoutDashboard.onSetCompleted) {
          window.WorkoutDashboard.onSetCompleted(exerciseId, setId);
        }
      }
    });
  }
  var exerciseSearchInput = document.getElementById('create-exercise-search');
  var exerciseSearchAddBtn = document.getElementById('create-exercise-search-add');
  var exerciseCatsEl = document.getElementById('create-exercise-cats');
  var exerciseResultsEl = document.getElementById('create-exercise-results');
  var exerciseQuickEl = document.getElementById('create-exercise-quick');
  var exerciseDatalist = document.getElementById('create-exercise-datalist');
  var exercisePickerCategory = 'all';
  var exerciseSearchDebounce = null;
  var selectedExerciseName = '';
  var datetimeInput = document.getElementById('create-datetime');
  var blocksEnabled = document.getElementById('create-blocks-enabled');
  var singleExercisesWrap = document.getElementById('create-single-exercises-wrap');
  var blocksWrap = document.getElementById('create-blocks-wrap');
  var blocksList = document.getElementById('create-blocks-list');
  var addBlockBtn = document.getElementById('create-add-block');
  var strengthSection = document.getElementById('create-strength-section');
  var overloadAsideEl = document.getElementById('create-overload-aside');
  var overloadEmptyEl = document.getElementById('create-overload-empty');
  var overloadActiveEl = document.getElementById('create-overload-active');
  var overloadPredictBtn = document.getElementById('create-overload-predict');
  var overloadErrorEl = document.getElementById('create-overload-error');
  var overloadSummaryEl = document.getElementById('create-overload-summary');
  var overloadSummaryListEl = document.getElementById('create-overload-summary-list');
  var overloadQuotaEl = document.getElementById('create-overload-quota');
  var cardioSection = document.getElementById('create-cardio-section');
  var cardioHeadingEl = document.getElementById('create-cardio-heading');
  var cardioHintEl = document.getElementById('create-cardio-hint');
  var cardioTypeEl = document.getElementById('create-cardio-type');
  var cardioDistanceWrap = document.getElementById('create-cardio-distance-wrap');
  var cardioCaloriesWrap = document.getElementById('create-cardio-calories-wrap');
  var cardioMinutesLabel = document.getElementById('create-cardio-minutes-label');
  var intensityInput = document.getElementById('create-session-intensity-user');
  var intensityTierPill = document.getElementById('create-intensity-tier-pill');
  var perSetIdSeq = 0;
  var dropSetIdSeq = 0;
  var lastShareSession = null;

  var CARDIO_TYPE_LABELS = {
    running: 'Running',
    walking: 'Walking',
    cycling: 'Cycling',
    swimming: 'Swimming',
    rowing: 'Rowing',
    elliptical: 'Elliptical',
    'stair-climber': 'Stair climber',
    hiking: 'Hiking',
    rucking: 'Rucking',
    'ski-erg': 'SkiErg',
    'other-cardio': 'Other cardio',
    sports: 'Sports'
  };

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function defaultDatetimeLocal() {
    var d = new Date();
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  if (datetimeInput && !datetimeInput.value) {
    datetimeInput.value = defaultDatetimeLocal();
  }

  if (datetimeInput) {
    datetimeInput.addEventListener('change', function () {
      applySplitAutofillFromPicker();
      applyTodayRoutineIfEmpty(false);
    });
    datetimeInput.addEventListener('input', function () {
      applySplitAutofillFromPicker();
    });
  }
  applySplitAutofillFromPicker();
  try {
    // New workout entry (?workout=1) waits for the picker — don't preload a draft/routine.
    var startingWorkoutFlow = window.location.search.indexOf('workout=1') >= 0;
    if (!startingWorkoutFlow && sessionStorage.getItem('strongman-apply-today-routine') === '1') {
      sessionStorage.removeItem('strongman-apply-today-routine');
      applyTodayRoutineIfEmpty(true, true);
    } else if (!startingWorkoutFlow) {
      applyTodayRoutineIfEmpty(false, false);
    }
  } catch (eApply) {
    if (window.location.search.indexOf('workout=1') < 0) {
      applyTodayRoutineIfEmpty(false, false);
    }
  }

  renderSplitPickerSelect();
  mountSplitEditor();
  window.addEventListener('strongman:splits-updated', function () {
    renderSplitPickerSelect();
    if (panelSplit && !panelSplit.hidden) loadSplitEditorForm();
  });

  var splitFormEl = document.getElementById('create-split-form');
  var splitMessageEl = document.getElementById('create-split-message');
  var splitErrorEl = document.getElementById('create-split-error');
  var splitShareBtn = document.getElementById('create-split-share');
  var splitSaveCurrentBtn = document.getElementById('create-split-save-current');

  function showSplitMessage(text, isError) {
    if (isError) {
      if (splitMessageEl) {
        splitMessageEl.textContent = '';
        splitMessageEl.hidden = true;
      }
      if (splitErrorEl) {
        splitErrorEl.textContent = text || '';
        splitErrorEl.hidden = !text;
      }
      return;
    }
    if (splitErrorEl) {
      splitErrorEl.textContent = '';
      splitErrorEl.hidden = true;
    }
    if (splitMessageEl) {
      splitMessageEl.textContent = text || '';
      splitMessageEl.hidden = !text;
    }
  }

  function switchToSplitTab() {
    var tab = document.getElementById('create-tab-split');
    if (tab) tab.click();
  }

  function tryImportSharedSplitFromHash() {
    var WS = window.WorkoutSplit;
    if (!WS || typeof WS.importSharedSplit !== 'function') return false;
    var hash = String(location.hash || '').replace(/^#/, '');
    if (!hash) return false;
    var params = new URLSearchParams(hash.indexOf('=') !== -1 ? hash : '');
    var code = params.get('split');
    if (!code) {
      var m = hash.match(/(?:^|&)split=([^&]+)/);
      code = m ? decodeURIComponent(m[1]) : '';
    }
    if (!code) return false;
    try {
      var id = WS.importSharedSplit(code, { suffix: true });
      if (!id) throw new Error('invalid');
      history.replaceState(null, '', location.pathname + location.search);
      mountSplitEditor();
      loadSplitEditorForm();
      renderSplitPickerSelect();
      switchToSplitTab();
      showSplitMessage('Shared split imported and set as active. Review the days, then Save.');
      return true;
    } catch (eImp) {
      showSplitMessage('Could not import that shared split link.', true);
      return false;
    }
  }

  if (splitFormEl && window.WorkoutSplitEditor) {
    splitFormEl.addEventListener('submit', function (e) {
      e.preventDefault();
      showSplitMessage('');
      window.WorkoutSplitEditor.saveActiveSplit({ activate: false });
      renderSplitPickerSelect();
      if (
        window.WorkoutSplitEditor.isEditingCurrentSplit &&
        window.WorkoutSplitEditor.isEditingCurrentSplit()
      ) {
        showSplitMessage('Split saved. Home / Start workout uses this routine.');
        applySplitAutofillFromPicker();
      } else {
        showSplitMessage('Split saved. Use “Save & set to current” to make it your active routine.');
      }
      if (window.WorkoutSplitEditor.syncSetCurrentButton) {
        window.WorkoutSplitEditor.syncSetCurrentButton();
      }
    });
  }

  if (splitSaveCurrentBtn && window.WorkoutSplitEditor) {
    splitSaveCurrentBtn.addEventListener('click', function () {
      showSplitMessage('');
      var label = (splitSaveCurrentBtn.textContent || '').toLowerCase();
      if (label.indexOf('save') !== -1 && typeof window.WorkoutSplitEditor.saveAndSetCurrent === 'function') {
        window.WorkoutSplitEditor.saveAndSetCurrent();
        showSplitMessage('Split saved and set as your current routine.');
      } else if (typeof window.WorkoutSplitEditor.setToCurrent === 'function') {
        window.WorkoutSplitEditor.setToCurrent();
        showSplitMessage('Split set as your current routine.');
      } else if (typeof window.WorkoutSplitEditor.saveAndSetCurrent === 'function') {
        window.WorkoutSplitEditor.saveAndSetCurrent();
        showSplitMessage('Split saved and set as your current routine.');
      }
      renderSplitPickerSelect();
      applySplitAutofillFromPicker();
      if (window.WorkoutSplitEditor.syncSetCurrentButton) {
        window.WorkoutSplitEditor.syncSetCurrentButton();
      }
    });
  }

  if (splitShareBtn && window.WorkoutSplitEditor) {
    splitShareBtn.addEventListener('click', function () {
      if (typeof window.WorkoutSplitEditor.shareActiveSplit !== 'function') return;
      splitShareBtn.disabled = true;
      window.WorkoutSplitEditor
        .shareActiveSplit()
        .then(function (result) {
          if (!result || result.method === 'cancelled') return;
          if (result.method === 'share') {
            showSplitMessage('Split shared.');
          } else {
            showSplitMessage('Share link copied. Send it to a friend — they can open it to import your split.');
          }
        })
        .catch(function () {
          showSplitMessage('Could not share this split. Try again.', true);
        })
        .finally(function () {
          splitShareBtn.disabled = false;
        });
    });
  }

  tryImportSharedSplitFromHash();
  window.addEventListener('hashchange', function () {
    tryImportSharedSplitFromHash();
  });

  function getSessionType() {
    var r = document.querySelector('input[name="create-session-type"]:checked');
    return r ? r.value : 'strength';
  }

  function cardioTypeLabel(type) {
    return CARDIO_TYPE_LABELS[type] || '';
  }

  function syncCardioFieldsUi() {
    var isSports = cardioTypeEl && cardioTypeEl.value === 'sports';
    if (cardioDistanceWrap) cardioDistanceWrap.hidden = !!isSports;
    if (cardioCaloriesWrap) cardioCaloriesWrap.hidden = !isSports;
    if (cardioMinutesLabel) {
      cardioMinutesLabel.textContent = isSports ? 'Minute length' : 'Duration (minutes)';
    }
  }

  function syncSessionTypeUi() {
    var t = getSessionType();
    if (!strengthSection || !cardioSection) return;
    if (t === 'cardio') {
      strengthSection.hidden = true;
      cardioSection.hidden = false;
      if (cardioHeadingEl) cardioHeadingEl.textContent = 'Cardio session';
      if (cardioHintEl) cardioHintEl.textContent = 'No lifting block — log time and what you did.';
    } else if (t === 'mixed') {
      strengthSection.hidden = false;
      cardioSection.hidden = false;
      if (cardioHeadingEl) cardioHeadingEl.textContent = 'Cardio';
      if (cardioHintEl) cardioHintEl.textContent = 'Finisher or conditioning after lifting.';
    } else {
      strengthSection.hidden = false;
      cardioSection.hidden = true;
    }
    syncCardioFieldsUi();
    refreshSessionIntensityUi();
    refreshOverloadCoachUi();
  }

  document.querySelectorAll('input[name="create-session-type"]').forEach(function (radio) {
    radio.addEventListener('change', syncSessionTypeUi);
  });
  if (cardioTypeEl) {
    cardioTypeEl.addEventListener('change', syncCardioFieldsUi);
  }
  syncSessionTypeUi();

  function collectCardio() {
    var minutesEl = document.getElementById('create-cardio-minutes');
    var distanceEl = document.getElementById('create-cardio-distance');
    var caloriesEl = document.getElementById('create-cardio-calories');
    var type = cardioTypeEl && cardioTypeEl.value ? cardioTypeEl.value : '';
    var minutes = minutesEl && minutesEl.value.trim();
    var distance = distanceEl && distanceEl.value.trim();
    var calories = caloriesEl && caloriesEl.value.trim();
    var isSports = type === 'sports';
    var activity = cardioTypeLabel(type);
    return {
      type: type,
      activity: activity,
      minutes: minutes,
      distance: isSports ? '' : distance,
      calories: isSports ? calories : ''
    };
  }

  function isPerSetOpen(row) {
    var panel = row && row.querySelector('.create-exercise-per-set');
    return panel && !panel.hidden;
  }

  function rebuildPerSetInputs(row) {
    var panel = row.querySelector('.create-exercise-per-set');
    var host = row.querySelector('.create-exercise-per-set-inputs');
    var setsInp = row.querySelector('.create-exercise-sets');
    if (!panel || !host || !setsInp) return;
    var n = Math.max(1, Math.min(30, parseInt(setsInp.value, 10) || 1));
    var prev = {};
    host.querySelectorAll('.create-exercise-set-weight').forEach(function (inp, i) {
      prev[i] = inp.value;
    });
    host.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var wrap = document.createElement('div');
      wrap.className = 'create-exercise-set-field';
      var lab = document.createElement('label');
      lab.textContent = 'Set ' + (i + 1);
      lab.setAttribute('for', 'create-setw-' + perSetIdSeq + '-' + i);
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'create-input create-exercise-set-weight';
      inp.min = '0';
      inp.step = '0.5';
      inp.value = prev[i] != null && prev[i] !== '' ? prev[i] : '';
      inp.id = 'create-setw-' + perSetIdSeq + '-' + i;
      inp.setAttribute('aria-label', 'Weight set ' + (i + 1));
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      host.appendChild(wrap);
    }
  }

  function collectSuperset(row) {
    var panel = row && row.querySelector('.create-exercise-superset');
    if (!panel || panel.hidden) return null;
    var nameInput = panel.querySelector('.create-superset-name-input');
    var sets = panel.querySelector('.create-superset-sets');
    var reps = panel.querySelector('.create-superset-reps');
    var weight = panel.querySelector('.create-superset-weight');
    var superset = {
      name: nameInput && nameInput.value.trim(),
      sets: sets ? sets.value : '',
      reps: reps ? reps.value : '',
      weight: weight ? weight.value : ''
    };
    if (
      !superset.name &&
      !(parseFloat(superset.sets) > 0) &&
      !(parseFloat(superset.reps) > 0) &&
      !(parseFloat(superset.weight) > 0)
    ) {
      return null;
    }
    return superset;
  }

  function createDropSetRow() {
    var item = document.createElement('div');
    item.className = 'create-dropset-row';

    var weightWrap = document.createElement('div');
    weightWrap.className = 'create-field create-exercise-num';
    var weightLabel = document.createElement('label');
    weightLabel.className = 'create-exercise-label';
    weightLabel.textContent = 'Drop weight (lb)';
    weightLabel.setAttribute('for', 'create-drop-weight-' + dropSetIdSeq);
    var weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.className = 'create-input create-dropset-weight';
    weightInput.min = '0';
    weightInput.step = '0.5';
    weightInput.id = 'create-drop-weight-' + dropSetIdSeq;
    weightInput.setAttribute('aria-label', 'Drop set weight');
    weightWrap.appendChild(weightLabel);
    weightWrap.appendChild(weightInput);

    var repsWrap = document.createElement('div');
    repsWrap.className = 'create-field create-exercise-num';
    var repsLabel = document.createElement('label');
    repsLabel.className = 'create-exercise-label';
    repsLabel.textContent = 'Drop reps';
    repsLabel.setAttribute('for', 'create-drop-reps-' + dropSetIdSeq);
    var repsInput = document.createElement('input');
    repsInput.type = 'number';
    repsInput.className = 'create-input create-dropset-reps';
    repsInput.min = '0';
    repsInput.step = '1';
    repsInput.id = 'create-drop-reps-' + dropSetIdSeq;
    repsInput.setAttribute('aria-label', 'Drop set reps');
    repsWrap.appendChild(repsLabel);
    repsWrap.appendChild(repsInput);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'create-dropset-remove';
    removeBtn.setAttribute('aria-label', 'Remove drop set');
    removeBtn.textContent = '×';

    item.appendChild(weightWrap);
    item.appendChild(repsWrap);
    item.appendChild(removeBtn);
    dropSetIdSeq++;
    return item;
  }

  function addDropSetRow(row) {
    var host = row && row.querySelector('.create-dropset-list');
    if (!host) return;
    host.appendChild(createDropSetRow());
    refreshSessionIntensityUi();
  }

  function collectDropSets(row) {
    var panel = row && row.querySelector('.create-exercise-dropset');
    if (!panel || panel.hidden) return [];
    var out = [];
    panel.querySelectorAll('.create-dropset-row').forEach(function (dropRow) {
      var weight = dropRow.querySelector('.create-dropset-weight');
      var reps = dropRow.querySelector('.create-dropset-reps');
      var weightVal = weight ? weight.value : '';
      var repsVal = reps ? reps.value : '';
      if (parseFloat(weightVal) > 0 || parseFloat(repsVal) > 0) {
        out.push({
          weight: weightVal,
          reps: repsVal
        });
      }
    });
    return out;
  }

  function collectExercises() {
    if (workoutTracker && workoutTracker.hasExercises()) {
      return workoutTracker.getLegacyExercises();
    }
    var useBlocks = blocksEnabled && blocksEnabled.checked;
    var containers = [];
    if (!useBlocks && exerciseList) {
      containers.push({ blockName: '', listEl: exerciseList });
    } else if (blocksList) {
      blocksList.querySelectorAll('[data-create-block]').forEach(function (block) {
        var nameInput = block.querySelector('.create-block-name');
        var listEl = block.querySelector('.create-block-exercises');
        containers.push({
          blockName: nameInput ? nameInput.value.trim() : '',
          listEl: listEl
        });
      });
    }
    var out = [];
    containers.forEach(function (c) {
      if (!c.listEl) return;
      var rows = c.listEl.querySelectorAll('.create-exercise-row');
      rows.forEach(function (row) {
        var nameInput = row.querySelector('.create-exercise-name-input');
        var name = nameInput && nameInput.value.trim();
        var sets = row.querySelector('.create-exercise-sets');
        var reps = row.querySelector('.create-exercise-reps');
        var weight = row.querySelector('.create-exercise-weight');
        var setWeights = [];
        if (isPerSetOpen(row)) {
          row.querySelectorAll('.create-exercise-set-weight').forEach(function (inp) {
            setWeights.push(inp.value);
          });
        }
        var weightVal = weight ? weight.value : '';
        if (setWeights.length) {
          var nums = setWeights.map(function (v) {
            return parseFloat(v);
          }).filter(function (x) {
            return !isNaN(x) && x >= 0;
          });
          if (nums.length) {
            var avg = nums.reduce(function (a, b) {
              return a + b;
            }, 0) / nums.length;
            weightVal = String(Math.round(avg * 20) / 20);
          }
        }
        var ex = {
          name: name,
          sets: sets ? sets.value : '',
          reps: reps ? reps.value : '',
          weight: weightVal
        };
        var superset = collectSuperset(row);
        var dropSets = collectDropSets(row);
        if (c.blockName) ex.blockName = c.blockName;
        if (setWeights.length) ex.setWeights = setWeights;
        if (superset) ex.superset = superset;
        if (dropSets.length) ex.dropSets = dropSets;
        out.push(ex);
      });
    });
    return out;
  }

  function exercisesPassFilter(list) {
    return list.filter(function (ex) {
      return (
        ex.name ||
        parseFloat(ex.sets) > 0 ||
        parseFloat(ex.reps) > 0 ||
        parseFloat(ex.weight) > 0 ||
        (ex.setWeights && ex.setWeights.some(function (sw) { return parseFloat(sw) > 0; })) ||
        (ex.superset &&
          (ex.superset.name ||
            parseFloat(ex.superset.sets) > 0 ||
            parseFloat(ex.superset.reps) > 0 ||
            parseFloat(ex.superset.weight) > 0)) ||
        (ex.dropSets &&
          ex.dropSets.some(function (drop) {
            return parseFloat(drop.weight) > 0 || parseFloat(drop.reps) > 0;
          }))
      );
    });
  }

  function updateTierPillFromInput() {
    if (!intensityTierPill || !WL || !intensityInput) return;
    var v = parseInt(intensityInput.value, 10);
    if (isNaN(v) || intensityInput.value.trim() === '') {
      intensityTierPill.textContent = '—';
      return;
    }
    intensityTierPill.textContent = WL.intensityLabel(Math.min(100, Math.max(0, v)));
  }

  function refreshSessionIntensityUi() {
    updateTierPillFromInput();
  }

  if (intensityInput) {
    intensityInput.addEventListener('input', function () {
      updateTierPillFromInput();
    });
  }

  function liftSummaryText(row) {
    var sets = row.querySelector('.create-exercise-sets');
    var reps = row.querySelector('.create-exercise-reps');
    var weight = row.querySelector('.create-exercise-weight');
    var s = sets && sets.value !== '' ? sets.value : '—';
    var r = reps && reps.value !== '' ? reps.value : '—';
    var wVal = weight && weight.value !== '' ? parseFloat(weight.value) : NaN;
    var w = !isNaN(wVal) && wVal > 0 ? weight.value + ' lb' : '—';
    return s + '×' + r + ' @ ' + w;
  }

  function updateLiftSummary(row) {
    if (!row) return;
    var summary = row.querySelector('.log-lift-summary');
    if (!summary) return;
    var collapsed = row.getAttribute('data-collapsed') === 'true';
    if (!collapsed) {
      summary.hidden = true;
      summary.textContent = '';
      return;
    }
    summary.textContent = liftSummaryText(row);
    summary.hidden = false;
  }

  function setLiftCollapsed(row, collapsed) {
    if (!row) return;
    var toggle = row.querySelector('.log-lift-toggle');
    row.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    if (toggle) {
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', collapsed ? 'Expand lift' : 'Collapse lift');
    }
    updateLiftSummary(row);
  }

  function bindRow(row) {
    var liftToggle = row.querySelector('.log-lift-toggle');
    var liftHead = row.querySelector('.log-lift-card-head');
    if (liftToggle) {
      liftToggle.addEventListener('click', function () {
        var collapsed = row.getAttribute('data-collapsed') === 'true';
        setLiftCollapsed(row, !collapsed);
      });
    }
    if (liftHead) {
      liftHead.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (
          t.closest('.create-exercise-name-input') ||
          t.closest('.create-exercise-remove') ||
          t.closest('.log-lift-toggle')
        ) {
          return;
        }
        var collapsed = row.getAttribute('data-collapsed') === 'true';
        setLiftCollapsed(row, !collapsed);
      });
    }
    var perSetPanel = row.querySelector('.create-exercise-per-set');
    var toggle = row.querySelector('.create-exercise-per-set-toggle');
    var dropsetAddBtn = row.querySelector('.create-dropset-add-row');
    var uid = 'create-per-set-' + ++perSetIdSeq;
    if (perSetPanel) perSetPanel.id = uid;
    if (toggle) {
      toggle.setAttribute('aria-controls', uid);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Log weight per set';
      toggle.addEventListener('click', function () {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        if (!expanded) rebuildPerSetInputs(row);
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        toggle.textContent = expanded ? 'Log weight per set' : 'Use single weight';
        if (perSetPanel) perSetPanel.hidden = expanded;
      });
    }
    if (dropsetAddBtn) {
      dropsetAddBtn.addEventListener('click', function () {
        addDropSetRow(row);
      });
    }
    row.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      clearRecommendCellForRow(row);
      if (t.classList.contains('create-exercise-name-input')) {
        syncLiftMetaBadge(row);
      }
      if (
        t.classList.contains('create-exercise-sets') ||
        t.classList.contains('create-exercise-reps') ||
        t.classList.contains('create-exercise-weight')
      ) {
        updateLiftSummary(row);
      }
      if (t.classList.contains('create-exercise-sets') && isPerSetOpen(row)) {
        rebuildPerSetInputs(row);
      }
    });
    row.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('create-dropset-remove')) return;
      var dropRow = t.closest('.create-dropset-row');
      var host = row.querySelector('.create-dropset-list');
      if (!dropRow || !host) return;
      if (host.querySelectorAll('.create-dropset-row').length <= 1) {
        dropRow.querySelectorAll('input').forEach(function (inp) {
          inp.value = '';
        });
      } else {
        dropRow.remove();
      }
    });
    var removeBtn = row.querySelector('.create-exercise-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        row.remove();
        refreshSessionIntensityUi();
        refreshOverloadCoachUi();
        updateLiftsCount();
      });
    }
    syncLiftMetaBadge(row);
    updateLiftSummary(row);
  }

  function countLiftRows() {
    if (workoutTracker) return workoutTracker.getExerciseCount();
    var n = 0;
    if (exerciseList) n += exerciseList.querySelectorAll('.create-exercise-row').length;
    if (blocksList) {
      blocksList.querySelectorAll('.create-exercise-row').forEach(function () {
        n += 1;
      });
    }
    return n;
  }

  function updateLiftsCount() {
    if (!liftsCountEl) return;
    var n = countLiftRows();
    liftsCountEl.textContent = n + ' lift' + (n === 1 ? '' : 's');
    if (liftsEmptyEl) liftsEmptyEl.hidden = n > 0;
    refreshAllBlockMetas();
  }

  function syncLiftMetaBadge(row) {
    if (!row || !window.ExerciseDatabase) return;
    var badge = row.querySelector('.log-lift-meta-badge');
    var inp = row.querySelector('.create-exercise-name-input');
    if (!badge || !inp) return;
    var ex = window.ExerciseDatabase.findByName(inp.value.trim());
    if (!ex) {
      badge.hidden = true;
      badge.textContent = '';
      return;
    }
    badge.textContent =
      window.ExerciseDatabase.categoryLabel(ex.category) +
      ' · ' +
      window.ExerciseDatabase.equipmentLabel(ex.equipment);
    badge.hidden = false;
  }

  function populateExerciseDatalist() {
    if (!exerciseDatalist || !window.ExerciseDatabase) return;
    exerciseDatalist.innerHTML = '';
    window.ExerciseDatabase.catalog.forEach(function (ex) {
      var opt = document.createElement('option');
      opt.value = ex.name;
      exerciseDatalist.appendChild(opt);
    });
  }

  function activeExerciseList() {
    if (blocksEnabled && blocksEnabled.checked && blocksList) {
      var block = blocksList.querySelector('[data-create-block]:last-child');
      if (block) {
        var inner = block.querySelector('.create-block-exercises');
        if (inner) return inner;
      }
    }
    return exerciseList;
  }

  function addExerciseWithName(name, kind) {
    if (workoutTracker) {
      workoutTracker.addExercise(name || '');
      updateLiftsCount();
      refreshOverloadCoachUi();
      return;
    }
    var list = activeExerciseList();
    addExerciseRow(list, kind || 'standard');
    var rows = list.querySelectorAll('.create-exercise-row');
    var row = rows[rows.length - 1];
    if (row && name) {
      var inp = row.querySelector('.create-exercise-name-input');
      if (inp) inp.value = name;
      syncLiftMetaBadge(row);
    }
    updateLiftsCount();
    if (row) {
      var focusInp = name
        ? row.querySelector('.create-exercise-weight')
        : row.querySelector('.create-exercise-name-input');
      if (focusInp) focusInp.focus();
    }
  }

  function renderExerciseResults(rows) {
    if (!exerciseResultsEl) return;
    exerciseResultsEl.innerHTML = '';
    if (!rows || !rows.length) {
      exerciseResultsEl.hidden = true;
      return;
    }
    exerciseResultsEl.hidden = false;
    rows.forEach(function (ex) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'log-exercise-result-btn';
      btn.setAttribute('role', 'option');
      var meta = window.ExerciseDatabase
        ? window.ExerciseDatabase.equipmentLabel(ex.equipment)
        : ex.equipment;
      btn.innerHTML =
        '<span>' +
        ex.name +
        '</span><span class="log-exercise-result-meta">' +
        meta +
        '</span>';
      btn.addEventListener('click', function () {
        addExerciseWithName(ex.name);
        if (exerciseSearchInput) exerciseSearchInput.value = '';
        selectedExerciseName = '';
        if (exerciseSearchAddBtn) exerciseSearchAddBtn.disabled = true;
        renderExerciseResults([]);
      });
      exerciseResultsEl.appendChild(btn);
    });
  }

  function runExerciseSearch() {
    var q = exerciseSearchInput ? exerciseSearchInput.value.trim() : '';
    selectedExerciseName = q;
    if (exerciseSearchAddBtn) {
      exerciseSearchAddBtn.disabled = !q;
    }
    if (!window.ExerciseDatabase) return;
    var rows = window.ExerciseDatabase.search({
      q: q,
      category: exercisePickerCategory,
      limit: 12,
    });
    renderExerciseResults(rows);
  }

  function initExercisePicker() {
    if (!window.ExerciseDatabase) return;
    populateExerciseDatalist();

    if (exerciseCatsEl) {
      exerciseCatsEl.innerHTML = '';
      window.ExerciseDatabase.categories.forEach(function (cat) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'log-exercise-cat-btn' + (cat.id === 'all' ? ' active' : '');
        b.textContent = cat.label;
        b.setAttribute('data-exercise-cat', cat.id);
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', cat.id === 'all' ? 'true' : 'false');
        b.addEventListener('click', function () {
          exercisePickerCategory = cat.id;
          exerciseCatsEl.querySelectorAll('.log-exercise-cat-btn').forEach(function (x) {
            var on = x.getAttribute('data-exercise-cat') === cat.id;
            x.classList.toggle('active', on);
            x.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          runExerciseSearch();
        });
        exerciseCatsEl.appendChild(b);
      });
    }

    if (exerciseQuickEl) {
      exerciseQuickEl.innerHTML = '';
      window.ExerciseDatabase.quickPicks.forEach(function (name) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'log-exercise-quick-btn';
        b.textContent = name;
        b.addEventListener('click', function () {
          addExerciseWithName(name);
        });
        exerciseQuickEl.appendChild(b);
      });
    }

    if (exerciseSearchInput) {
      exerciseSearchInput.addEventListener('input', function () {
        if (exerciseSearchDebounce) clearTimeout(exerciseSearchDebounce);
        exerciseSearchDebounce = setTimeout(runExerciseSearch, 120);
      });
      exerciseSearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var q = exerciseSearchInput.value.trim();
          if (q) addExerciseWithName(q);
        }
      });
    }

    if (exerciseSearchAddBtn) {
      exerciseSearchAddBtn.addEventListener('click', function () {
        var q = exerciseSearchInput ? exerciseSearchInput.value.trim() : '';
        if (q) addExerciseWithName(q);
      });
    }

    window.ExerciseDatabase.fetch({ limit: 200 }).then(function () {
      populateExerciseDatalist();
      if (exerciseCatsEl && window.ExerciseDatabase.categories.length) {
        var active = exercisePickerCategory;
        exerciseCatsEl.innerHTML = '';
        window.ExerciseDatabase.categories.forEach(function (cat) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'log-exercise-cat-btn' + (cat.id === active ? ' active' : '');
          b.textContent = cat.label;
          b.setAttribute('data-exercise-cat', cat.id);
          b.setAttribute('role', 'tab');
          b.setAttribute('aria-selected', cat.id === active ? 'true' : 'false');
          b.addEventListener('click', function () {
            exercisePickerCategory = cat.id;
            exerciseCatsEl.querySelectorAll('.log-exercise-cat-btn').forEach(function (x) {
              var on = x.getAttribute('data-exercise-cat') === cat.id;
              x.classList.toggle('active', on);
              x.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            runExerciseSearch();
          });
          exerciseCatsEl.appendChild(b);
        });
      }
    });
  }

  function addExerciseRow(targetList, kind) {
    kind = kind || 'standard';
    var list = targetList || exerciseList;
    if (!list || !template || !template.content) return;
    var node = template.content.firstElementChild.cloneNode(true);
    var dropsetPanel = node.querySelector('.create-exercise-dropset');
    var supersetPanel = node.querySelector('.create-exercise-superset');
    if (kind === 'standard') {
      if (dropsetPanel) dropsetPanel.remove();
      if (supersetPanel) supersetPanel.remove();
    } else if (kind === 'dropset') {
      if (supersetPanel) supersetPanel.remove();
      if (dropsetPanel) dropsetPanel.hidden = false;
    } else if (kind === 'superset') {
      if (dropsetPanel) dropsetPanel.remove();
      if (supersetPanel) supersetPanel.hidden = false;
    }
    list.appendChild(node);
    bindRow(node);
    if (kind === 'dropset') {
      var host = node.querySelector('.create-dropset-list');
      if (host && !host.querySelector('.create-dropset-row')) {
        addDropSetRow(node);
      }
    }
    refreshSessionIntensityUi();
    refreshOverloadCoachUi();
    updateLiftsCount();
  }

  function wireAddExerciseRowContainer(container, listGetter) {
    if (!container || !listGetter) return;
    container.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('button');
      if (!btn || !container.contains(btn)) return;
      var k = btn.getAttribute('data-add-exercise-kind');
      if (k === 'dropset' || k === 'superset') {
        addExerciseRow(listGetter(), k);
        return;
      }
      if (btn.classList.contains('create-add-exercise') && !btn.classList.contains('create-add-exercise-variant')) {
        addExerciseRow(listGetter(), 'standard');
      }
    });
  }

  if (addExerciseBtn) {
    addExerciseBtn.addEventListener('click', function () {
      addExerciseWithName('');
    });
  }

  wireAddExerciseRowContainer(addExerciseRowContainer, function () {
    return exerciseList;
  });

  function createBlockElement() {
    if (!blockTemplate || !blockTemplate.content) return null;
    return blockTemplate.content.firstElementChild.cloneNode(true);
  }

  function blockLiftCount(block) {
    if (!block) return 0;
    var inner = block.querySelector('.create-block-exercises');
    return inner ? inner.querySelectorAll('.create-exercise-row').length : 0;
  }

  function updateBlockMeta(block) {
    if (!block) return;
    var meta = block.querySelector('.create-block-meta');
    if (!meta) return;
    var collapsed = block.getAttribute('data-collapsed') === 'true';
    if (!collapsed) {
      meta.hidden = true;
      meta.textContent = '';
      return;
    }
    var n = blockLiftCount(block);
    meta.textContent = n + ' lift' + (n === 1 ? '' : 's');
    meta.hidden = false;
  }

  function refreshAllBlockMetas() {
    if (!blocksList) return;
    blocksList.querySelectorAll('[data-create-block]').forEach(updateBlockMeta);
  }

  function setBlockCollapsed(block, collapsed) {
    if (!block) return;
    var toggle = block.querySelector('.create-block-toggle');
    block.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    if (toggle) {
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', collapsed ? 'Expand block' : 'Collapse block');
    }
    updateBlockMeta(block);
  }

  function bindBlock(block) {
    if (!block) return;
    var removeBlockBtn = block.querySelector('.create-block-remove');
    var toggleBtn = block.querySelector('.create-block-toggle');
    var blockHead = block.querySelector('.create-block-head');
    var nameInput = block.querySelector('.create-block-name');
    var addRowContainer = block.querySelector('.create-add-exercise-row--block');
    var innerList = block.querySelector('.create-block-exercises');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var collapsed = block.getAttribute('data-collapsed') === 'true';
        setBlockCollapsed(block, !collapsed);
      });
    }
    if (blockHead) {
      blockHead.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (
          t.closest('.create-block-name') ||
          t.closest('.create-block-remove') ||
          t.closest('.create-block-toggle')
        ) {
          return;
        }
        var collapsed = block.getAttribute('data-collapsed') === 'true';
        setBlockCollapsed(block, !collapsed);
      });
    }
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        updateBlockMeta(block);
      });
    }
    if (removeBlockBtn) {
      removeBlockBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var all = blocksList.querySelectorAll('[data-create-block]');
        if (all.length <= 1) {
          if (exerciseList && innerList) {
            Array.prototype.forEach.call(innerList.querySelectorAll('.create-exercise-row'), function (r) {
              exerciseList.appendChild(r);
            });
          }
          block.remove();
          if (blocksEnabled) blocksEnabled.checked = false;
          setBlocksUi(false);
        } else {
          var neighbor =
            block.previousElementSibling && block.previousElementSibling.hasAttribute('data-create-block')
              ? block.previousElementSibling
              : block.nextElementSibling;
          var targetList = neighbor && neighbor.querySelector('.create-block-exercises');
          if (targetList && innerList) {
            Array.prototype.forEach.call(innerList.querySelectorAll('.create-exercise-row'), function (r) {
              targetList.appendChild(r);
            });
          }
          block.remove();
        }
        updateLiftsCount();
        refreshSessionIntensityUi();
        refreshOverloadCoachUi();
      });
    }
    if (addRowContainer && innerList) {
      wireAddExerciseRowContainer(addRowContainer, function () {
        return innerList;
      });
    }
  }

  function addBlockFromFlat() {
    if (!blocksList) return;
    var block = createBlockElement();
    if (!block) return;
    blocksList.appendChild(block);
    bindBlock(block);
    var inner = block.querySelector('.create-block-exercises');
    if (exerciseList && inner) {
      var rows = Array.prototype.slice.call(exerciseList.querySelectorAll('.create-exercise-row'));
      if (rows.length) {
        rows.forEach(function (r) {
          inner.appendChild(r);
        });
      } else {
        addExerciseRow(inner);
      }
    }
  }

  function addEmptyBlock() {
    if (!blocksList) return;
    var block = createBlockElement();
    if (!block) return;
    blocksList.appendChild(block);
    bindBlock(block);
    var inner = block.querySelector('.create-block-exercises');
    if (inner) addExerciseRow(inner);
    refreshSessionIntensityUi();
  }

  function flattenBlocksToSingle() {
    if (!exerciseList || !blocksList) return;
    Array.prototype.forEach.call(blocksList.querySelectorAll('.create-exercise-row'), function (r) {
      exerciseList.appendChild(r);
    });
    blocksList.innerHTML = '';
    if (!exerciseList.querySelector('.create-exercise-row')) {
      updateLiftsCount();
    }
    refreshSessionIntensityUi();
  }

  function setBlocksUi(enabled) {
    if (singleExercisesWrap) singleExercisesWrap.hidden = enabled;
    if (blocksWrap) blocksWrap.hidden = !enabled;
    if (enabled) {
      if (blocksList && !blocksList.querySelector('[data-create-block]')) {
        addBlockFromFlat();
      }
    } else {
      flattenBlocksToSingle();
    }
    refreshOverloadCoachUi();
  }

  if (blocksEnabled) {
    blocksEnabled.addEventListener('change', function () {
      setBlocksUi(blocksEnabled.checked);
      refreshSessionIntensityUi();
      refreshOverloadCoachUi();
    });
  }

  if (addBlockBtn) {
    addBlockBtn.addEventListener('click', function () {
      addEmptyBlock();
    });
  }

  initExercisePicker();
  updateLiftsCount();
  refreshSessionIntensityUi();
  refreshOverloadCoachUi();

  var WA = window.WorkoutArchive;
  var archiveListEl = document.getElementById('create-archive-list');
  var archiveErrorEl = document.getElementById('create-archive-error');
  var sessionTitleField = document.getElementById('create-session-title');

  function showArchiveError(msg) {
    if (archiveErrorEl) {
      archiveErrorEl.textContent = msg || '';
      archiveErrorEl.hidden = !msg;
    }
  }

  function hideArchiveError() {
    showArchiveError('');
  }

  function shouldSkipWorkoutMetaLine(t) {
    if (/^split\s*\/\s*focus\s*:/i.test(t)) return true;
    if (/^session\s+title\s*:/i.test(t)) return true;
    if (/^cardio\s*[·\u00b7]/i.test(t)) return true;
    return false;
  }

  function parseAllCapsSectionHeading(line) {
    var t = line.trim();
    if (t.length < 3 || t.length > 48) return null;
    if (t.indexOf('@') !== -1) return null;
    if (/[·\u00b7]/.test(t)) return null;
    if (/^notes$/i.test(t)) return null;
    if (!/^[A-Z0-9][A-Z0-9\s,'\-\.&]+$/.test(t)) return null;
    var nonSpace = t.replace(/\s/g, '');
    if (!nonSpace.length) return null;
    var upperLetters = (t.match(/[A-Z]/g) || []).length;
    if (upperLetters < nonSpace.length * 0.5) return null;
    return t;
  }

  function stripWorkoutPasteLine(line) {
    return line
      .replace(/\r/g, '')
      .replace(/^[\s\t]+/, '')
      .replace(/^[\-\*\u2022]+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .trim();
  }

  function parseWorkoutBlockHeading(line) {
    var t = line.trim();
    var m = t.match(/^#{1,3}\s+(.+)$/);
    if (m) {
      var h = m[1].trim();
      if (h) return h;
    }
    m = t.match(/^\[(.+)\]\s*$/);
    if (m) {
      var b = m[1].trim();
      if (b) return b;
    }
    m = t.match(/^\*\*(.+)\*\*\s*$/);
    if (m) {
      var s = m[1].trim();
      if (s) return s;
    }
    var caps = parseAllCapsSectionHeading(t);
    return caps || null;
  }

  function normalizeCoachDots(s) {
    if (s == null) return '';
    return String(s)
      .replace(/\u00a0/g, ' ')
      .replace(/[\u2219\u2022\u2027\u30fb\u22c5\u0387]/g, '\u00b7');
  }

  function parseCoachFormattedLine(raw) {
    var t = normalizeCoachDots(raw).trim();
    if (!t) return null;
    t = t.split(/\s*[\u00b7|]\s*superset\s*:/i)[0].trim();
    t = t.split(/\s*[\u00b7|]\s*drops\s*:/i)[0].trim();
    var re = /(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+))?\s*(?:lb|lbs|kg)?\s*$/i;
    var m = re.exec(t);
    if (!m) return null;
    var head = t.slice(0, m.index).replace(/[\s\u00b7|;:]+$/g, '').trim();
    if (!head) return null;
    var sets = m[1];
    var reps = m[2];
    var weight = m[3] != null ? String(m[3]).trim() : '';
    var delim = /\s*[\u00b7|]\s*/;
    if (delim.test(head)) {
      var bits = head.split(delim).map(function (x) {
        return x.trim();
      }).filter(Boolean);
      if (bits.length >= 2) {
        return {
          blockHint: bits[0],
          name: bits.slice(1).join(' · '),
          sets: sets,
          reps: reps,
          weight: weight
        };
      }
    }
    return { name: head, sets: sets, reps: reps, weight: weight, blockHint: null };
  }

  function parseWorkoutExerciseLine(line) {
    var raw = normalizeCoachDots(stripWorkoutPasteLine(line));
    if (!raw) return null;
    if (/^---+$/ .test(raw.replace(/\s+/g, ''))) return null;
    var coach = parseCoachFormattedLine(raw);
    if (coach) return coach;
    raw = raw.replace(/\s*(?:lb|lbs|kg)\s*$/i, '').trim();
    var m = raw.match(/^(\d+)\s*[x×]\s*(\d+)(?:\s*(?:@|at)\s*([\d.]+))?\s+(.+)$/i);
    if (m) {
      return {
        name: m[4].trim(),
        sets: m[1],
        reps: m[2],
        weight: m[3] != null ? m[3] : '',
        blockHint: null
      };
    }
    m = raw.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*(?:@|at)\s*([\d.]+))?\s*$/i);
    if (m) {
      return {
        name: m[1].trim(),
        sets: m[2],
        reps: m[3],
        weight: m[4] != null ? m[4] : '',
        blockHint: null
      };
    }
    m = raw.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*([\d.]+)\s*$/i);
    if (m) {
      return {
        name: m[1].trim(),
        sets: m[2],
        reps: m[3],
        weight: m[4],
        blockHint: null
      };
    }
    var hasPrescription = /\d+\s*[x×]\s*\d+/.test(raw);
    if (!hasPrescription && raw.length > 120) return null;
    return { name: raw, sets: '', reps: '', weight: '', blockHint: null };
  }

  function parseWorkoutPasteText(text) {
    var lines = (text || '').split(/\n/);
    var blocks = [];
    var cur = { blockName: '', exercises: [] };
    blocks.push(cur);
    var sectionHeading = '';
    var inNotes = false;

    function moveToBlock(name) {
      name = (name || '').trim();
      if (!name) return;
      if (cur.blockName === name) return;
      if (cur.exercises.length === 0) {
        if (!cur.blockName) {
          cur.blockName = name;
          return;
        }
        if (cur.blockName !== name) {
          cur = { blockName: name, exercises: [] };
          blocks.push(cur);
        }
        return;
      }
      cur = { blockName: name, exercises: [] };
      blocks.push(cur);
    }

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (!trimmed) continue;

      if (inNotes) {
        var exitH = parseWorkoutBlockHeading(trimmed);
        if (exitH) {
          inNotes = false;
          sectionHeading = exitH;
          moveToBlock(exitH);
        }
        continue;
      }
      if (/^notes$/i.test(trimmed)) {
        inNotes = true;
        continue;
      }
      if (shouldSkipWorkoutMetaLine(trimmed)) continue;

      var heading = parseWorkoutBlockHeading(trimmed);
      if (heading) {
        sectionHeading = heading;
        moveToBlock(heading);
        continue;
      }

      var ex = parseWorkoutExerciseLine(trimmed);
      if (!ex || !ex.name) continue;

      var key = (ex.blockHint && String(ex.blockHint).trim()) || sectionHeading || '';
      if (key) moveToBlock(key);

      cur.exercises.push({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight
      });
    }

    return {
      blocks: blocks.filter(function (b) {
        return b.exercises.length > 0;
      })
    };
  }

  function looseFallbackPlanBlocks(text) {
    var lines = (text || '').split(/\n/);
    var blocks = [];
    var cur = { blockName: '', exercises: [] };
    blocks.push(cur);
    var sectionHeading = '';

    function moveLoose(name) {
      name = (name || '').trim();
      if (!name) return;
      if (cur.blockName === name) return;
      if (cur.exercises.length === 0) {
        if (!cur.blockName) {
          cur.blockName = name;
          return;
        }
        if (cur.blockName !== name) {
          cur = { blockName: name, exercises: [] };
          blocks.push(cur);
        }
        return;
      }
      cur = { blockName: name, exercises: [] };
      blocks.push(cur);
    }

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (/^notes$/i.test(trimmed)) break;
      if (shouldSkipWorkoutMetaLine(trimmed)) continue;
      var heading = parseWorkoutBlockHeading(trimmed);
      if (heading) {
        sectionHeading = heading;
        moveLoose(heading);
        continue;
      }
      var key = sectionHeading || 'Workout';
      moveLoose(key);
      cur.exercises.push({
        name: trimmed.slice(0, 240),
        sets: '',
        reps: '',
        weight: ''
      });
    }
    return {
      blocks: blocks.filter(function (b) {
        return b.exercises.length > 0;
      })
    };
  }

  function countParsedWorkoutExercises(parsed) {
    var n = 0;
    parsed.blocks.forEach(function (b) {
      n += b.exercises.length;
    });
    return n;
  }

  function fillExerciseRowFromParsed(row, ex) {
    var nameInput = row.querySelector('.create-exercise-name-input');
    var sets = row.querySelector('.create-exercise-sets');
    var reps = row.querySelector('.create-exercise-reps');
    var weight = row.querySelector('.create-exercise-weight');
    if (nameInput) nameInput.value = ex.name || '';
    if (sets) sets.value = ex.sets !== undefined && ex.sets !== '' ? String(ex.sets) : '';
    if (reps) reps.value = ex.reps !== undefined && ex.reps !== '' ? String(ex.reps) : '';
    if (weight) weight.value = ex.weight !== undefined && ex.weight !== '' ? String(ex.weight) : '';
    syncLiftMetaBadge(row);
    updateLiftSummary(row);
  }

  function applyWorkoutPasteToExerciseBlocks(bodyText, onError) {
    var text = bodyText != null ? String(bodyText) : '';
    text = text.trim();
    if (!text) {
      if (typeof onError === 'function') {
        onError('This template has no saved workout text.');
      }
      return false;
    }
    var parsed = parseWorkoutPasteText(text);
    if (countParsedWorkoutExercises(parsed) === 0) {
      parsed = looseFallbackPlanBlocks(text);
    }
    if (countParsedWorkoutExercises(parsed) === 0) {
      if (typeof onError === 'function') {
        onError(
          'Could not import any lines from this plan. Add lines with lifts (e.g. “Squat · 5×5 @ 315 lb” or “Back squat 5×5 @ 315”).'
        );
      }
      return false;
    }
    hideArchiveError();
    if (getSessionType() === 'cardio') {
      var strengthRadio = document.getElementById('create-session-type-strength');
      if (strengthRadio) {
        strengthRadio.checked = true;
        syncSessionTypeUi();
      }
    }

    var allExercises = [];
    parsed.blocks.forEach(function (blk) {
      blk.exercises.forEach(function (ex) {
        if (ex.name || ex.sets || ex.reps || ex.weight) allExercises.push(ex);
      });
    });

    if (workoutTracker && allExercises.length) {
      workoutTracker.loadFromLegacyExercises(allExercises);
      refreshSessionIntensityUi();
      refreshOverloadCoachUi();
      var logbookEl = document.querySelector('.session-logbook-zone');
      if (logbookEl && typeof logbookEl.scrollIntoView === 'function') {
        try {
          logbookEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          logbookEl.scrollIntoView();
        }
      }
      return true;
    }

    if (!blocksEnabled || !blocksList || !blockTemplate) {
      if (typeof onError === 'function') onError('Exercise blocks are not available.');
      return false;
    }
    if (!blocksEnabled.checked) {
      if (exerciseList) exerciseList.innerHTML = '';
      blocksEnabled.checked = true;
    }
    setBlocksUi(true);
    blocksList.innerHTML = '';
    parsed.blocks.forEach(function (blk) {
      var exercises = blk.exercises.filter(function (e) {
        return e.name || e.sets || e.reps || e.weight;
      });
      if (!blk.blockName && !exercises.length) return;
      var block = createBlockElement();
      if (!block) return;
      blocksList.appendChild(block);
      bindBlock(block);
      var nameInput = block.querySelector('.create-block-name');
      if (nameInput && blk.blockName) nameInput.value = blk.blockName;
      var inner = block.querySelector('.create-block-exercises');
      if (!inner) return;
      if (!exercises.length) {
        addExerciseRow(inner, 'standard');
        return;
      }
      exercises.forEach(function (ex) {
        addExerciseRow(inner, 'standard');
        var rows = inner.querySelectorAll('.create-exercise-row');
        var row = rows[rows.length - 1];
        if (row) fillExerciseRowFromParsed(row, ex);
      });
    });
    if (!blocksList.querySelector('[data-create-block]')) {
      addEmptyBlock();
    }
    refreshSessionIntensityUi();
    refreshOverloadCoachUi();
    var logbookEl = document.querySelector('.session-logbook-zone');
    if (logbookEl && typeof logbookEl.scrollIntoView === 'function') {
      try {
        logbookEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        logbookEl.scrollIntoView();
      }
    }
    return true;
  }

  function snippetText(s, maxLen) {
    var t = (s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= maxLen) return t;
    return t.slice(0, maxLen - 1) + '…';
  }

  function formatShortDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  var FAVORITES_LS_KEY = 'strongman-favorite-movements';
  var ANYTHING_ELSE_LS_KEY = 'strongman-coach-anything-else';

  function getCoachLocalExtras() {
    var extras = {};
    try {
      extras.favoriteMovements = localStorage.getItem(FAVORITES_LS_KEY) || '';
    } catch (e) {}
    try {
      extras.notes = localStorage.getItem(ANYTHING_ELSE_LS_KEY) || '';
    } catch (e) {}
    return extras;
  }

  function buildAthleteSummaryForRecommend() {
    var AC = window.AthleteContext;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!AC || !user) return '';
    return AC.buildCoachPromptBlock(user, getCoachLocalExtras());
  }

  function walkStrengthExerciseRows(fn) {
    var useBlocks = blocksEnabled && blocksEnabled.checked;
    var containers = [];
    if (!useBlocks && exerciseList) {
      containers.push({ blockName: '', listEl: exerciseList });
    } else if (blocksList) {
      blocksList.querySelectorAll('[data-create-block]').forEach(function (block) {
        var nameInput = block.querySelector('.create-block-name');
        var listEl = block.querySelector('.create-block-exercises');
        containers.push({
          blockName: nameInput ? nameInput.value.trim() : '',
          listEl: listEl
        });
      });
    }
    containers.forEach(function (c) {
      if (!c.listEl) return;
      c.listEl.querySelectorAll('.create-exercise-row').forEach(function (row) {
        fn(row, c.blockName || '');
      });
    });
  }

  function clearRecommendCellForRow(row) {
    var cell = row && row.querySelector('[data-ex-recommend]');
    if (!cell) return;
    cell.textContent = '—';
    cell.removeAttribute('title');
  }

  function clearAllRecommendCells() {
    walkStrengthExerciseRows(function (row) {
      clearRecommendCellForRow(row);
    });
  }

  function plannedExercisesForRecommend() {
    if (workoutTracker && workoutTracker.hasExercises()) {
      return workoutTracker.getLegacyExercises().map(function (ex) {
        return {
          blockName: '',
          name: ex.name || '',
          sets: ex.sets || '',
          reps: ex.reps || '',
          weight: ex.weight || ''
        };
      });
    }
    var out = [];
    walkStrengthExerciseRows(function (row, blockName) {
      var nameInput = row.querySelector('.create-exercise-name-input');
      var sets = row.querySelector('.create-exercise-sets');
      var reps = row.querySelector('.create-exercise-reps');
      var weight = row.querySelector('.create-exercise-weight');
      out.push({
        blockName: blockName,
        name: nameInput && nameInput.value.trim() ? nameInput.value.trim() : '',
        sets: sets ? String(sets.value || '') : '',
        reps: reps ? String(reps.value || '') : '',
        weight: weight ? String(weight.value || '') : ''
      });
    });
    return out;
  }

  function countStrengthSessionsWithExercises() {
    if (!WL || typeof WL.getSessions !== 'function') return 0;
    var sessions = WL.getSessions();
    var n = 0;
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s || s.sessionType === 'cardio') continue;
      if (!Array.isArray(s.exercises) || !s.exercises.length) continue;
      n++;
    }
    return n;
  }

  function exerciseLineForCoachHistory(ex) {
    if (!ex || !ex.name) return '';
    var w = ex.weight != null ? String(ex.weight) : '';
    var parts = [ex.name];
    if (ex.sets || ex.reps || w) {
      parts.push(String(ex.sets || '?') + '×' + String(ex.reps || '?') + ' @ ' + (w || '?'));
    }
    return parts.join(' ');
  }

  function buildCoachHistorySummary(limitSessions, maxChars) {
    if (!WL || typeof WL.getSessions !== 'function') return '';
    var sessions = WL.getSessions();
    var lines = [];
    var used = 0;
    for (var i = 0; i < sessions.length && lines.length < limitSessions; i++) {
      var s = sessions[i];
      if (!s || s.sessionType === 'cardio') continue;
      if (!Array.isArray(s.exercises) || !s.exercises.length) continue;
      var dt = formatShortDate(s.createdAt);
      var head = (dt ? '[' + dt + '] ' : '') + (s.notes ? snippetText(s.notes, 60) + ' — ' : '');
      var exParts = [];
      for (var j = 0; j < s.exercises.length; j++) {
        var ln = exerciseLineForCoachHistory(s.exercises[j]);
        if (ln) exParts.push(ln);
      }
      if (!exParts.length) continue;
      var line = head + exParts.join('; ');
      if (used + line.length + 1 > maxChars) break;
      lines.push(line);
      used += line.length + 1;
    }
    return lines.join('\n');
  }

  function setOverloadQuotaText(q) {
    if (!overloadQuotaEl) return;
    if (!q || typeof q.used !== 'number') {
      overloadQuotaEl.textContent = '';
      return;
    }
    overloadQuotaEl.textContent =
      'Overload coach today: ' + q.used + ' / ' + q.limit + ' · ' + q.remaining + ' left';
  }

  function showOverloadAsideError(msg) {
    if (!overloadErrorEl) return;
    overloadErrorEl.textContent = msg || '';
    overloadErrorEl.hidden = !msg;
  }

  function fetchOverloadQuota() {
    if (!overloadQuotaEl || typeof apiGet !== 'function') return;
    apiGet('/recommend-progress/quota')
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error('quota');
          return body;
        });
      })
      .then(function (body) {
        if (body && body.quota) setOverloadQuotaText(body.quota);
      })
      .catch(function () {
        setOverloadQuotaText(null);
      });
  }

  function applyRecommendationsToDom(recList) {
    var i = 0;
    walkStrengthExerciseRows(function (row) {
      var cell = row.querySelector('[data-ex-recommend]');
      var r = recList && recList[i];
      i++;
      if (!cell) return;
      if (!r || !r.suggested || r.suggested === '—') {
        cell.textContent = '—';
        cell.removeAttribute('title');
        return;
      }
      cell.textContent = r.suggested;
      if (r.note) cell.setAttribute('title', r.note);
      else cell.removeAttribute('title');
    });
  }

  function fillOverloadSummaryList(recList, planned) {
    if (!overloadSummaryListEl || !overloadSummaryEl) return;
    overloadSummaryListEl.innerHTML = '';
    for (var i = 0; i < planned.length; i++) {
      var p = planned[i];
      var r = recList && recList[i];
      var li = document.createElement('li');
      var label = p && p.name ? p.name : 'Exercise ' + (i + 1);
      var sug = r && r.suggested ? r.suggested : '—';
      li.textContent = label + ': ' + sug;
      overloadSummaryListEl.appendChild(li);
    }
    overloadSummaryEl.hidden = planned.length === 0;
  }

  function refreshOverloadCoachUi() {
    if (!overloadEmptyEl || !overloadActiveEl || !overloadPredictBtn) return;
    var histCount = countStrengthSessionsWithExercises();
    var t = getSessionType();
    var strengthShown = t === 'strength' || t === 'mixed';
    if (histCount < 1) {
      overloadEmptyEl.hidden = false;
      overloadActiveEl.hidden = true;
      overloadEmptyEl.textContent =
        'Save at least one strength session (with exercises) to unlock predictions.';
      clearAllRecommendCells();
      if (overloadSummaryEl) overloadSummaryEl.hidden = true;
      showOverloadAsideError('');
      return;
    }
    if (!strengthShown) {
      overloadEmptyEl.hidden = false;
      overloadActiveEl.hidden = true;
      overloadEmptyEl.textContent =
        'Switch to Strength or Mixed to get load suggestions for this log.';
      clearAllRecommendCells();
      if (overloadSummaryEl) overloadSummaryEl.hidden = true;
      showOverloadAsideError('');
      return;
    }
    overloadEmptyEl.hidden = true;
    overloadActiveEl.hidden = false;
    var planned = plannedExercisesForRecommend();
    var rowsOk = planned.length > 0;
    overloadPredictBtn.disabled = !rowsOk;
    if (!rowsOk) {
      overloadPredictBtn.setAttribute('title', 'Add at least one exercise row first.');
    } else {
      overloadPredictBtn.removeAttribute('title');
    }
    fetchOverloadQuota();
  }

  if (overloadPredictBtn) {
    overloadPredictBtn.addEventListener('click', function () {
      showOverloadAsideError('');
      var planned = plannedExercisesForRecommend();
      if (!planned.length) {
        showOverloadAsideError('Add at least one exercise on the left first.');
        return;
      }
      if (typeof apiPost !== 'function') {
        showOverloadAsideError('Offline: API client not available.');
        return;
      }
      var hist = buildCoachHistorySummary(18, 15000);
      var fav = '';
      try {
        fav = localStorage.getItem(FAVORITES_LS_KEY) || '';
      } catch (e) {}
      overloadPredictBtn.disabled = true;
      clearAllRecommendCells();
      if (overloadSummaryEl) overloadSummaryEl.hidden = true;
      apiPost('/recommend-progress', {
        historySummary: hist,
        favoriteMovements: fav,
        athleteSummary: buildAthleteSummaryForRecommend(),
        plannedExercises: planned
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
                ? 'Daily progressive-overload limit reached. Try again tomorrow.'
                : 'Request failed.');
            var err = new Error(msg);
            if (x.body && x.body.quota) err.quota = x.body.quota;
            throw err;
          }
          return x.body;
        })
        .then(function (body) {
          var rec = body && body.recommendations ? body.recommendations : [];
          applyRecommendationsToDom(rec);
          fillOverloadSummaryList(rec, planned);
          if (body && body.quota) setOverloadQuotaText(body.quota);
        })
        .catch(function (err) {
          showOverloadAsideError(err && err.message ? err.message : 'Request failed.');
          if (err && err.quota) setOverloadQuotaText(err.quota);
        })
        .finally(function () {
          refreshOverloadCoachUi();
        });
    });
  }

    function scrollToLogbook() {
    var logbookEl = document.querySelector('.session-logbook-zone');
    if (logbookEl && typeof logbookEl.scrollIntoView === 'function') {
      try {
        logbookEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        logbookEl.scrollIntoView();
      }
    }
  }

  function renderArchiveList() {
    if (!archiveListEl || !WA) return;
    archiveListEl.innerHTML = '';
    var items = WA.list();
    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'coach-templates-empty';
      empty.textContent =
        'No saved plans yet. Open Coach to build one — each plan can be saved here for next time.';
      archiveListEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      if (!item || !item.id) return;
      var card = document.createElement('article');
      card.className = 'coach-template-card';
      card.setAttribute('role', 'listitem');
      var nameEl = document.createElement('p');
      nameEl.className = 'coach-template-name';
      nameEl.textContent = item.name || 'Untitled';
      var meta = document.createElement('span');
      meta.className = 'coach-template-meta';
      meta.textContent = [formatShortDate(item.createdAt), item.source === 'ai' ? 'Rocky' : 'Saved']
        .filter(Boolean)
        .join(' · ');
      var snip = document.createElement('p');
      snip.className = 'coach-template-snippet';
      snip.textContent = snippetText(item.bodyText, 120);
      var actions = document.createElement('div');
      actions.className = 'coach-template-actions';
      var applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'coach-template-btn';
      applyBtn.textContent = 'Use';
      applyBtn.setAttribute('data-archive-apply', item.id);
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'coach-template-btn coach-template-btn--ghost';
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('data-archive-delete', item.id);
      actions.appendChild(applyBtn);
      actions.appendChild(delBtn);
      card.appendChild(nameEl);
      card.appendChild(meta);
      card.appendChild(snip);
      card.appendChild(actions);
      archiveListEl.appendChild(card);
    });
  }

  if (archiveListEl && WA) {
    archiveListEl.addEventListener('click', function (e) {
      var delBtn = e.target && e.target.closest && e.target.closest('[data-archive-delete]');
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        var delId = delBtn.getAttribute('data-archive-delete');
        if (delId) {
          WA.remove(delId);
          renderArchiveList();
        }
        return;
      }
      var applyBtn = e.target && e.target.closest && e.target.closest('[data-archive-apply]');
      if (!applyBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var applyId = applyBtn.getAttribute('data-archive-apply');
      if (!applyId) return;
      var found = null;
      var list = WA.list();
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === applyId) {
          found = list[i];
          break;
        }
      }
      if (!found) return;
      var ok = applyWorkoutPasteToExerciseBlocks(found.bodyText, showArchiveError);
      if (ok && sessionTitleField && !sessionTitleField.value.trim() && found.name) {
        sessionTitleField.value = found.name;
      }
      if (ok) {
        setMessage('Plan loaded into logbook — adjust and save when done.', false);
        updateLiftsCount();
        scrollToLogbook();
      }
    });
  }

  function applyCoachPasteFromSession() {
    try {
      var paste = sessionStorage.getItem('strongman-coach-apply-paste');
      if (!paste) return;
      sessionStorage.removeItem('strongman-coach-apply-paste');
      var ok = applyWorkoutPasteToExerciseBlocks(paste, setMessage);
      if (ok) {
        setMessage('Coach plan loaded — adjust weights and save when done.', false);
        updateLiftsCount();
        scrollToLogbook();
      }
    } catch (e) {}
  }

  function initCreateArchiveUi() {
    renderArchiveList();
    refreshOverloadCoachUi();
    applyCoachPasteFromSession();
  }

  var quickPasteApply = document.getElementById('create-quick-paste-apply');
  if (quickPasteApply) {
    quickPasteApply.addEventListener('click', function () {
      var ta = document.getElementById('create-quick-paste');
      if (!ta || !ta.value.trim()) {
        setMessage('Paste at least one lift line first.', true);
        return;
      }
      var ok = applyWorkoutPasteToExerciseBlocks(ta.value.trim(), setMessage);
      if (ok) {
        ta.value = '';
        setMessage('Exercises filled — check sets and weights, then save.', false);
        updateLiftsCount();
      }
    });
  }

  var form = document.getElementById('create-workout-form');
  var submitBtn = document.getElementById('create-submit-btn');
  var editBannerEl = document.getElementById('create-edit-banner');
  var editCancelBtn = document.getElementById('create-edit-cancel-btn');
  var editingSessionId = null;

  function findSessionById(sessionId) {
    if (!WL || !sessionId) return null;
    var sessions = WL.getSessions();
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s) continue;
      if (s.id === sessionId) return s;
      if (s.serverId != null && String(s.serverId) === String(sessionId)) return s;
    }
    return null;
  }

  function resetWorkoutFormFields() {
    if (!form) return;
    form.reset();
    if (datetimeInput) datetimeInput.value = defaultDatetimeLocal();
    var strengthRadio = document.getElementById('create-session-type-strength');
    if (strengthRadio) strengthRadio.checked = true;
    syncSessionTypeUi();
    if (blocksEnabled) blocksEnabled.checked = false;
    setBlocksUi(false);
    if (exerciseList) exerciseList.innerHTML = '';
    if (blocksList) blocksList.innerHTML = '';
    if (workoutTracker) workoutTracker.reset();
    if (intensityInput) intensityInput.value = '';
    refreshSessionIntensityUi();
    applySplitAutofillFromPicker();
    updateLiftsCount();
  }

  function exitEditMode() {
    editingSessionId = null;
    if (editBannerEl) editBannerEl.hidden = true;
    if (editCancelBtn) editCancelBtn.hidden = true;
    if (submitBtn) submitBtn.textContent = 'Save workout';
  }

  function loadSessionForEdit(session) {
    if (!session) return;
    setMode('workout');
    editingSessionId = session.id;
    if (editBannerEl) editBannerEl.hidden = false;
    if (editCancelBtn) editCancelBtn.hidden = false;
    if (submitBtn) submitBtn.textContent = 'Save changes';

    if (datetimeInput) {
      var timePart = session.time ? String(session.time).slice(0, 5) : '12:00';
      datetimeInput.value = (session.date || '') + 'T' + timePart;
    }
    var splitEl = document.getElementById('create-split');
    if (splitEl) splitEl.value = session.splitName || '';
    var titleEl = document.getElementById('create-session-title');
    if (titleEl) titleEl.value = session.title || '';
    var notesEl = document.getElementById('create-notes');
    if (notesEl) notesEl.value = session.notes || '';

    var sessionType = session.sessionType === 'cardio' ? 'cardio' : 'strength';
    var typeRadio = document.getElementById(
      sessionType === 'cardio' ? 'create-session-type-cardio' : 'create-session-type-strength'
    );
    if (typeRadio) typeRadio.checked = true;
    syncSessionTypeUi();

    if (intensityInput) {
      intensityInput.value =
        session.totalIntensity != null && session.totalIntensity !== ''
          ? String(session.totalIntensity)
          : '';
    }
    refreshSessionIntensityUi();

    var minutesEl = document.getElementById('create-cardio-minutes');
    var distanceEl = document.getElementById('create-cardio-distance');
    var caloriesEl = document.getElementById('create-cardio-calories');
    if (session.cardio) {
      if (cardioTypeEl && session.cardio.type) cardioTypeEl.value = session.cardio.type;
      if (minutesEl) minutesEl.value = session.cardio.minutes || '';
      if (distanceEl) distanceEl.value = session.cardio.distance || '';
      if (caloriesEl) caloriesEl.value = session.cardio.calories || '';
    } else {
      if (minutesEl) minutesEl.value = '';
      if (distanceEl) distanceEl.value = '';
      if (caloriesEl) caloriesEl.value = '';
    }
    syncCardioFieldsUi();

    if (workoutTracker) {
      workoutTracker.reset();
      if (typeof workoutTracker.setLoggingMode === 'function') {
        workoutTracker.setLoggingMode('quick');
      }
      if (
        session.trackerData &&
        Array.isArray(session.trackerData.exercises) &&
        session.trackerData.exercises.length &&
        typeof workoutTracker.loadFromTrackerExercises === 'function'
      ) {
        workoutTracker.loadFromTrackerExercises(session.trackerData.exercises);
      } else if (session.exercises && session.exercises.length) {
        workoutTracker.loadFromLegacyExercises(session.exercises);
      }
    }
    updateLiftsCount();
    setMessage('Editing logged workout — change anything and save.', false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.WorkoutEdit = {
    open: function (sessionId) {
      var session = findSessionById(sessionId);
      if (session) loadSessionForEdit(session);
    },
    cancel: exitEditMode,
  };

  if (editCancelBtn) {
    editCancelBtn.addEventListener('click', function () {
      exitEditMode();
      resetWorkoutFormFields();
      setMessage('', false);
      window.location.href = '/home';
    });
  }

  var messageEl = document.getElementById('create-message');
  var errorEl = document.getElementById('create-error');

  function setMessage(msg, isError) {
    if (messageEl) {
      messageEl.textContent = msg;
      messageEl.hidden = !msg;
    }
    if (errorEl) {
      errorEl.textContent = isError ? msg : '';
      errorEl.hidden = !isError;
    }
  }

  initCreateArchiveUi();

  function cardioHasContent(c) {
    var m = c.minutes && String(c.minutes).trim() !== '' && parseFloat(c.minutes) > 0;
    var a = c.activity && c.activity.trim() !== '';
    var d = c.distance && String(c.distance).trim() !== '' && parseFloat(c.distance) > 0;
    var cal = c.calories && String(c.calories).trim() !== '' && parseFloat(c.calories) > 0;
    var t = c.type && c.type.trim() !== '';
    return m || a || d || cal || t;
  }

  function buildWorkoutPayloadForDashboard(meta) {
    meta = meta || {};
    if (meta.session && typeof meta.session === 'object') {
      var fromMeta = Object.assign({}, meta.session);
      if (meta.photos) fromMeta.photos = meta.photos;
      return fromMeta;
    }
    if (!WL) throw new Error('Workout log unavailable.');
    var dt = datetimeInput && datetimeInput.value;
    if (!dt) throw new Error('Pick a date and time for this session.');
    var splitName = document.getElementById('create-split').value.trim();
    var title = document.getElementById('create-session-title').value.trim();
    var notes = document.getElementById('create-notes').value.trim();
    if (meta.notes != null) notes = String(meta.notes);
    if (meta.title) title = String(meta.title);
    var sessionType = getSessionType();
    var cardio = collectCardio();
    var exercises = exercisesPassFilter(collectExercises());
    var intensityRaw = intensityInput && intensityInput.value.trim();
    var intensityNum = null;
    if (meta.totalIntensity != null && meta.totalIntensity !== '') {
      intensityNum = parseInt(meta.totalIntensity, 10);
    } else if (intensityRaw !== '') {
      intensityNum = parseInt(intensityRaw, 10);
    }
    if (intensityNum != null && (isNaN(intensityNum) || intensityNum < 0 || intensityNum > 100)) {
      throw new Error('Session intensity must be between 0 and 100.');
    }
    if (sessionType === 'cardio') {
      if (!cardioHasContent(cardio) && !title && !notes) {
        throw new Error('Add cardio details or a title.');
      }
    } else if (!exercises.length && !(workoutTracker && workoutTracker.hasExercises())) {
      throw new Error('Add at least one lift.');
    }
    var parts = dt.split('T');
    var datePart = parts[0] || '';
    var timePart = parts[1] || '';
    var payload = {
      date: datePart,
      time: timePart,
      splitName: splitName,
      title: title,
      notes: notes,
      exercises: exercises,
      totalIntensity: intensityNum,
      sessionType: sessionType,
      cardio: cardioHasContent(cardio) ? cardio : null,
      source: 'create',
    };
    if (workoutTracker && workoutTracker.hasExercises()) {
      payload = window.WorkoutSession.toLegacyPayload(workoutTracker.getSession(), {
        date: datePart,
        time: timePart,
        splitName: splitName,
        title: title,
        notes: notes,
        sessionType: sessionType,
        totalIntensity: intensityNum,
        cardio: cardioHasContent(cardio) ? cardio : null,
      });
    }
    if (blocksEnabled && blocksEnabled.checked) payload.useBlocks = true;
    if (meta.photos) payload.photos = meta.photos;
    return payload;
  }

  function notifyWorkoutLogged() {
    try {
      window.dispatchEvent(new CustomEvent('strongman:workout-saved'));
    } catch (e) {}
    if (typeof renderLogTrainBanner === 'function') renderLogTrainBanner();
  }

  function saveWorkoutForDashboard(meta) {
    meta = meta || {};
    return new Promise(function (resolve, reject) {
      try {
        var payload = buildWorkoutPayloadForDashboard(meta);
        if (meta.preview) {
          resolve(payload);
          return;
        }
        var saved = WL.addSession(payload);
        if (window.StrongmanXp && typeof window.StrongmanXp.awardSession === 'function') {
          try {
            window.StrongmanXp.awardSession(saved || payload);
          } catch (xpErr) {}
        }
        if (workoutTracker) workoutTracker.reset();
        updateLiftsCount();
        notifyWorkoutLogged();
        resolve(saved || payload);
      } catch (err) {
        reject(err);
      }
    });
  }

  if (window.WorkoutDashboard) {
    window.WorkoutDashboard.init({
      getTracker: function () {
        return workoutTracker;
      },
      bootstrapSession: function () {
        /* Routine choice is handled by the start picker */
      },
      startFromChoice: function (choice) {
        return startWorkoutFromChoice(choice);
      },
      listSplitOptions: function () {
        var WS = window.WorkoutSplit;
        if (!WS || typeof WS.listSplits !== 'function') return [];
        return WS.listSplits();
      },
      applyRoutine: function () {
        return applyTodayRoutineIfEmpty(true, true);
      },
      prepareQuickLog: function (choice) {
        choice = choice || {};
        if (!workoutTracker) return Promise.resolve();
        if (typeof workoutTracker.reset === 'function') workoutTracker.reset();
        if (typeof workoutTracker.setLoggingMode === 'function') {
          workoutTracker.setLoggingMode('quick');
        }
        var WS = window.WorkoutSplit;
        if (choice.splitId && WS && typeof WS.setActiveSplit === 'function') {
          WS.setActiveSplit(choice.splitId);
        }
        // Autofill prescribed day + guess loads from recent sessions.
        if (choice.autofillSplit === false) {
          applySplitAutofillFromPicker();
          updateLiftsCount();
          return Promise.resolve();
        }
        return applyTodayRoutineIfEmpty(true, true).then(function () {
          if (
            !workoutTracker.hasExercises() &&
            typeof workoutTracker.openExercisePicker === 'function'
          ) {
            // Keep suggestions available if split day is empty / rest.
            if (window.WorkoutPredict && typeof workoutTracker.render === 'function') {
              workoutTracker.render();
            }
          }
          updateLiftsCount();
        });
      },
      refreshCoach: refreshOverloadCoachUi,
      onFinish: function (meta) {
        return saveWorkoutForDashboard(meta);
      },
      onCancel: function () {
        if (workoutTracker) workoutTracker.reset();
        updateLiftsCount();
      },
    });
  }

  function logSessionDateKey(s) {
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

  function todayKeyLocal() {
    var d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function renderLogTrainBanner() {
    var banner = document.getElementById('log-train-banner');
    if (!banner) return;
    var titleEl = document.getElementById('log-train-banner-title');
    var subEl = document.getElementById('log-train-banner-sub');
    var live =
      window.WorkoutDashboard &&
      typeof window.WorkoutDashboard.isLiveWorkoutActive === 'function' &&
      window.WorkoutDashboard.isLiveWorkoutActive();
    var sessions =
      window.WorkoutLog && typeof window.WorkoutLog.getSessions === 'function'
        ? window.WorkoutLog.getSessions() || []
        : [];
    var todayKey = todayKeyLocal();
    var trainedToday = sessions.some(function (s) {
      return logSessionDateKey(s) === todayKey;
    });

    if (live || trainedToday) {
      banner.hidden = true;
      return;
    }

    var focus = '';
    var sub = 'Log a session or jump into a live workout.';
    var WS = window.WorkoutSplit;
    if (window.DailyPlan && typeof window.DailyPlan.buildPlan === 'function') {
      try {
        var plan = window.DailyPlan.buildPlan();
        if (plan) {
          if (plan.restDay) {
            banner.hidden = true;
            return;
          }
          focus = plan.headline || plan.focus || '';
          if (plan.exercises && plan.exercises.length) {
            sub =
              plan.exercises.length +
              ' lift' +
              (plan.exercises.length === 1 ? '' : 's') +
              ' on today’s split · weights guessed from recent sessions';
          } else if (plan.primaryAction && plan.primaryAction.hint) {
            sub = plan.primaryAction.hint;
          }
        }
      } catch (e) {}
    } else if (WS) {
      if (typeof WS.isRestDay === 'function' && WS.isRestDay(null, new Date())) {
        banner.hidden = true;
        return;
      }
      if (typeof WS.defaultSessionTitle === 'function') {
        focus = WS.defaultSessionTitle(null, new Date()) || '';
      }
      var ex =
        typeof WS.exercisesForDate === 'function' ? WS.exercisesForDate(null, new Date()) : [];
      if (ex && ex.length) {
        sub =
          ex.length +
          ' lift' +
          (ex.length === 1 ? '' : 's') +
          ' prescribed · autofill from your split';
      }
    }

    if (titleEl) {
      titleEl.textContent = focus && focus !== 'Rest day' ? focus : 'Start today’s workout';
    }
    if (subEl) subEl.textContent = sub;
    banner.hidden = false;
  }

  (function bindLogTrainBanner() {
    var startBtn = document.getElementById('log-train-start');
    var quickBtn = document.getElementById('log-train-quick');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        if (window.WorkoutDashboard && typeof window.WorkoutDashboard.open === 'function') {
          window.WorkoutDashboard.open();
        }
      });
    }
    if (quickBtn) {
      quickBtn.addEventListener('click', function () {
        if (window.WorkoutDashboard && typeof window.WorkoutDashboard.openQuickLog === 'function') {
          window.WorkoutDashboard.openQuickLog({ autofillSplit: true });
        }
      });
    }
    renderLogTrainBanner();
    document.addEventListener('strongman:training-synced', renderLogTrainBanner);
    window.addEventListener('strongman:workout-saved', renderLogTrainBanner);
    document.addEventListener('strongman:xp-updated', renderLogTrainBanner);
  })();

  if (form && WL) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setMessage('', false);
      var dt = datetimeInput && datetimeInput.value;
      if (!dt) {
        setMessage('Pick a date and time for this session.', true);
        return;
      }
      var splitName = document.getElementById('create-split').value.trim();
      var title = document.getElementById('create-session-title').value.trim();
      var notes = document.getElementById('create-notes').value.trim();
      var sessionType = getSessionType();
      var cardio = collectCardio();
      var exercises = exercisesPassFilter(collectExercises());
      var intensityRaw = intensityInput && intensityInput.value.trim();
      var intensityNum = null;
      if (intensityRaw !== '') {
        intensityNum = parseInt(intensityRaw, 10);
        if (isNaN(intensityNum) || intensityNum < 0 || intensityNum > 100) {
          setMessage('Session intensity must be between 0 and 100, or leave it blank.', true);
          return;
        }
      }

      if (sessionType === 'cardio') {
        if (!cardioHasContent(cardio) && !title && !notes) {
          setMessage('Add cardio duration or activity, or write a title or notes.', true);
          return;
        }
      } else {
        if (!exercises.length) {
          setMessage('Add at least one lift, or switch to cardio-only.', true);
          return;
        }
      }

      var parts = dt.split('T');
      var datePart = parts[0] || '';
      var timePart = parts[1] || '';

      var payload = {
        date: datePart,
        time: timePart,
        splitName: splitName,
        title: title,
        notes: notes,
        exercises: exercises,
        totalIntensity: intensityNum,
        sessionType: sessionType,
        cardio: cardioHasContent(cardio) ? cardio : null,
        source: 'create'
      };
      if (workoutTracker && workoutTracker.hasExercises()) {
        var trackerPayload = window.WorkoutSession.toLegacyPayload(workoutTracker.getSession(), {
          date: datePart,
          time: timePart,
          splitName: splitName,
          title: title,
          notes: notes,
          sessionType: sessionType,
          totalIntensity: intensityNum,
          cardio: cardioHasContent(cardio) ? cardio : null
        });
        payload = trackerPayload;
      }
      if (blocksEnabled && blocksEnabled.checked) {
        payload.useBlocks = true;
      }

      if (editingSessionId && typeof WL.replaceSession === 'function') {
        var updated = WL.replaceSession(editingSessionId, payload);
        if (!updated) {
          setMessage('Could not update that workout.', true);
          return;
        }
        exitEditMode();
        resetWorkoutFormFields();
        setMessage('Workout updated.', false);
        if (window.TrainingSync && typeof window.TrainingSync.syncAll === 'function') {
          window.TrainingSync.syncAll();
        }
        return;
      }

      WL.addSession(payload);
      if (window.StrongmanXp && typeof window.StrongmanXp.awardSession === 'function') {
        try {
          window.StrongmanXp.awardSession(payload);
        } catch (xpErr) {}
      }
      notifyWorkoutLogged();
      lastShareSession = JSON.parse(JSON.stringify(payload));
      try {
        var cu2 = window.getCurrentUser && window.getCurrentUser();
        var uid2 = cu2 && cu2.id != null ? Number(cu2.id) : null;
        window.pendingCompetitionCheckIn = false;
        if (uid2 && window.competitionsStoreSync) {
          window.competitionsStoreSync(uid2).then(function () {
            window.pendingCompetitionCheckIn = !!(
              window.competitionsStoreOngoing && window.competitionsStoreOngoing(uid2).length > 0
            );
          });
        }
      } catch (e3) {
        window.pendingCompetitionCheckIn = false;
      }
      setMessage('Workout saved. Download your Instagram story sticker, or click Skip.', false);
      form.reset();
      if (datetimeInput) datetimeInput.value = defaultDatetimeLocal();
      document.getElementById('create-session-type-strength').checked = true;
      syncSessionTypeUi();
      if (blocksEnabled) blocksEnabled.checked = false;
      setBlocksUi(false);
      if (exerciseList) exerciseList.innerHTML = '';
      if (blocksList) blocksList.innerHTML = '';
      if (workoutTracker) workoutTracker.reset();
      updateLiftsCount();
      if (intensityInput) intensityInput.value = '';
      refreshSessionIntensityUi();
      applySplitAutofillFromPicker();
      openShareModal();
      refreshOverloadCoachUi();
    });
  }

  var shareBackdrop = document.getElementById('create-share-backdrop');
  var shareModal = document.getElementById('create-share-modal');
  var shareModalClose = document.getElementById('create-share-modal-close');
  var shareSkip = document.getElementById('create-share-skip');
  var shareInstagramBtn = document.getElementById('create-share-instagram');
  var sharePreview = document.getElementById('create-share-preview');
  var shareIncTitle = document.getElementById('create-share-inc-title');
  var shareIncNotes = document.getElementById('create-share-inc-notes');
  var shareIncIntensity = document.getElementById('create-share-inc-intensity');
  var shareIncBw = document.getElementById('create-share-inc-bw');
  var shareBwWrap = document.getElementById('create-share-bw-wrap');
  var shareBodyweight = document.getElementById('create-share-bodyweight');
  var shareExerciseChecks = document.getElementById('create-share-exercise-checks');
  var shareExercisesWrap = document.getElementById('create-share-exercises-wrap');
  var shareCardioLineWrap = document.getElementById('create-share-cardio-line-wrap');
  var shareIncCardio = document.getElementById('create-share-inc-cardio');
  var shareIgConnect = document.getElementById('create-share-ig-connect');
  var sharePreviewTimer = null;
  var shareStatus = document.getElementById('create-share-status');

  var compReportBackdrop = document.getElementById('create-comp-report-backdrop');
  var compReportModal = document.getElementById('create-comp-report-modal');
  var compReportClose = document.getElementById('create-comp-report-close');
  var compReportSkip = document.getElementById('create-comp-report-skip');
  var compReportSave = document.getElementById('create-comp-report-save');
  var compReportSelect = document.getElementById('create-comp-report-select');
  var compReportProgress = document.getElementById('create-comp-report-progress');
  var compReportNote = document.getElementById('create-comp-report-note');
  var compReportStatus = document.getElementById('create-comp-report-status');
  var compReportCacheList = null;

  function setCompReportStatus(t) {
    if (compReportStatus) compReportStatus.textContent = t || '';
  }

  function closeCompetitionReportModal() {
    if (compReportBackdrop) {
      compReportBackdrop.classList.remove('is-open');
      compReportBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (compReportModal) {
      compReportModal.classList.remove('is-open');
      compReportModal.setAttribute('aria-hidden', 'true');
    }
    setCompReportStatus('');
    compReportCacheList = null;
  }

  function findCompInList(list, id) {
    var sid = String(id);
    for (var i = 0; i < (list || []).length; i++) {
      if (list[i] && String(list[i].id) === sid) return list[i];
    }
    return null;
  }

  function syncCompReportFormFromSelect() {
    var id = compReportSelect && compReportSelect.value;
    var c = findCompInList(compReportCacheList, id);
    if (compReportProgress && c) {
      var p = Math.max(0, Math.min(100, Math.round(Number(c.progressSelfPct) || 0)));
      compReportProgress.value = String(p);
    }
    if (compReportNote) compReportNote.value = '';
  }

  function openCompetitionReportModal(ongoingList) {
    if (!compReportModal || !compReportSelect || !ongoingList || !ongoingList.length) return;
    compReportCacheList = ongoingList;
    compReportSelect.innerHTML = '';
    for (var i = 0; i < ongoingList.length; i++) {
      var c = ongoingList[i];
      if (!c || !c.id) continue;
      var opt = document.createElement('option');
      opt.value = String(c.id);
      opt.appendChild(document.createTextNode((c.goalTitle || 'Competition').slice(0, 120)));
      compReportSelect.appendChild(opt);
    }
    if (!compReportSelect.options.length) return;
    syncCompReportFormFromSelect();
    if (compReportBackdrop) {
      compReportBackdrop.classList.add('is-open');
      compReportBackdrop.setAttribute('aria-hidden', 'false');
    }
    compReportModal.classList.add('is-open');
    compReportModal.setAttribute('aria-hidden', 'false');
  }

  function tryOpenCompetitionReportAfterShare() {
    if (!window.pendingCompetitionCheckIn) return;
    window.pendingCompetitionCheckIn = false;
    var cu = window.getCurrentUser && window.getCurrentUser();
    var uid = cu && cu.id != null ? Number(cu.id) : null;
    if (!uid || !window.competitionsStoreOngoing) return;
    var openIfAny = function () {
      var list = window.competitionsStoreOngoing(uid);
      if (!list.length) return;
      openCompetitionReportModal(list);
    };
    if (window.competitionsStoreSync) {
      window.competitionsStoreSync(uid).then(openIfAny).catch(openIfAny);
    } else {
      openIfAny();
    }
  }

  var shareObjectUrl = null;
  var shareLoadedImg = null;
  var shareOverlayPos = { x: 50, y: 78 };
  var shareOverlayDrag = {
    active: false,
    startX: 0,
    startY: 0,
    origX: 50,
    origY: 78
  };

  function setShareStatus(text) {
    if (shareStatus) shareStatus.textContent = text || '';
  }

  function closeShareModal() {
    if (shareBackdrop) {
      shareBackdrop.classList.remove('is-open');
      shareBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (shareModal) {
      shareModal.classList.remove('is-open');
      shareModal.setAttribute('aria-hidden', 'true');
    }
    clearShareGraphicState();
    tryOpenCompetitionReportAfterShare();
  }

  function getCreateShareStickerSession() {
    if (!lastShareSession) return null;
    var ui = getShareOptionsFromUi();
    var copy = JSON.parse(JSON.stringify(lastShareSession));
    if (lastShareSession.exercises && lastShareSession.exercises.length) {
      copy.exercises = ui.exercises || [];
    }
    if (ui.incBw && ui.bwText) {
      var bwLine = 'BW: ' + ui.bwText;
      copy.notes = copy.notes ? copy.notes + '\n' + bwLine : bwLine;
    }
    return copy;
  }

  function getCreateShareStickerOpts() {
    var ui = getShareOptionsFromUi();
    return {
      incTitle: ui.incTitle,
      incDateTime: true,
      incExercises: !lastShareSession || !(lastShareSession.exercises || []).length || ui.exercises.length > 0,
      incCardio: ui.incCardio,
      incIntensity: ui.incIntensity,
      incNotes: ui.incNotes || (ui.incBw && !!ui.bwText),
    };
  }

  function scheduleShareStickerPreview() {
    if (sharePreviewTimer) clearTimeout(sharePreviewTimer);
    sharePreviewTimer = setTimeout(function () {
      sharePreviewTimer = null;
      if (!lastShareSession || !sharePreview || !window.StorySticker) return;
      var session = getCreateShareStickerSession();
      window.StorySticker.renderWorkoutSticker(
        session,
        getCreateShareStickerOpts(),
        WL,
        function (err, blob, canvas) {
          if (err || !canvas) return;
          sharePreview.innerHTML = '';
          var cssW = Math.min(sharePreview.clientWidth || 320, 360);
          var scale = cssW / canvas.width;
          canvas.style.width = cssW + 'px';
          canvas.style.height = Math.round(canvas.height * scale) + 'px';
          sharePreview.appendChild(canvas);
        }
      );
    }, 120);
  }

  function openShareModal() {
    if (!lastShareSession || !shareModal) return;
    clearShareGraphicState();
    populateShareExerciseChecks();
    syncShareCardioUi();
    if (shareBackdrop) {
      shareBackdrop.classList.add('is-open');
      shareBackdrop.setAttribute('aria-hidden', 'false');
    }
    shareModal.classList.add('is-open');
    shareModal.setAttribute('aria-hidden', 'false');
    if (shareIncTitle) shareIncTitle.checked = true;
    if (shareIncNotes) shareIncNotes.checked = true;
    if (shareIncIntensity) shareIncIntensity.checked = false;
    if (shareIncBw) shareIncBw.checked = false;
    if (shareBwWrap) shareBwWrap.hidden = true;
    if (shareBodyweight) shareBodyweight.value = '';
    if (shareIncCardio) shareIncCardio.checked = false;
    if (window.InstagramConnect && shareIgConnect) {
      window.InstagramConnect.mount(shareIgConnect, { className: 'ig-connect ig-connect--modal' });
    }
    scheduleShareStickerPreview();
  }

  function formatExerciseBullet(ex) {
    var sets = ex.sets || '0';
    var reps = ex.reps || '0';
    var name = ex.name || 'Exercise';
    var line = '- ' + sets + '×' + reps + ' ' + name;
    if (ex.superset) {
      line +=
        ' + ' +
        (ex.superset.sets || '0') +
        '×' +
        (ex.superset.reps || '0') +
        ' ' +
        (ex.superset.name || 'superset');
    }
    if (ex.dropSets && ex.dropSets.length) {
      line +=
        ' · drops ' +
        ex.dropSets
          .map(function (drop) {
            var repsText = drop.reps || '0';
            var weightText = drop.weight ? drop.weight + ' lb' : 'bodyweight';
            return repsText + ' @ ' + weightText;
          })
          .join(', ');
    }
    return line;
  }

  function formatCardioBullet(cardio) {
    if (!cardio) return '';
    var m = parseFloat(cardio.minutes);
    var d = parseFloat(cardio.distance);
    var cal = parseFloat(cardio.calories);
    var act = cardioTypeLabel(cardio.type) || (cardio.activity || '').trim();
    var parts = [];
    if (!isNaN(m) && m > 0) parts.push(Math.round(m) + ' min');
    if (act) parts.push(act);
    if (cardio.type === 'sports') {
      if (!isNaN(cal) && cal > 0) parts.push(Math.round(cal) + ' cal');
    } else if (!isNaN(d) && d > 0) {
      parts.push((Math.round(d * 100) / 100) + ' mi');
    }
    if (parts.length) return '- ' + parts.join(' · ');
    return '';
  }

  function populateShareExerciseChecks() {
    if (!shareExerciseChecks || !lastShareSession) return;
    shareExerciseChecks.innerHTML = '';
    var ex = lastShareSession.exercises || [];
    if (!ex.length) {
      if (shareExercisesWrap) {
        shareExercisesWrap.hidden = true;
      }
      return;
    }
    if (shareExercisesWrap) shareExercisesWrap.hidden = false;
    ex.forEach(function (exercise, i) {
      var id = 'create-share-ex-' + i;
      var lab = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'create-checkbox';
      cb.id = id;
      cb.dataset.exerciseIndex = String(i);
      cb.checked = false;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + formatExerciseBullet(exercise)));
      shareExerciseChecks.appendChild(lab);
    });
  }

  function syncShareCardioUi() {
    if (!lastShareSession || !shareCardioLineWrap || !shareIncCardio) return;
    var line = formatCardioBullet(lastShareSession.cardio);
    var show = !!line && lastShareSession.sessionType !== 'strength';
    shareCardioLineWrap.hidden = !show;
    shareIncCardio.checked = false;
  }

  function getShareOptionsFromUi() {
    var selectedEx = [];
    if (shareExerciseChecks) {
      shareExerciseChecks.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        if (cb.checked && lastShareSession.exercises) {
          var i = parseInt(cb.dataset.exerciseIndex, 10);
          if (!isNaN(i) && lastShareSession.exercises[i]) {
            selectedEx.push(lastShareSession.exercises[i]);
          }
        }
      });
    }
    return {
      incTitle: shareIncTitle && shareIncTitle.checked,
      incNotes: shareIncNotes && shareIncNotes.checked,
      incIntensity: shareIncIntensity && shareIncIntensity.checked,
      incBw: shareIncBw && shareIncBw.checked,
      bwText: shareBodyweight && shareBodyweight.value.trim(),
      incCardio: shareIncCardio && !shareCardioLineWrap.hidden && shareIncCardio.checked,
      exercises: selectedEx
    };
  }

  function clearShareGraphicState() {
    if (sharePreview) {
      sharePreview.innerHTML =
        '<span class="create-share-preview-placeholder" id="create-share-preview-placeholder">Preview updates as you change options</span>';
    }
    setShareStatus('');
  }

  function formatDisplayDate(ymd) {
    if (!ymd) return '';
    var p = ymd.split('-');
    if (p.length !== 3) return ymd;
    var y = parseInt(p[0], 10);
    var mo = parseInt(p[1], 10);
    var d = parseInt(p[2], 10);
    return mo + '/' + d + '/' + String(y).slice(-2);
  }

  function formatDisplayTime(hm) {
    if (!hm) return '';
    var p = hm.split(':');
    var h = parseInt(p[0], 10);
    var mi = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(mi)) return hm;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(mi) + ' ' + ampm;
  }

  function drawImageCover(ctx, img, cw, ch) {
    var ir = img.width / img.height;
    var cr = cw / ch;
    var dw;
    var dh;
    var ox;
    var oy;
    if (ir > cr) {
      dh = ch;
      dw = img.width * (ch / img.height);
      ox = (cw - dw) / 2;
      oy = 0;
    } else {
      dw = cw;
      dh = img.height * (cw / img.width);
      ox = 0;
      oy = (ch - dh) / 2;
    }
    ctx.drawImage(img, ox, oy, dw, dh);
  }

  function wrapLines(ctx, text, maxWidth) {
    if (!text) return [];
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function buildOverlayLines(session, opts) {
    if (!session) return [];
    var out = [];
    var dateText = formatDisplayDate(session.date);
    var timeText = formatDisplayTime(session.time);
    var dateLine = [dateText, timeText].filter(Boolean).join(' · ');
    if (dateLine) out.push({ kind: 'date', text: dateLine });
    out.push({ kind: 'brand', text: 'STRONGMAN AI' });
    var displayTitle =
      session.title ||
      session.splitName ||
      (session.sessionType === 'cardio' ? 'Cardio' : 'Workout');
    if (opts.incTitle && displayTitle) {
      out.push({ kind: 'title', text: displayTitle });
    }
    (opts.exercises || []).forEach(function (ex) {
      out.push({ kind: 'bullet', text: formatExerciseBullet(ex) });
    });
    if (opts.incCardio) {
      var cb = formatCardioBullet(session.cardio);
      if (cb) out.push({ kind: 'bullet', text: cb });
    }
    if (opts.incNotes && session.notes && session.notes.trim()) {
      out.push({ kind: 'notes', text: session.notes.trim() });
    }
    if (opts.incIntensity && session.totalIntensity != null && WL) {
      out.push({
        kind: 'meta',
        text:
          'Intensity · ' +
          session.totalIntensity +
          ' (' +
          WL.intensityLabel(session.totalIntensity) +
          ')'
      });
    }
    if (opts.incBw && opts.bwText) {
      out.push({ kind: 'meta', text: opts.bwText });
    }
    return out;
  }

  function refreshShareOverlayContent() {
    if (!shareOverlayText) return;
    if (!lastShareSession) {
      shareOverlayText.innerHTML = '';
      return;
    }
    var lines = buildOverlayLines(lastShareSession, getShareOptionsFromUi());
    shareOverlayText.innerHTML = '';
    lines.forEach(function (l) {
      var node = document.createElement('div');
      node.className =
        'create-share-overlay-line create-share-overlay-line--' + l.kind;
      node.textContent = l.text;
      shareOverlayText.appendChild(node);
    });
  }

  function applyShareOverlayVisuals() {
    if (!shareOverlayEl || !shareOverlayText) return;
    var sizePx = shareOverlaySize ? parseInt(shareOverlaySize.value, 10) || 22 : 22;
    shareOverlayText.style.fontSize = sizePx + 'px';
    var op = shareOverlayOpacity ? parseInt(shareOverlayOpacity.value, 10) / 100 : 0.95;
    shareOverlayEl.style.opacity = String(Math.max(0.25, Math.min(1, op)));
  }

  function applyShareOverlayPosition() {
    if (!shareOverlayEl) return;
    shareOverlayEl.style.left = shareOverlayPos.x + '%';
    shareOverlayEl.style.top = shareOverlayPos.y + '%';
    shareOverlayEl.style.transform = 'translate(-50%, -50%)';
  }

  // Per-kind canvas font specs (em multipliers vs base body size).
  // Mirrors the CSS so the rendered PNG matches the live preview.
  var SHARE_KIND_STYLES = {
    date: { mult: 0.7, weight: '500', color: 'rgba(255,255,255,0.85)', lh: 1.25 },
    brand: { mult: 0.95, weight: 'bold', color: '#ff8c00', lh: 1.2, upper: true, letter: 0.1 },
    title: { mult: 1.55, weight: 'bold', color: '#ffffff', lh: 1.15 },
    bullet: { mult: 1.0, weight: '500', color: 'rgba(255,255,255,0.94)', lh: 1.25 },
    notes: { mult: 0.82, weight: '500', color: 'rgba(255,255,255,0.78)', lh: 1.3 },
    meta: { mult: 0.85, weight: '500', color: 'rgba(255,255,255,0.82)', lh: 1.25 }
  };

  function setKindFont(ctx, kind, basePx) {
    var style = SHARE_KIND_STYLES[kind] || SHARE_KIND_STYLES.bullet;
    var px = Math.max(8, Math.round(basePx * style.mult));
    ctx.font = style.weight + ' ' + px + 'px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = style.color;
    return { px: px, lh: px * style.lh, style: style };
  }

  function renderShareToCanvas(callback) {
    if (!lastShareSession || !shareLoadedImg || !sharePreview) {
      callback(new Error('Not ready'));
      return;
    }
    var canvas = document.createElement('canvas');
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    var ctx = canvas.getContext('2d');
    try {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, STORY_W, STORY_H);
      drawImageCover(ctx, shareLoadedImg, STORY_W, STORY_H);

      var opts = getShareOptionsFromUi();
      var lines = buildOverlayLines(lastShareSession, opts);
      if (!lines.length) {
        canvas.toBlob(
          function (blob) {
            if (blob) callback(null, blob, canvas);
            else callback(new Error('Blob failed'));
          },
          'image/png',
          0.95
        );
        return;
      }

      var stageW = sharePreview.clientWidth || 320;
      var scale = STORY_W / stageW;
      var sliderPx = shareOverlaySize ? parseInt(shareOverlaySize.value, 10) || 22 : 22;
      var basePx = sliderPx * scale;
      var op = shareOverlayOpacity
        ? Math.max(0.25, Math.min(1, parseInt(shareOverlayOpacity.value, 10) / 100))
        : 0.95;

      var maxOverlayW = Math.round(STORY_W * 0.88);
      var padX = Math.round(basePx * 0.55);
      var padY = Math.round(basePx * 0.4);
      var lineGapEm = 0.25;
      var maxTextW = maxOverlayW - 2 * padX;

      var laidOut = [];
      var totalH = 0;
      var widestLine = 0;
      for (var i = 0; i < lines.length; i++) {
        var meta = setKindFont(ctx, lines[i].kind, basePx);
        var wrapped = wrapLines(ctx, lines[i].text, maxTextW);
        wrapped.forEach(function (segment) {
          var w = ctx.measureText(segment).width;
          if (w > widestLine) widestLine = w;
        });
        var blockH = wrapped.length * meta.lh;
        if (laidOut.length) totalH += basePx * lineGapEm;
        totalH += blockH;
        laidOut.push({
          kind: lines[i].kind,
          wrapped: wrapped,
          lineHeight: meta.lh,
          fontPx: meta.px,
          style: meta.style
        });
      }
      var overlayW = Math.min(maxOverlayW, Math.round(widestLine + 2 * padX));
      var overlayH = Math.round(totalH + 2 * padY);

      var posX = (shareOverlayPos.x / 100) * STORY_W;
      var posY = (shareOverlayPos.y / 100) * STORY_H;
      var boxX = Math.round(posX - overlayW / 2);
      var boxY = Math.round(posY - overlayH / 2);

      ctx.save();
      ctx.globalAlpha = op;
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      var radius = Math.round(basePx * 0.35);
      var rx = boxX;
      var ry = boxY;
      var rw = overlayW;
      var rh = overlayH;
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rw - radius, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
      ctx.lineTo(rx + rw, ry + rh - radius);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
      ctx.lineTo(rx + radius, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = Math.max(2, Math.round(basePx * 0.18));
      ctx.shadowOffsetY = Math.max(1, Math.round(basePx * 0.05));

      var cursorY = boxY + padY;
      var textX = boxX + padX;
      for (var j = 0; j < laidOut.length; j++) {
        var seg = laidOut[j];
        var sty = seg.style;
        ctx.font = sty.weight + ' ' + seg.fontPx + 'px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = sty.color;
        for (var k = 0; k < seg.wrapped.length; k++) {
          var raw = seg.wrapped[k];
          var draw = sty.upper ? raw.toUpperCase() : raw;
          ctx.fillText(draw, textX, cursorY);
          cursorY += seg.lineHeight;
        }
        if (j < laidOut.length - 1) {
          cursorY += basePx * lineGapEm;
        }
      }
      ctx.restore();

      canvas.toBlob(
        function (blob) {
          if (blob) callback(null, blob, canvas);
          else callback(new Error('Blob failed'));
        },
        'image/png',
        0.95
      );
    } catch (err) {
      callback(err);
    }
  }

  function refreshShareDownloadState() {
    if (shareDownloadBtn) {
      shareDownloadBtn.disabled = !shareLoadedImg || !lastShareSession;
    }
  }

  ;[shareIncTitle, shareIncNotes, shareIncIntensity, shareIncCardio, shareIncBw].forEach(function (el) {
    if (el) el.addEventListener('change', scheduleShareStickerPreview);
  });

  if (shareBodyweight) {
    shareBodyweight.addEventListener('input', scheduleShareStickerPreview);
  }

  if (shareExerciseChecks) {
    shareExerciseChecks.addEventListener('change', scheduleShareStickerPreview);
  }

  window.addEventListener('strongman:instagram-updated', function () {
    if (shareModal && shareModal.classList.contains('is-open')) {
      scheduleShareStickerPreview();
    }
  });

  if (window.StorySticker && shareInstagramBtn) {
    window.StorySticker.wireInstagramShareButton(
      shareInstagramBtn,
      function () {
        return {
          session: getCreateShareStickerSession(),
          opts: getCreateShareStickerOpts(),
          WL: WL,
        };
      },
      setShareStatus
    );
  }

  if (shareIncBw && shareBwWrap) {
    shareIncBw.addEventListener('change', function () {
      shareBwWrap.hidden = !shareIncBw.checked;
      scheduleShareStickerPreview();
    });
  }

  function bindShareModalClose(el) {
    if (!el) return;
    el.addEventListener('click', closeShareModal);
  }
  bindShareModalClose(shareModalClose);
  bindShareModalClose(shareSkip);
  if (shareBackdrop) {
    shareBackdrop.addEventListener('click', closeShareModal);
  }

  if (compReportSelect) {
    compReportSelect.addEventListener('change', syncCompReportFormFromSelect);
  }
  function bindCompReportClose(el) {
    if (!el) return;
    el.addEventListener('click', closeCompetitionReportModal);
  }
  bindCompReportClose(compReportClose);
  bindCompReportClose(compReportSkip);
  if (compReportBackdrop) {
    compReportBackdrop.addEventListener('click', closeCompetitionReportModal);
  }
  if (compReportSave) {
    compReportSave.addEventListener('click', function () {
      var cu = window.getCurrentUser && window.getCurrentUser();
      var uid = cu && cu.id != null ? Number(cu.id) : null;
      var id = compReportSelect && compReportSelect.value;
      if (!uid || !id || !window.competitionsStoreUpdate) return;
      var pr = compReportProgress ? parseInt(compReportProgress.value, 10) : 0;
      if (isNaN(pr) || pr < 0 || pr > 100) {
        setCompReportStatus('Enter progress from 0 to 100.');
        return;
      }
      var note = compReportNote ? compReportNote.value.trim() : '';
      compReportSave.disabled = true;
      window
        .competitionsStoreUpdate(uid, id, {
          progressSelfPct: pr,
          lastReportNote: note,
          lastReportAt: new Date().toISOString()
        })
        .then(function () {
          closeCompetitionReportModal();
        })
        .catch(function () {
          setCompReportStatus('Could not save progress. Try again.');
        })
        .then(function () {
          compReportSave.disabled = false;
        });
    });
  }

})();
