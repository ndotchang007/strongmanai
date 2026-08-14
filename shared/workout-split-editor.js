(function () {
  'use strict';

  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  var FOCUS_PRESETS = [
    'PUSH',
    'PULL',
    'LEGS',
    'UPPER',
    'LOWER',
    'FULL BODY',
    'ARMS',
    'CHEST',
    'BACK',
    'SHOULDERS',
    'REST',
  ];

  function toDayName(value) {
    var s = String(value == null ? '' : value).trim();
    if (!s || s === '—') return '';
    return s.toUpperCase();
  }

  var FOCUS_MUSCLES = {
    push: ['chest', 'shoulders', 'triceps'],
    pull: ['back', 'biceps', 'rear delt'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    lower: ['quads', 'hamstrings', 'glutes', 'calves'],
    upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
    arms: ['biceps', 'triceps'],
    chest: ['chest', 'triceps'],
    back: ['back', 'biceps'],
    shoulders: ['shoulders', 'triceps'],
    full: ['chest', 'back', 'quads', 'shoulders'],
    'full body': ['chest', 'back', 'quads', 'shoulders'],
  };

  var mountEl = null;
  var libraryMountEl = null;
  var weekMountEl = null;
  var opts = {};
  var programName = '';
  var days = [];
  var dayPlans = [];
  var modalEl = null;
  var activeDayIndex = null;
  var editingSplitId = null;
  var isDirty = false;

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function defaultDays() {
    var WS = window.WorkoutSplit;
    if (WS && WS.blankDays) return WS.blankDays.slice();
    if (WS && WS.defaultDays) return WS.defaultDays.slice();
    return ['REST', 'REST', 'REST', 'REST', 'REST', 'REST', 'REST'];
  }

  function markDirty() {
    isDirty = true;
    var WS = window.WorkoutSplit;
    if (WS && editingSplitId && typeof WS.markTouched === 'function') {
      WS.markTouched(editingSplitId);
    }
    syncSetCurrentButton();
    notifyChange();
  }

  function discardUntouchedEditingSplit() {
    var WS = window.WorkoutSplit;
    if (!WS || !editingSplitId || isDirty) return false;
    if (typeof WS.discardUntouched !== 'function') return false;
    var id = editingSplitId;
    var discarded = WS.discardUntouched(id);
    if (discarded && editingSplitId === id) {
      editingSplitId = WS.getActiveSplitId ? WS.getActiveSplitId() : null;
    }
    return discarded;
  }

  function prepareLeaveEditingSplit() {
    var WS = window.WorkoutSplit;
    if (isDirty) {
      persistCurrentSplit(false);
      if (WS && editingSplitId && typeof WS.markTouched === 'function') {
        WS.markTouched(editingSplitId);
      }
      isDirty = false;
      return;
    }
    discardUntouchedEditingSplit();
  }

  function emptyDayPlans() {
    return [null, null, null, null, null, null, null];
  }

  function templateExercise(ex) {
    return {
      name: ex && ex.name != null ? String(ex.name).trim() : '',
      sets: ex && ex.sets != null ? String(ex.sets).trim() : '',
      reps: ex && ex.reps != null ? String(ex.reps).trim() : '',
      weight: '',
    };
  }

  function parseExerciseInput(name, sets, reps) {
    var n = (name || '').trim();
    if (!n) return null;
    return templateExercise({ name: n, sets: sets || '3', reps: reps || '8' });
  }

  function dayExercises(dayIndex) {
    var plan = dayPlans[dayIndex];
    if (!plan || !Array.isArray(plan.exercises)) return [];
    return plan.exercises.filter(function (ex) {
      return ex && ex.name;
    });
  }

  function notifyChange() {
    if (typeof opts.onChange === 'function') opts.onChange();
  }

  function syncProgramNameFromDom() {
    if (!weekMountEl) return;
    var nameInput = weekMountEl.querySelector('#split-editor-program-name');
    if (nameInput) programName = nameInput.value.trim();
  }

  function persistCurrentSplit(activate) {
    syncProgramNameFromDom();
    var WS = window.WorkoutSplit;
    if (!WS) return;
    var state = getState();
    if (typeof WS.saveById === 'function' && editingSplitId) {
      WS.saveById(editingSplitId, state, { activate: !!activate });
      return;
    }
    if (typeof WS.save === 'function') WS.save(state);
  }

  function isEditingCurrentSplit() {
    var WS = window.WorkoutSplit;
    if (!WS || typeof WS.getActiveSplitId !== 'function') return true;
    var currentId = WS.getActiveSplitId();
    if (!editingSplitId || !currentId) return true;
    return editingSplitId === currentId;
  }

  function syncSetCurrentButton() {
    var btn = document.getElementById('create-split-save-current');
    if (!btn) return;
    var isCurrent = isEditingCurrentSplit();
    btn.hidden = isCurrent;
    if (!isCurrent) {
      btn.textContent = isDirty ? 'Save & set to current' : 'Set to current';
    }
  }

  function musclesForFocus(label) {
    var key = String(label || '')
      .toLowerCase()
      .replace(/[^a-z\s+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || /^rest$/.test(key) || key === '—') return [];
    if (FOCUS_MUSCLES[key]) return FOCUS_MUSCLES[key].slice();
    var found = [];
    Object.keys(FOCUS_MUSCLES).forEach(function (k) {
      if (key.indexOf(k) !== -1) {
        FOCUS_MUSCLES[k].forEach(function (m) {
          if (found.indexOf(m) === -1) found.push(m);
        });
      }
    });
    return found;
  }

  function recommendExercises(focusLabel, limit) {
    var ED = window.ExerciseDatabase;
    if (!ED || !ED.catalog) return [];
    var muscles = musclesForFocus(focusLabel);
    var lim = limit || 12;
    var scored = [];
    ED.catalog.forEach(function (ex) {
      if (!ex || !ex.name) return;
      var inferred = '';
      if (typeof ED.inferPrimaryMuscles === 'function') {
        inferred = String(ED.inferPrimaryMuscles(ex.name) || '').toLowerCase();
      }
      var hay = (ex.name + ' ' + inferred + ' ' + (ex.category || '')).toLowerCase();
      var score = 0;
      muscles.forEach(function (m) {
        if (hay.indexOf(m) !== -1) score += 3;
      });
      if (!muscles.length && /press|squat|row|dead|pull|curl|fly/.test(hay)) score += 1;
      if (score > 0) scored.push({ name: ex.name, score: score });
    });
    scored.sort(function (a, b) {
      return b.score - a.score || a.name.localeCompare(b.name);
    });
    var out = [];
    var seen = {};
    scored.forEach(function (row) {
      if (seen[row.name] || out.length >= lim) return;
      seen[row.name] = true;
      out.push(row.name);
    });
    return out;
  }

  function exerciseOptionsHtml(selected, focusLabel) {
    var ED = window.ExerciseDatabase;
    var all = [];
    if (ED && Array.isArray(ED.catalog)) {
      ED.catalog.forEach(function (ex) {
        if (ex && ex.name) all.push(ex.name);
      });
    }
    all.sort(function (a, b) {
      return a.localeCompare(b);
    });
    var recommended = recommendExercises(focusLabel, 12);
    var recSet = {};
    recommended.forEach(function (n) {
      recSet[n] = true;
    });

    var html = '<option value="">Choose exercise…</option>';
    if (recommended.length) {
      html += '<optgroup label="Suggested for this day">';
      recommended.forEach(function (name) {
        html +=
          '<option value="' +
          escapeHtml(name) +
          '"' +
          (selected === name ? ' selected' : '') +
          '>' +
          escapeHtml(name) +
          '</option>';
      });
      html += '</optgroup>';
    }
    html += '<optgroup label="All exercises">';
    all.forEach(function (name) {
      if (recSet[name]) return;
      html +=
        '<option value="' +
        escapeHtml(name) +
        '"' +
        (selected === name ? ' selected' : '') +
        '>' +
        escapeHtml(name) +
        '</option>';
    });
    html += '</optgroup>';
    if (selected && all.indexOf(selected) === -1 && !recSet[selected]) {
      html +=
        '<option value="' +
        escapeHtml(selected) +
        '" selected>' +
        escapeHtml(selected) +
        '</option>';
    }
    return html;
  }

  function showEditorError(msg) {
    var el = document.getElementById('create-split-error');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function renderLibrary() {
    if (!libraryMountEl || !window.WorkoutSplitLibrary) return;
    window.WorkoutSplitLibrary.render(libraryMountEl, {
      compact: true,
      showAdd: true,
      showDuplicate: true,
      showDelete: true,
      selectedId: editingSplitId,
      onBeforeSelect: function () {
        prepareLeaveEditingSplit();
      },
      onSelect: function (id) {
        showEditorError('');
        loadSplitById(id);
        renderAll();
        if (typeof opts.onChange === 'function') opts.onChange();
      },
      onError: showEditorError,
    });
    syncSetCurrentButton();
  }

  function dayNeedsFill(dayIndex) {
    var label = toDayName(days[dayIndex]) || '—';
    if (/^REST$/i.test(label)) return false;
    return dayExercises(dayIndex).length === 0;
  }

  function renderWeek() {
    if (!weekMountEl) return;

    var html =
      '<section class="split-week-panel split-week-compact">' +
      '<div class="split-tree-toolbar">' +
      '<input type="text" id="split-editor-program-name" class="create-input split-editor-program-input" placeholder="Program name" autocomplete="off" aria-label="Program name" value="' +
      escapeHtml(programName) +
      '">' +
      '</div>' +
      '<div class="split-day-list" role="list" aria-label="Weekly split">';

    for (var i = 0; i < 7; i++) {
      var label = toDayName(days[i]) || '—';
      var isRest = /^REST$/i.test(label);
      var needsFill = dayNeedsFill(i);
      var main = label === '—' ? 'SET FOCUS' : label;
      html +=
        '<button type="button" class="split-day-row' +
        (isRest ? ' split-day-row--rest' : '') +
        (needsFill ? ' split-day-row--needs-fill' : '') +
        (activeDayIndex === i ? ' is-active' : '') +
        '" role="listitem" data-split-day="' +
        i +
        '">' +
        '<span class="split-day-row-letter">' +
        escapeHtml(DAY_LETTER[i]) +
        '</span>' +
        '<span class="split-day-row-name">' +
        escapeHtml(main) +
        '</span>' +
        (needsFill
          ? '<span class="split-day-row-dot" title="Not filled out yet" aria-label="Not filled out yet"></span>'
          : '<span class="split-day-row-dot-spacer" aria-hidden="true"></span>') +
        '<svg class="split-day-row-chevron" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><path d="M2 1.5L7.5 7 2 12.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>';
    }

    html += '</div></section>';
    weekMountEl.innerHTML = html;

    var nameInput = weekMountEl.querySelector('#split-editor-program-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        programName = nameInput.value.trim();
        markDirty();
      });
    }

    weekMountEl.querySelectorAll('[data-split-day]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(parseInt(btn.getAttribute('data-split-day'), 10));
      });
    });
  }

  function renderAll() {
    if (!mountEl) return;
    if (!libraryMountEl || !weekMountEl) {
      mountEl.innerHTML =
        '<div id="split-library-mount" class="split-library-mount split-library-mount--toolbar"></div>' +
        '<div id="split-week-mount" class="split-week-mount"></div>';
      libraryMountEl = mountEl.querySelector('#split-library-mount');
      weekMountEl = mountEl.querySelector('#split-week-mount');
    }
    renderLibrary();
    renderWeek();
  }

  function currentFocusLabel() {
    if (!modalEl) return '';
    var labelInput = modalEl.querySelector('#split-day-modal-label');
    return labelInput ? labelInput.value.trim() : '';
  }

  function exerciseRowHtml(ex, index, focusLabel) {
    ex = templateExercise(ex || {});
    var sets = ex.sets || '3';
    var reps = ex.reps || '8';
    return (
      '<div class="split-exercise-row" data-exercise-row="' +
      index +
      '">' +
      '<select class="create-input split-exercise-name" aria-label="Exercise">' +
      exerciseOptionsHtml(ex.name, focusLabel) +
      '</select>' +
      '<span class="split-exercise-rx" aria-label="Sets and reps">' +
      '<input type="number" min="1" max="20" class="create-input split-exercise-sets" value="' +
      escapeHtml(sets) +
      '" inputmode="numeric" aria-label="Sets">' +
      '<span class="split-exercise-times" aria-hidden="true">×</span>' +
      '<input type="text" class="create-input split-exercise-reps" value="' +
      escapeHtml(reps) +
      '" inputmode="numeric" aria-label="Reps">' +
      '</span>' +
      '<button type="button" class="split-exercise-remove" aria-label="Remove exercise">×</button>' +
      '</div>'
    );
  }

  function hasIncompleteRow(listEl) {
    if (!listEl) return false;
    var incomplete = false;
    listEl.querySelectorAll('.split-exercise-row').forEach(function (row) {
      var sel = row.querySelector('.split-exercise-name');
      if (sel && !sel.value) incomplete = true;
    });
    return incomplete;
  }

  function syncAddButton(modal) {
    var addBtn = modal.querySelector('#split-day-modal-add-exercise');
    var listEl = modal.querySelector('#split-day-modal-exercises');
    if (!addBtn || !listEl) return;
    var blocked = hasIncompleteRow(listEl);
    addBtn.disabled = blocked;
    addBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  }

  function bindExerciseRow(row, modal) {
    var remove = row.querySelector('.split-exercise-remove');
    if (remove) {
      remove.addEventListener('click', function () {
        row.remove();
        syncAddButton(modal);
      });
    }
    var sel = row.querySelector('.split-exercise-name');
    if (sel) {
      sel.addEventListener('change', function () {
        syncAddButton(modal);
      });
    }
  }

  function addExerciseRow(container, ex, modal) {
    if (hasIncompleteRow(container)) return;
    var index = container.querySelectorAll('.split-exercise-row').length;
    var wrap = document.createElement('div');
    wrap.innerHTML = exerciseRowHtml(ex || { name: '', sets: '3', reps: '8' }, index, currentFocusLabel());
    var row = wrap.firstElementChild;
    container.appendChild(row);
    bindExerciseRow(row, modal);
    syncAddButton(modal);
    var nameInput = row.querySelector('.split-exercise-name');
    if (nameInput) nameInput.focus();
  }

  function openModal(dayIndex) {
    if (dayIndex < 0 || dayIndex > 6) return;
    closeModal();
    activeDayIndex = dayIndex;
    renderWeek();

    var label = (days[dayIndex] || '').trim();
    var plan = dayPlans[dayIndex];
    var exercises = plan && Array.isArray(plan.exercises) ? plan.exercises : [];
    var focusForOptions = label === '—' ? '' : label;

    var rowsHtml = exercises.length
      ? exercises
          .map(function (ex, i) {
            return exerciseRowHtml(ex, i, focusForOptions);
          })
          .join('')
      : '';

    var presetHtml = FOCUS_PRESETS.map(function (p) {
      return (
        '<button type="button" class="split-focus-chip' +
        (label.toLowerCase() === p.toLowerCase() ? ' is-active' : '') +
        '" data-focus="' +
        escapeHtml(p) +
        '">' +
        escapeHtml(p) +
        '</button>'
      );
    }).join('');

    modalEl = document.createElement('div');
    modalEl.innerHTML =
      '<div class="sport-modal-backdrop split-day-backdrop" id="split-day-modal-backdrop">' +
      '<div class="sport-modal split-day-modal" role="dialog" aria-modal="true" aria-labelledby="split-day-modal-title">' +
      '<header class="sport-modal-header split-day-modal-header">' +
      '<div>' +
      '<p class="split-day-modal-kicker">' +
      escapeHtml(DAY_NAMES[dayIndex]) +
      '</p>' +
      '<h2 id="split-day-modal-title">Edit day</h2>' +
      '</div>' +
      '<button type="button" class="sport-modal-close" id="split-day-modal-close" aria-label="Close">×</button>' +
      '</header>' +
      '<div class="sport-modal-body split-day-modal-body">' +
      '<label class="sport-modal-label" for="split-day-modal-label">Day name</label>' +
      '<input type="text" id="split-day-modal-label" class="buddy-field customize-input split-day-name-input" maxlength="80" placeholder="e.g. PUSH, PULL, REST" list="split-focus-datalist" autocomplete="off" autocapitalize="characters" value="' +
      escapeHtml(label === '—' ? '' : toDayName(label)) +
      '">' +
      '<datalist id="split-focus-datalist">' +
      FOCUS_PRESETS.map(function (p) {
        return '<option value="' + escapeHtml(p) + '"></option>';
      }).join('') +
      '</datalist>' +
      '<div class="split-focus-chips" role="group" aria-label="Quick focuses">' +
      presetHtml +
      '</div>' +
      '<div class="split-exercise-list" id="split-day-modal-exercises">' +
      rowsHtml +
      '</div>' +
      '<button type="button" class="split-exercise-add" id="split-day-modal-add-exercise">+ Add exercise</button>' +
      '</div>' +
      '<footer class="sport-modal-footer split-day-modal-footer">' +
      '<button type="button" class="split-day-cancel" id="split-day-modal-cancel">Cancel</button>' +
      '<button type="button" class="customize-save-btn sport-modal-save" id="split-day-modal-save">Save day</button>' +
      '</footer></div></div>';

    document.body.appendChild(modalEl);
    document.body.style.overflow = 'hidden';

    var listEl = modalEl.querySelector('#split-day-modal-exercises');
    listEl.querySelectorAll('.split-exercise-row').forEach(function (row) {
      bindExerciseRow(row, modalEl);
    });
    syncAddButton(modalEl);

    var labelInput = modalEl.querySelector('#split-day-modal-label');

    function refreshSelectOptions() {
      var focus = labelInput.value.trim();
      listEl.querySelectorAll('.split-exercise-row').forEach(function (row) {
        var sel = row.querySelector('.split-exercise-name');
        if (!sel) return;
        var current = sel.value;
        sel.innerHTML = exerciseOptionsHtml(current, focus);
        sel.value = current;
      });
    }

    labelInput.addEventListener('change', refreshSelectOptions);
    labelInput.addEventListener('input', function () {
      var start = labelInput.selectionStart;
      var end = labelInput.selectionEnd;
      var next = toDayName(labelInput.value);
      if (labelInput.value !== next) {
        labelInput.value = next;
        try {
          labelInput.setSelectionRange(start, end);
        } catch (eSel) {}
      }
      modalEl.querySelectorAll('.split-focus-chip').forEach(function (chip) {
        chip.classList.toggle(
          'is-active',
          chip.getAttribute('data-focus').toLowerCase() === labelInput.value.trim().toLowerCase()
        );
      });
    });

    modalEl.querySelectorAll('.split-focus-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        labelInput.value = toDayName(chip.getAttribute('data-focus') || '');
        modalEl.querySelectorAll('.split-focus-chip').forEach(function (c) {
          c.classList.toggle('is-active', c === chip);
        });
        refreshSelectOptions();
      });
    });

    modalEl.querySelector('#split-day-modal-add-exercise').addEventListener('click', function () {
      addExerciseRow(listEl, { name: '', sets: '3', reps: '8' }, modalEl);
    });

    function closeAndRestore() {
      closeModal();
      activeDayIndex = null;
      renderWeek();
    }

    modalEl.querySelector('#split-day-modal-close').addEventListener('click', closeAndRestore);
    modalEl.querySelector('#split-day-modal-cancel').addEventListener('click', closeAndRestore);
    modalEl.querySelector('#split-day-modal-backdrop').addEventListener('click', function (e) {
      if (e.target.id === 'split-day-modal-backdrop') closeAndRestore();
    });

    modalEl.querySelector('#split-day-modal-save').addEventListener('click', function () {
      saveModalDay(dayIndex);
      closeAndRestore();
    });
  }

  function saveModalDay(dayIndex) {
    if (!modalEl) return;
    var labelInput = modalEl.querySelector('#split-day-modal-label');
    var label = labelInput ? toDayName(labelInput.value) : '';
    days[dayIndex] = label || '—';

    var listEl = modalEl.querySelector('#split-day-modal-exercises');
    var exercises = [];
    listEl.querySelectorAll('.split-exercise-row').forEach(function (row) {
      var nameEl = row.querySelector('.split-exercise-name');
      var parsed = parseExerciseInput(
        nameEl.value,
        row.querySelector('.split-exercise-sets').value,
        row.querySelector('.split-exercise-reps').value
      );
      if (parsed) exercises.push(parsed);
    });

    dayPlans[dayIndex] = exercises.length ? { exercises: exercises } : null;

    persistCurrentSplit(false);
    isDirty = true;
    syncSetCurrentButton();
    notifyChange();
  }

  function closeModal() {
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    document.body.style.overflow = '';
  }

  function getState() {
    syncProgramNameFromDom();
    return {
      programName: programName,
      days: days.slice(),
      dayPlans: dayPlans.map(function (p) {
        if (!p || !Array.isArray(p.exercises)) return null;
        return {
          exercises: p.exercises.map(function (ex) {
            return templateExercise(ex);
          }),
        };
      }),
    };
  }

  function applyLoadedState(state) {
    programName = (state && state.programName) || '';
    days =
      state && Array.isArray(state.days) && state.days.length === 7
        ? state.days.map(function (d) {
            return toDayName(d) || '—';
          })
        : defaultDays();
    dayPlans =
      state && Array.isArray(state.dayPlans) && state.dayPlans.length === 7
        ? state.dayPlans.map(function (p) {
            if (!p || !Array.isArray(p.exercises)) return null;
            return {
              exercises: p.exercises.map(function (ex) {
                return templateExercise(ex);
              }),
            };
          })
        : emptyDayPlans();
    isDirty = false;
  }

  function loadSplitById(id) {
    var WS = window.WorkoutSplit;
    if (!WS) {
      editingSplitId = null;
      programName = '';
      days = defaultDays();
      dayPlans = emptyDayPlans();
      isDirty = false;
      return;
    }
    var state = null;
    if (id && typeof WS.loadById === 'function') state = WS.loadById(id);
    if (!state && typeof WS.load === 'function') state = WS.load();
    editingSplitId = (state && state.id) || id || (WS.getActiveSplitId && WS.getActiveSplitId()) || null;
    applyLoadedState(state);
  }

  function loadActiveSplit() {
    var WS = window.WorkoutSplit;
    var id =
      editingSplitId ||
      (WS && typeof WS.getActiveSplitId === 'function' ? WS.getActiveSplitId() : null);
    loadSplitById(id);
  }

  function shareActiveSplit() {
    persistCurrentSplit(false);
    var WS = window.WorkoutSplit;
    if (!WS) return Promise.reject(new Error('Share unavailable'));
    var state = getState();
    var text = typeof WS.formatShareText === 'function' ? WS.formatShareText(state) : '';
    var url = typeof WS.buildShareUrl === 'function' ? WS.buildShareUrl(state) : '';
    if (navigator.share) {
      return navigator
        .share({
          title: state.programName || 'Weekly split',
          text: text,
          url: url || undefined,
        })
        .then(function () {
          return { method: 'share', url: url };
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return { method: 'cancelled', url: url };
          return copyShareFallback(text || url).then(function () {
            return { method: 'clipboard', url: url };
          });
        });
    }
    return copyShareFallback(text || url).then(function () {
      return { method: 'clipboard', url: url };
    });
  }

  function copyShareFallback(text) {
    if (!text) return Promise.reject(new Error('Nothing to share'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        if (!document.execCommand('copy')) throw new Error('copy failed');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function mount(el, options) {
    mountEl = el;
    opts = options || {};
    libraryMountEl = null;
    weekMountEl = null;
    editingSplitId = null;
    loadActiveSplit();
    renderAll();
  }

  function loadActiveSplitPublic() {
    loadActiveSplit();
    if (mountEl) renderAll();
    else syncSetCurrentButton();
  }

  function saveActiveSplit(optsSave) {
    optsSave = optsSave || {};
    persistCurrentSplit(!!optsSave.activate);
    var WS = window.WorkoutSplit;
    if (WS && editingSplitId && typeof WS.markTouched === 'function') {
      WS.markTouched(editingSplitId);
    }
    isDirty = false;
    renderLibrary();
    renderWeek();
    syncSetCurrentButton();
  }

  function leaveEditor() {
    prepareLeaveEditingSplit();
    if (mountEl) {
      loadActiveSplit();
      renderAll();
    }
  }

  function saveAndSetCurrent() {
    saveActiveSplit({ activate: true });
  }

  function setToCurrent() {
    var WS = window.WorkoutSplit;
    if (isDirty) {
      saveAndSetCurrent();
      return;
    }
    if (WS && editingSplitId && typeof WS.setActiveSplit === 'function') {
      WS.setActiveSplit(editingSplitId);
    }
    isDirty = false;
    renderLibrary();
    syncSetCurrentButton();
  }

  window.WorkoutSplitEditor = {
    mount: mount,
    loadActiveSplit: loadActiveSplitPublic,
    renderLibrary: function () {
      renderLibrary();
    },
    saveActiveSplit: saveActiveSplit,
    saveAndSetCurrent: saveAndSetCurrent,
    setToCurrent: setToCurrent,
    leaveEditor: leaveEditor,
    isEditingCurrentSplit: isEditingCurrentSplit,
    syncSetCurrentButton: syncSetCurrentButton,
    getEditingSplitId: function () {
      return editingSplitId;
    },
    shareActiveSplit: shareActiveSplit,
    getState: getState,
  };
})();
