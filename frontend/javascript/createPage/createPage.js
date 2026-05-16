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

  var tabWorkout = document.getElementById('create-tab-workout');
  var tabVideo = document.getElementById('create-tab-video');
  var tabSplit = document.getElementById('create-tab-split');
  var panelWorkout = document.getElementById('create-panel-workout');
  var panelVideo = document.getElementById('create-panel-video');
  var panelSplit = document.getElementById('create-panel-split');

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

  function loadSplitEditorForm() {
    var WS = window.WorkoutSplit;
    if (!WS) return;
    var state = WS.load();
    var nameEl = document.getElementById('create-split-program-name');
    if (nameEl) nameEl.value = state.programName || '';
    for (var i = 0; i < 7; i++) {
      var inp = document.getElementById('create-split-day-' + i);
      if (inp) inp.value = state.days[i] || '';
    }
  }

  function setMode(mode) {
    var isWorkout = mode === 'workout';
    var isVideo = mode === 'video';
    var isSplit = mode === 'split';
    if (tabWorkout) {
      tabWorkout.classList.toggle('active', isWorkout);
      tabWorkout.setAttribute('aria-selected', isWorkout ? 'true' : 'false');
    }
    if (tabVideo) {
      tabVideo.classList.toggle('active', isVideo);
      tabVideo.setAttribute('aria-selected', isVideo ? 'true' : 'false');
    }
    if (tabSplit) {
      tabSplit.classList.toggle('active', isSplit);
      tabSplit.setAttribute('aria-selected', isSplit ? 'true' : 'false');
    }
    if (panelWorkout) {
      panelWorkout.classList.toggle('create-panel--active', isWorkout);
      panelWorkout.hidden = !isWorkout;
    }
    if (panelVideo) {
      panelVideo.classList.toggle('create-panel--active', isVideo);
      panelVideo.hidden = !isVideo;
    }
    if (panelSplit) {
      panelSplit.classList.toggle('create-panel--active', isSplit);
      panelSplit.hidden = !isSplit;
    }
    if (isWorkout) {
      applySplitAutofillFromPicker();
      initCreateArchiveUi();
    }
    if (isSplit) {
      loadSplitEditorForm();
    }
  }

  function applyHashToMode() {
    if (location.hash === '#split') {
      setMode('split');
    }
  }

  if (tabWorkout) {
    tabWorkout.addEventListener('click', function () {
      setMode('workout');
      if (history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    });
  }
  if (tabVideo) {
    tabVideo.addEventListener('click', function () {
      setMode('video');
      if (history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search);
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

  window.addEventListener('hashchange', applyHashToMode);
  applyHashToMode();

  var exerciseList = document.getElementById('create-exercise-list');
  var template = document.getElementById('create-exercise-row-template');
  var blockTemplate = document.getElementById('create-block-template');
  var addExerciseRowContainer = document.getElementById('create-add-exercise-row');
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
    datetimeInput.addEventListener('change', applySplitAutofillFromPicker);
    datetimeInput.addEventListener('input', applySplitAutofillFromPicker);
  }
  applySplitAutofillFromPicker();

  var splitFormEl = document.getElementById('create-split-form');
  var splitMessageEl = document.getElementById('create-split-message');
  var splitErrorEl = document.getElementById('create-split-error');
  if (splitFormEl && window.WorkoutSplit) {
    splitFormEl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (splitErrorEl) {
        splitErrorEl.textContent = '';
        splitErrorEl.hidden = true;
      }
      var days = [];
      for (var i = 0; i < 7; i++) {
        var di = document.getElementById('create-split-day-' + i);
        days.push(di && di.value ? di.value.trim() : '');
      }
      var pn = document.getElementById('create-split-program-name');
      window.WorkoutSplit.save({
        programName: pn && pn.value ? pn.value.trim() : '',
        days: days
      });
      if (splitMessageEl) {
        splitMessageEl.textContent = 'Split saved. Log workout uses this for “Split / focus”.';
        splitMessageEl.hidden = false;
      }
      applySplitAutofillFromPicker();
    });
  }

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

  function bindRow(row) {
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
        var list = row.parentElement;
        if (list && list.querySelectorAll('.create-exercise-row').length <= 1) return;
        row.remove();
        refreshSessionIntensityUi();
        refreshOverloadCoachUi();
      });
    }
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

  wireAddExerciseRowContainer(addExerciseRowContainer, function () {
    return exerciseList;
  });

  function createBlockElement() {
    if (!blockTemplate || !blockTemplate.content) return null;
    return blockTemplate.content.firstElementChild.cloneNode(true);
  }

  function bindBlock(block) {
    if (!block) return;
    var removeBlockBtn = block.querySelector('.create-block-remove');
    var addRowContainer = block.querySelector('.create-add-exercise-row--block');
    var innerList = block.querySelector('.create-block-exercises');
    if (removeBlockBtn) {
      removeBlockBtn.addEventListener('click', function () {
        var all = blocksList.querySelectorAll('[data-create-block]');
        if (all.length <= 1) return;
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
      addExerciseRow(exerciseList);
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

  if (exerciseList) {
    addExerciseRow(exerciseList);
  }
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
    var strengthEl = document.getElementById('create-strength-section');
    if (strengthEl && typeof strengthEl.scrollIntoView === 'function') {
      try {
        strengthEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        strengthEl.scrollIntoView();
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

  function renderArchiveList() {
    if (!archiveListEl || !WA) return;
    archiveListEl.innerHTML = '';
    var items = WA.list();
    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'create-archive-empty';
      empty.textContent =
        'No saved plans yet. Open Generate to create one — it saves here automatically — then use Apply to session below when you log a workout.';
      archiveListEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      if (!item || !item.id) return;
      var card = document.createElement('div');
      card.className = 'create-archive-card';
      card.setAttribute('role', 'listitem');
      var head = document.createElement('div');
      head.className = 'create-archive-card-head';
      var nameEl = document.createElement('p');
      nameEl.className = 'create-archive-card-name';
      nameEl.textContent = item.name || 'Untitled';
      var meta = document.createElement('span');
      meta.className = 'create-archive-card-meta';
      meta.textContent = [formatShortDate(item.createdAt), item.source === 'ai' ? 'AI' : 'Saved']
        .filter(Boolean)
        .join(' · ');
      head.appendChild(nameEl);
      head.appendChild(meta);
      var snip = document.createElement('p');
      snip.className = 'create-archive-snippet';
      snip.textContent = snippetText(item.bodyText, 140);
      var actions = document.createElement('div');
      actions.className = 'create-archive-card-actions';
      var applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'create-archive-btn';
      applyBtn.textContent = 'Apply to session';
      applyBtn.setAttribute('data-archive-apply', item.id);
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'create-archive-btn create-archive-btn--danger';
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('data-archive-delete', item.id);
      actions.appendChild(applyBtn);
      actions.appendChild(delBtn);
      card.appendChild(head);
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
    });
  }

  function initCreateArchiveUi() {
    renderArchiveList();
    refreshOverloadCoachUi();
  }
  initCreateArchiveUi();

  var form = document.getElementById('create-workout-form');
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

  function cardioHasContent(c) {
    var m = c.minutes && String(c.minutes).trim() !== '' && parseFloat(c.minutes) > 0;
    var a = c.activity && c.activity.trim() !== '';
    var d = c.distance && String(c.distance).trim() !== '' && parseFloat(c.distance) > 0;
    var cal = c.calories && String(c.calories).trim() !== '' && parseFloat(c.calories) > 0;
    var t = c.type && c.type.trim() !== '';
    return m || a || d || cal || t;
  }

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
      var intensityNum = parseInt(intensityRaw, 10);
      if (intensityRaw === '' || isNaN(intensityNum) || intensityNum < 0 || intensityNum > 100) {
        setMessage('Set session intensity from 0–100 based on how hard the session felt for you.', true);
        return;
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
      if (blocksEnabled && blocksEnabled.checked) {
        payload.useBlocks = true;
      }
      WL.addSession(payload);
      lastShareSession = JSON.parse(JSON.stringify(payload));
      try {
        var cu2 = window.getCurrentUser && window.getCurrentUser();
        var uid2 = cu2 && cu2.id != null ? Number(cu2.id) : null;
        window.pendingCompetitionCheckIn = !!(
          uid2 &&
          window.competitionsStoreOngoing &&
          window.competitionsStoreOngoing(uid2).length > 0
        );
      } catch (e3) {
        window.pendingCompetitionCheckIn = false;
      }
      setMessage('Workout saved. Customize your story graphic in the window, or click Skip.', false);
      form.reset();
      if (datetimeInput) datetimeInput.value = defaultDatetimeLocal();
      document.getElementById('create-session-type-strength').checked = true;
      syncSessionTypeUi();
      if (blocksEnabled) blocksEnabled.checked = false;
      setBlocksUi(false);
      if (exerciseList) exerciseList.innerHTML = '';
      if (blocksList) blocksList.innerHTML = '';
      addExerciseRow(exerciseList);
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
  var shareImageInput = document.getElementById('create-share-image');
  var shareDownloadBtn = document.getElementById('create-share-download');
  var sharePreview = document.getElementById('create-share-preview');
  var sharePreviewImg = document.getElementById('create-share-preview-img');
  var sharePreviewPlaceholder = document.getElementById('create-share-preview-placeholder');
  var shareOverlayEl = document.getElementById('create-share-overlay');
  var shareOverlayText = document.getElementById('create-share-overlay-text');
  var shareOverlaySize = document.getElementById('create-share-overlay-size');
  var shareOverlayOpacity = document.getElementById('create-share-overlay-opacity');
  var shareStatus = document.getElementById('create-share-status');
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
    var list = window.competitionsStoreOngoing(uid);
    if (!list.length) return;
    openCompetitionReportModal(list);
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
    if (shareOverlaySize) shareOverlaySize.value = '22';
    if (shareOverlayOpacity) shareOverlayOpacity.value = '95';
    shareOverlayPos = { x: 50, y: 78 };
    applyShareOverlayPosition();
    applyShareOverlayVisuals();
    refreshShareOverlayContent();
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
    if (shareObjectUrl) {
      try {
        URL.revokeObjectURL(shareObjectUrl);
      } catch (e) {}
      shareObjectUrl = null;
    }
    shareLoadedImg = null;
    if (sharePreviewImg) {
      sharePreviewImg.removeAttribute('src');
      sharePreviewImg.hidden = true;
    }
    if (sharePreviewPlaceholder) {
      sharePreviewPlaceholder.textContent = 'Choose a photo';
      sharePreviewPlaceholder.hidden = false;
    }
    if (shareOverlayEl) shareOverlayEl.hidden = true;
    if (shareDownloadBtn) shareDownloadBtn.disabled = true;
    if (shareImageInput) shareImageInput.value = '';
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
    ctx.font = style.weight + ' ' + px + 'px Helvetica, Arial, sans-serif';
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
        ctx.font = sty.weight + ' ' + seg.fontPx + 'px Helvetica, Arial, sans-serif';
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

  if (shareIncBw && shareBwWrap) {
    shareIncBw.addEventListener('change', function () {
      shareBwWrap.hidden = !shareIncBw.checked;
      refreshShareOverlayContent();
    });
  }

  if (shareBodyweight) {
    shareBodyweight.addEventListener('input', refreshShareOverlayContent);
  }

  ;[shareIncTitle, shareIncNotes, shareIncIntensity, shareIncCardio].forEach(function (el) {
    if (el) el.addEventListener('change', refreshShareOverlayContent);
  });

  if (shareExerciseChecks) {
    shareExerciseChecks.addEventListener('change', refreshShareOverlayContent);
  }

  if (shareOverlaySize) {
    shareOverlaySize.addEventListener('input', applyShareOverlayVisuals);
  }
  if (shareOverlayOpacity) {
    shareOverlayOpacity.addEventListener('input', applyShareOverlayVisuals);
  }

  function shareClientPoint(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onShareOverlayPointerDown(e) {
    if (!shareOverlayEl || !sharePreview || shareOverlayEl.hidden) return;
    e.preventDefault();
    var pt = shareClientPoint(e);
    shareOverlayDrag.active = true;
    shareOverlayDrag.startX = pt.x;
    shareOverlayDrag.startY = pt.y;
    shareOverlayDrag.origX = shareOverlayPos.x;
    shareOverlayDrag.origY = shareOverlayPos.y;
  }

  function onShareOverlayPointerMove(e) {
    if (!shareOverlayDrag.active || !sharePreview) return;
    var pt = shareClientPoint(e);
    var rect = sharePreview.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dx = ((pt.x - shareOverlayDrag.startX) / rect.width) * 100;
    var dy = ((pt.y - shareOverlayDrag.startY) / rect.height) * 100;
    shareOverlayPos.x = Math.max(6, Math.min(94, shareOverlayDrag.origX + dx));
    shareOverlayPos.y = Math.max(6, Math.min(94, shareOverlayDrag.origY + dy));
    applyShareOverlayPosition();
  }

  function onShareOverlayPointerUp() {
    shareOverlayDrag.active = false;
  }

  if (shareOverlayEl) {
    shareOverlayEl.addEventListener('mousedown', onShareOverlayPointerDown);
    document.addEventListener('mousemove', onShareOverlayPointerMove);
    document.addEventListener('mouseup', onShareOverlayPointerUp);
    shareOverlayEl.addEventListener('touchstart', onShareOverlayPointerDown, { passive: false });
    document.addEventListener('touchmove', onShareOverlayPointerMove, { passive: false });
    document.addEventListener('touchend', onShareOverlayPointerUp);
    document.addEventListener('touchcancel', onShareOverlayPointerUp);
  }

  if (shareImageInput && sharePreview) {
    shareImageInput.addEventListener('change', function () {
      if (shareObjectUrl) {
        try {
          URL.revokeObjectURL(shareObjectUrl);
        } catch (e) {}
        shareObjectUrl = null;
      }
      shareLoadedImg = null;
      var f = shareImageInput.files && shareImageInput.files[0];
      if (!f) {
        if (sharePreviewImg) {
          sharePreviewImg.removeAttribute('src');
          sharePreviewImg.hidden = true;
        }
        if (sharePreviewPlaceholder) {
          sharePreviewPlaceholder.textContent = 'Choose a photo';
          sharePreviewPlaceholder.hidden = false;
        }
        if (shareOverlayEl) shareOverlayEl.hidden = true;
        refreshShareDownloadState();
        setShareStatus('');
        return;
      }
      shareObjectUrl = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        shareLoadedImg = img;
        if (sharePreviewImg) {
          sharePreviewImg.src = shareObjectUrl;
          sharePreviewImg.hidden = false;
        }
        if (sharePreviewPlaceholder) sharePreviewPlaceholder.hidden = true;
        if (shareOverlayEl) shareOverlayEl.hidden = false;
        applyShareOverlayPosition();
        applyShareOverlayVisuals();
        refreshShareOverlayContent();
        refreshShareDownloadState();
        setShareStatus('Drag the overlay, adjust size and opacity, then download.');
      };
      img.onerror = function () {
        shareLoadedImg = null;
        if (sharePreviewImg) {
          sharePreviewImg.removeAttribute('src');
          sharePreviewImg.hidden = true;
        }
        if (sharePreviewPlaceholder) {
          sharePreviewPlaceholder.textContent = 'Could not load image';
          sharePreviewPlaceholder.hidden = false;
        }
        if (shareOverlayEl) shareOverlayEl.hidden = true;
        refreshShareDownloadState();
        setShareStatus('Could not read that file.');
      };
      img.src = shareObjectUrl;
      img.alt = 'Share preview';
    });
  }

  if (shareDownloadBtn) {
    shareDownloadBtn.addEventListener('click', function () {
      if (!shareLoadedImg || !lastShareSession) return;
      setShareStatus('Generating PNG…');
      renderShareToCanvas(function (err, blob) {
        if (err || !blob) {
          setShareStatus('Could not create PNG.');
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'strongman-story-' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 2000);
        setShareStatus('Download started (1080×1920).');
      });
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
      window.competitionsStoreUpdate(uid, id, {
        progressSelfPct: pr,
        lastReportNote: note,
        lastReportAt: new Date().toISOString()
      });
      closeCompetitionReportModal();
    });
  }

  var videoForm = document.getElementById('create-video-form');
  var videoMessage = document.getElementById('create-video-message');
  var videoError = document.getElementById('create-video-error');
  var videoFile = document.getElementById('create-video-file');
  var videoDrop = document.getElementById('create-video-drop');
  var videoFilename = document.getElementById('create-video-filename');
  var videoTitleInput = document.getElementById('create-video-title');
  var videoStudio = document.getElementById('create-video-studio');
  var videoStage = document.getElementById('create-video-stage');
  var videoPreview = document.getElementById('create-video-preview');
  var videoOverlayEl = document.getElementById('create-video-title-overlay');
  var videoOverlayDisplay = document.getElementById('create-video-overlay-display');
  var videoOverlayInput = document.getElementById('create-video-overlay-input');
  var videoOverlaySize = document.getElementById('create-video-overlay-size');
  var videoOverlayOpacity = document.getElementById('create-video-overlay-opacity');
  var videoLikeBtn = document.getElementById('create-video-like-btn');
  var videoFollowBtn = document.getElementById('create-video-follow-btn');
  var videoProfileLink = document.getElementById('create-video-profile-link');

  var videoObjectUrl = null;
  var overlayPos = { x: 50, y: 16 };
  var overlayDrag = {
    active: false,
    startX: 0,
    startY: 0,
    origX: 50,
    origY: 16
  };

  var audioOpenBtn = document.getElementById('create-video-audio-open-btn');
  var audioRemoveBtn = document.getElementById('create-video-audio-remove-btn');
  var audioSummaryEl = document.getElementById('create-video-audio-summary');
  var audioLayerEl = document.getElementById('create-video-audio-layer');
  var audioBackdrop = document.getElementById('create-audio-overlay-backdrop');
  var audioModal = document.getElementById('create-audio-overlay-modal');
  var audioModalClose = document.getElementById('create-audio-overlay-close');
  var audioRecordStart = document.getElementById('create-audio-record-start');
  var audioRecordStop = document.getElementById('create-audio-record-stop');
  var audioFileInput = document.getElementById('create-audio-file-input');
  var audioModalPreview = document.getElementById('create-audio-modal-preview');
  var audioOverlayStatus = document.getElementById('create-audio-overlay-status');
  var audioTrimSection = document.getElementById('create-audio-trim-section');
  var audioTrimStartEl = document.getElementById('create-audio-trim-start');
  var audioTrimEndEl = document.getElementById('create-audio-trim-end');
  var audioTrimStartVal = document.getElementById('create-audio-trim-start-val');
  var audioTrimEndVal = document.getElementById('create-audio-trim-end-val');
  var audioMuteOriginalEl = document.getElementById('create-audio-mute-original');
  var audioClearBtn = document.getElementById('create-audio-clear-btn');
  var audioDoneBtn = document.getElementById('create-audio-done-btn');

  var audioOverlayBlob = null;
  var audioTrimStart = 0;
  var audioTrimEnd = 0;
  var muteOriginalForOverlay = true;
  var audioModalPreviewUrl = null;
  var audioLayerObjectUrl = null;
  var audioPlaybackDestroy = null;
  var mediaRecorder = null;
  var mediaStream = null;
  var recordedChunks = [];
  var modalWorkingBlob = null;

  function formatAudioSec(x) {
    var n = Math.max(0, Number(x) || 0);
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function setAudioOverlayStatus(msg) {
    if (audioOverlayStatus) audioOverlayStatus.textContent = msg || '';
  }

  function revokeAudioModalPreviewUrl() {
    if (audioModalPreviewUrl) {
      try {
        URL.revokeObjectURL(audioModalPreviewUrl);
      } catch (e) {}
      audioModalPreviewUrl = null;
    }
  }

  function stopMediaTracks() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (e) {}
      });
      mediaStream = null;
    }
  }

  function updateAudioSummary() {
    if (!audioSummaryEl) return;
    if (!audioOverlayBlob) {
      audioSummaryEl.textContent = '';
      if (audioRemoveBtn) audioRemoveBtn.hidden = true;
      return;
    }
    if (audioRemoveBtn) audioRemoveBtn.hidden = false;
    audioSummaryEl.textContent =
      'Overlay on: ' +
      formatAudioSec(audioTrimStart) +
      's–' +
      formatAudioSec(audioTrimEnd) +
      's' +
      (muteOriginalForOverlay ? ' · video muted' : ' · video sound on');
  }

  function resetAudioOverlayState() {
    audioOverlayBlob = null;
    audioTrimStart = 0;
    audioTrimEnd = 0;
    muteOriginalForOverlay = true;
    modalWorkingBlob = null;
    if (audioPlaybackDestroy) {
      audioPlaybackDestroy();
      audioPlaybackDestroy = null;
    }
    if (audioLayerObjectUrl) {
      try {
        URL.revokeObjectURL(audioLayerObjectUrl);
      } catch (e) {}
      audioLayerObjectUrl = null;
    }
    if (audioLayerEl) {
      audioLayerEl.removeAttribute('src');
      try {
        audioLayerEl.load();
      } catch (e) {}
    }
    if (videoPreview) {
      videoPreview.muted = false;
    }
    updateAudioSummary();
  }

  function refreshAudioLayerPreview() {
    if (audioPlaybackDestroy) {
      audioPlaybackDestroy();
      audioPlaybackDestroy = null;
    }
    if (audioLayerObjectUrl) {
      try {
        URL.revokeObjectURL(audioLayerObjectUrl);
      } catch (e) {}
      audioLayerObjectUrl = null;
    }
    if (!audioOverlayBlob || !audioLayerEl || !videoPreview || !window.VideoArchive) {
      updateAudioSummary();
      return;
    }
    audioLayerObjectUrl = URL.createObjectURL(audioOverlayBlob);
    audioLayerEl.src = audioLayerObjectUrl;
    audioPlaybackDestroy = window.VideoArchive.attachSyncedPlayback(videoPreview, audioLayerEl, {
      trimStart: audioTrimStart,
      trimEnd: audioTrimEnd,
      muteOriginal: muteOriginalForOverlay
    });
    updateAudioSummary();
  }

  function setupTrimSlidersForDuration(dur) {
    if (!audioTrimStartEl || !audioTrimEndEl || !audioTrimSection) return;
    var d = Math.max(0.1, dur || 0.1);
    audioTrimSection.hidden = false;
    audioTrimStartEl.min = '0';
    audioTrimStartEl.max = String(Math.max(0, d - 0.05));
    audioTrimEndEl.min = '0.05';
    audioTrimEndEl.max = String(d);
    audioTrimStartEl.step = '0.05';
    audioTrimEndEl.step = '0.05';
    audioTrimStartEl.value = '0';
    audioTrimEndEl.value = String(d);
    if (audioTrimStartVal) audioTrimStartVal.textContent = formatAudioSec(0);
    if (audioTrimEndVal) audioTrimEndVal.textContent = formatAudioSec(d);
  }

  function clampTrimSliders() {
    if (!audioTrimStartEl || !audioTrimEndEl || !audioModalPreview) return;
    var d = audioModalPreview.duration;
    if (!d || isNaN(d)) return;
    var a = parseFloat(audioTrimStartEl.value) || 0;
    var b = parseFloat(audioTrimEndEl.value) || d;
    var gap = 0.05;
    if (a >= b - gap) {
      a = Math.max(0, b - gap);
      audioTrimStartEl.value = String(a);
    }
    if (b <= a + gap) {
      b = Math.min(d, a + gap);
      audioTrimEndEl.value = String(b);
    }
    if (audioTrimStartVal) audioTrimStartVal.textContent = formatAudioSec(audioTrimStartEl.value);
    if (audioTrimEndVal) audioTrimEndVal.textContent = formatAudioSec(audioTrimEndEl.value);
  }

  function loadModalPreviewFromBlob(blob) {
    if (!audioModalPreview || !blob) return;
    revokeAudioModalPreviewUrl();
    modalWorkingBlob = blob;
    audioModalPreviewUrl = URL.createObjectURL(blob);
    audioModalPreview.src = audioModalPreviewUrl;
    audioModalPreview.onloadedmetadata = function () {
      audioModalPreview.onloadedmetadata = null;
      setupTrimSlidersForDuration(audioModalPreview.duration);
      clampTrimSliders();
    };
  }

  function openAudioModal() {
    if (!audioModal || !audioBackdrop) return;
    if (!videoStage || !videoStage.classList.contains('is-loaded')) {
      setAudioOverlayStatus('Add a video clip first.');
      return;
    }
    setAudioOverlayStatus('');
    modalWorkingBlob = audioOverlayBlob;
    if (audioMuteOriginalEl) {
      audioMuteOriginalEl.checked = muteOriginalForOverlay;
    }
    if (modalWorkingBlob) {
      loadModalPreviewFromBlob(modalWorkingBlob);
    } else {
      revokeAudioModalPreviewUrl();
      if (audioModalPreview) {
        audioModalPreview.removeAttribute('src');
        try {
          audioModalPreview.load();
        } catch (e) {}
      }
      if (audioTrimSection) audioTrimSection.hidden = true;
    }
    audioModal.hidden = false;
    audioBackdrop.hidden = false;
    audioModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeAudioModal() {
    if (!audioModal || !audioBackdrop) return;
    stopMediaTracks();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }
    mediaRecorder = null;
    if (audioRecordStop) audioRecordStop.disabled = true;
    if (audioRecordStart) audioRecordStart.disabled = false;
    audioModal.hidden = true;
    audioBackdrop.hidden = true;
    audioModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function pickRecorderMime() {
    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (var i = 0; i < types.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(types[i])) {
        return types[i];
      }
    }
    return '';
  }

  if (audioRemoveBtn) {
    audioRemoveBtn.addEventListener('click', function () {
      resetAudioOverlayState();
    });
  }
  if (audioOpenBtn) {
    audioOpenBtn.addEventListener('click', openAudioModal);
  }
  if (audioModalClose) {
    audioModalClose.addEventListener('click', closeAudioModal);
  }
  if (audioBackdrop) {
    audioBackdrop.addEventListener('click', closeAudioModal);
  }
  if (audioFileInput) {
    audioFileInput.addEventListener('change', function () {
      var f = audioFileInput.files && audioFileInput.files[0];
      audioFileInput.value = '';
      if (!f) return;
      setAudioOverlayStatus('');
      loadModalPreviewFromBlob(f);
    });
  }
  if (audioTrimStartEl) {
    audioTrimStartEl.addEventListener('input', clampTrimSliders);
  }
  if (audioTrimEndEl) {
    audioTrimEndEl.addEventListener('input', clampTrimSliders);
  }
  if (audioClearBtn) {
    audioClearBtn.addEventListener('click', function () {
      modalWorkingBlob = null;
      revokeAudioModalPreviewUrl();
      if (audioModalPreview) {
        audioModalPreview.removeAttribute('src');
        try {
          audioModalPreview.load();
        } catch (e) {}
      }
      if (audioTrimSection) audioTrimSection.hidden = true;
      setAudioOverlayStatus('Audio cleared for this session.');
    });
  }
  if (audioDoneBtn) {
    audioDoneBtn.addEventListener('click', function () {
      if (!modalWorkingBlob) {
        setAudioOverlayStatus('Record or attach audio before applying.');
        return;
      }
      audioOverlayBlob = modalWorkingBlob;
      audioTrimStart = parseFloat(audioTrimStartEl && audioTrimStartEl.value) || 0;
      audioTrimEnd = parseFloat(audioTrimEndEl && audioTrimEndEl.value) || 0;
      if (audioTrimEnd <= audioTrimStart) {
        setAudioOverlayStatus('End time must be after start.');
        return;
      }
      muteOriginalForOverlay = !!(audioMuteOriginalEl && audioMuteOriginalEl.checked);
      closeAudioModal();
      refreshAudioLayerPreview();
    });
  }
  if (audioRecordStart && audioRecordStop) {
    audioRecordStart.addEventListener('click', function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setAudioOverlayStatus('Recording not supported in this browser.');
        return;
      }
      setAudioOverlayStatus('Recording…');
      recordedChunks = [];
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (stream) {
          stopMediaTracks();
          mediaStream = stream;
          var mime = pickRecorderMime();
          try {
            mediaRecorder = mime
              ? new MediaRecorder(stream, { mimeType: mime })
              : new MediaRecorder(stream);
          } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
          }
          mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size) recordedChunks.push(e.data);
          };
          mediaRecorder.onstop = function () {
            stopMediaTracks();
            var blob = new Blob(recordedChunks, {
              type: mediaRecorder && mediaRecorder.mimeType ? mediaRecorder.mimeType : 'audio/webm'
            });
            recordedChunks = [];
            mediaRecorder = null;
            if (blob.size) {
              loadModalPreviewFromBlob(blob);
              setAudioOverlayStatus('Recording ready — adjust trim, then Apply.');
            } else {
              setAudioOverlayStatus('Recording was empty.');
            }
          };
          mediaRecorder.start();
          audioRecordStart.disabled = true;
          audioRecordStop.disabled = false;
        })
        .catch(function () {
          setAudioOverlayStatus('Microphone permission denied or unavailable.');
        });
    });
    audioRecordStop.addEventListener('click', function () {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      stopMediaTracks();
      audioRecordStart.disabled = false;
      audioRecordStop.disabled = true;
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (audioModal && !audioModal.hidden) closeAudioModal();
  });

  function setVideoMessage(msg, isError) {
    if (videoMessage) {
      videoMessage.textContent = msg;
      videoMessage.hidden = !msg;
    }
    if (videoError) {
      videoError.textContent = isError ? msg : '';
      videoError.hidden = !isError;
    }
  }

  function revokeVideoObjectUrl() {
    if (videoObjectUrl) {
      try {
        URL.revokeObjectURL(videoObjectUrl);
      } catch (e) {}
      videoObjectUrl = null;
    }
  }

  function syncOverlayTextFromInputs() {
    var t = '';
    if (videoTitleInput && videoTitleInput.value.trim()) {
      t = videoTitleInput.value.trim();
      if (videoOverlayInput) videoOverlayInput.value = t;
    } else if (videoOverlayInput && videoOverlayInput.value.trim()) {
      t = videoOverlayInput.value.trim();
    }
    if (!t) t = 'Title';
    if (videoOverlayDisplay) videoOverlayDisplay.textContent = t;
  }

  function applyOverlayVisuals() {
    if (!videoOverlayEl || !videoOverlayDisplay) return;
    var sizePx = videoOverlaySize ? parseInt(videoOverlaySize.value, 10) || 22 : 22;
    videoOverlayDisplay.style.fontSize = sizePx + 'px';
    var op = videoOverlayOpacity ? parseInt(videoOverlayOpacity.value, 10) / 100 : 0.95;
    videoOverlayEl.style.opacity = String(Math.max(0.25, Math.min(1, op)));
  }

  function applyOverlayPosition() {
    if (!videoOverlayEl) return;
    videoOverlayEl.style.left = overlayPos.x + '%';
    videoOverlayEl.style.top = overlayPos.y + '%';
    videoOverlayEl.style.transform = 'translate(-50%, -50%)';
  }

  function syncProfileStrip() {
    if (!videoProfileLink) return;
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var handle = u && (u.username || u.firstName) ? String(u.username || u.firstName) : '';
    if (handle) {
      videoProfileLink.textContent = '@' + handle;
      videoProfileLink.setAttribute('aria-label', 'View profile @' + handle);
    } else {
      videoProfileLink.textContent = 'Profile';
      videoProfileLink.setAttribute('aria-label', 'View profile');
    }
  }

  function resetVideoStudio() {
    revokeVideoObjectUrl();
    resetAudioOverlayState();
    if (audioOpenBtn) audioOpenBtn.disabled = true;
    if (videoPreview) {
      videoPreview.removeAttribute('src');
      try {
        videoPreview.load();
      } catch (e) {}
    }
    if (videoStage) videoStage.classList.remove('is-loaded', 'is-error');
    if (videoStudio) videoStudio.hidden = true;
  }

  function loadVideoPreviewFromFile() {
    if (!videoFile || !videoPreview || !videoStage || !videoStudio) return;
    var file = videoFile.files && videoFile.files[0];
    if (!file) {
      resetVideoStudio();
      return;
    }

    revokeVideoObjectUrl();
    videoStage.classList.remove('is-loaded', 'is-error');
    videoPreview.removeAttribute('src');
    try {
      videoPreview.load();
    } catch (e) {}

    videoObjectUrl = URL.createObjectURL(file);
    videoStudio.hidden = false;
    videoPreview.src = videoObjectUrl;

    function onLoaded() {
      videoStage.classList.add('is-loaded');
      videoStage.classList.remove('is-error');
      if (audioOpenBtn) audioOpenBtn.disabled = false;
      videoPreview.removeEventListener('loadeddata', onLoaded);
      videoPreview.removeEventListener('canplay', onLoaded);
    }
    function onErr() {
      videoStage.classList.add('is-error');
      videoStage.classList.remove('is-loaded');
      videoPreview.removeEventListener('error', onErr);
    }

    videoPreview.addEventListener('loadeddata', onLoaded, { once: true });
    videoPreview.addEventListener('canplay', onLoaded, { once: true });
    videoPreview.addEventListener('error', onErr, { once: true });

    syncOverlayTextFromInputs();
    applyOverlayVisuals();
    applyOverlayPosition();
    syncProfileStrip();
  }

  function showFileName() {
    if (!videoFile || !videoFilename) return;
    var f = videoFile.files && videoFile.files[0];
    if (f) {
      videoFilename.textContent = f.name;
      videoFilename.hidden = false;
      loadVideoPreviewFromFile();
    } else {
      videoFilename.textContent = '';
      videoFilename.hidden = true;
      resetVideoStudio();
    }
  }

  if (videoFile) {
    videoFile.addEventListener('change', showFileName);
  }

  if (videoDrop && videoFile) {
    ;['dragenter', 'dragover'].forEach(function (ev) {
      videoDrop.addEventListener(ev, function (e) {
        e.preventDefault();
        videoDrop.classList.add('create-video-drop--drag');
      });
    });
    ;['dragleave', 'drop'].forEach(function (ev) {
      videoDrop.addEventListener(ev, function (e) {
        e.preventDefault();
        videoDrop.classList.remove('create-video-drop--drag');
      });
    });
    videoDrop.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) {
        videoFile.files = files;
        showFileName();
      }
    });
  }

  if (videoTitleInput) {
    videoTitleInput.addEventListener('input', function () {
      syncOverlayTextFromInputs();
    });
  }
  if (videoOverlayInput) {
    videoOverlayInput.addEventListener('input', function () {
      if (videoOverlayDisplay) videoOverlayDisplay.textContent = videoOverlayInput.value.trim() || 'Title';
      if (videoTitleInput) videoTitleInput.value = videoOverlayInput.value;
    });
  }
  if (videoOverlaySize) {
    videoOverlaySize.addEventListener('input', applyOverlayVisuals);
  }
  if (videoOverlayOpacity) {
    videoOverlayOpacity.addEventListener('input', applyOverlayVisuals);
  }

  function clientPoint(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onOverlayPointerDown(e) {
    if (!videoOverlayEl || !videoStage) return;
    e.preventDefault();
    var pt = clientPoint(e);
    overlayDrag.active = true;
    overlayDrag.startX = pt.x;
    overlayDrag.startY = pt.y;
    overlayDrag.origX = overlayPos.x;
    overlayDrag.origY = overlayPos.y;
  }

  function onOverlayPointerMove(e) {
    if (!overlayDrag.active || !videoStage) return;
    var pt = clientPoint(e);
    var rect = videoStage.getBoundingClientRect();
    var dx = ((pt.x - overlayDrag.startX) / rect.width) * 100;
    var dy = ((pt.y - overlayDrag.startY) / rect.height) * 100;
    overlayPos.x = Math.max(6, Math.min(94, overlayDrag.origX + dx));
    overlayPos.y = Math.max(6, Math.min(94, overlayDrag.origY + dy));
    applyOverlayPosition();
  }

  function onOverlayPointerUp() {
    overlayDrag.active = false;
  }

  if (videoOverlayEl) {
    videoOverlayEl.addEventListener('mousedown', onOverlayPointerDown);
    document.addEventListener('mousemove', onOverlayPointerMove);
    document.addEventListener('mouseup', onOverlayPointerUp);
    videoOverlayEl.addEventListener('touchstart', onOverlayPointerDown, { passive: false });
    document.addEventListener('touchmove', onOverlayPointerMove, { passive: false });
    document.addEventListener('touchend', onOverlayPointerUp);
    document.addEventListener('touchcancel', onOverlayPointerUp);
  }

  if (videoLikeBtn) {
    videoLikeBtn.addEventListener('click', function () {
      var liked = !videoLikeBtn.classList.contains('is-liked');
      videoLikeBtn.classList.toggle('is-liked', liked);
      videoLikeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      var icon = videoLikeBtn.querySelector('.create-video-like-icon');
      if (icon) icon.textContent = liked ? '♥' : '♡';
    });
  }

  if (videoFollowBtn) {
    videoFollowBtn.addEventListener('click', function () {
      var following = !videoFollowBtn.classList.contains('is-following');
      videoFollowBtn.classList.toggle('is-following', following);
      videoFollowBtn.textContent = following ? 'Following' : 'Follow';
    });
  }

  syncProfileStrip();
  applyOverlayPosition();
  applyOverlayVisuals();

  if (audioOpenBtn) {
    audioOpenBtn.disabled = true;
  }

  if (videoForm) {
    videoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setVideoMessage('', false);
      var file = videoFile && videoFile.files && videoFile.files[0];
      if (!file) {
        setVideoMessage('Choose a video file to upload.', true);
        return;
      }
      if (!window.VideoArchive || typeof window.VideoArchive.add !== 'function') {
        setVideoMessage('Video archive needs IndexedDB (try another browser or disable private mode).', true);
        return;
      }
      var notesEl = document.getElementById('create-video-notes');
      var uploader =
        typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var displayName = 'Member';
      if (uploader) {
        if (uploader.username && String(uploader.username).trim()) {
          displayName = String(uploader.username).trim();
        } else if (uploader.firstName && String(uploader.firstName).trim()) {
          displayName = String(uploader.firstName).trim();
        }
      }
      var entry = {
        title:
          videoTitleInput && videoTitleInput.value.trim()
            ? videoTitleInput.value.trim()
            : 'Untitled clip',
        notes: notesEl && notesEl.value ? notesEl.value.trim() : '',
        createdAt: Date.now(),
        videoBlob: file,
        audioBlob: audioOverlayBlob || null,
        audioTrimStart: audioOverlayBlob ? audioTrimStart : 0,
        audioTrimEnd: audioOverlayBlob ? audioTrimEnd : 0,
        muteOriginal: !!muteOriginalForOverlay,
        uploaderDisplayName: displayName,
        uploaderUserId: uploader && uploader.id != null ? uploader.id : null,
        viewCount: 0
      };
      window.VideoArchive.add(entry).then(function () {
        try {
          window.dispatchEvent(new CustomEvent('strongman-video-archive-changed'));
        } catch (e) {}
        setVideoMessage(
          'Saved locally. It appears on Explore; Tracking → Video archive has the full list.',
          false
        );
      }).catch(function () {
        setVideoMessage('Could not save to archive (storage full or unavailable).', true);
      });
    });
  }
})();
