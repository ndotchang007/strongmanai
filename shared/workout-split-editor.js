(function () {
  'use strict';

  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var mountEl = null;
  var libraryMountEl = null;
  var weekMountEl = null;
  var opts = {};
  var programName = '';
  var days = [];
  var dayPlans = [];
  var modalEl = null;

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function defaultDays() {
    var WS = window.WorkoutSplit;
    return WS && WS.defaultDays ? WS.defaultDays.slice() : ['PUSH', 'PULL', 'LEGS', 'REST', 'ARMS', 'CHEST + BACK', 'REST'];
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
    return templateExercise({ name: n, sets: sets, reps: reps });
  }

  function formatDayPreview(dayIndex) {
    var label = (days[dayIndex] || '').trim();
    if (/^rest$/i.test(label)) return 'Rest day — no lifts planned';
    var plan = dayPlans[dayIndex];
    var exercises = plan && Array.isArray(plan.exercises) ? plan.exercises : [];
    if (!exercises.length) return 'Tap to add exercises';
    var names = exercises
      .filter(function (ex) {
        return ex && ex.name;
      })
      .slice(0, 4)
      .map(function (ex) {
        return ex.name;
      });
    var extra = exercises.length - names.length;
    var text = names.join(' · ');
    if (extra > 0) text += ' · +' + extra + ' more';
    return text || 'Tap to add exercises';
  }

  function exerciseCount(dayIndex) {
    var plan = dayPlans[dayIndex];
    if (!plan || !Array.isArray(plan.exercises)) return 0;
    return plan.exercises.filter(function (ex) {
      return ex && ex.name;
    }).length;
  }

  function notifyChange() {
    if (typeof opts.onChange === 'function') opts.onChange();
  }

  function syncProgramNameFromDom() {
    if (!weekMountEl) return;
    var nameInput = weekMountEl.querySelector('#split-editor-program-name');
    if (nameInput) programName = nameInput.value.trim();
  }

  function persistCurrentSplit() {
    syncProgramNameFromDom();
    var WS = window.WorkoutSplit;
    if (!WS || typeof WS.save !== 'function') return;
    WS.save(getState());
  }

  function renderLibrary() {
    if (!libraryMountEl || !window.WorkoutSplitLibrary) return;
    window.WorkoutSplitLibrary.render(libraryMountEl, {
      showAdd: opts.manageLibrary !== false,
      showDuplicate: opts.manageLibrary !== false,
      showDelete: opts.manageLibrary !== false,
      onBeforeSelect: persistCurrentSplit,
      onSelect: function () {
        loadActiveSplit();
        notifyChange();
      },
    });
  }

  function renderWeek() {
    if (!weekMountEl) return;

    var html =
      '<div class="create-field split-editor-program">' +
      '<label for="split-editor-program-name">Program name <span class="create-optional">(optional)</span></label>' +
      '<input type="text" id="split-editor-program-name" class="create-input" placeholder="e.g. Upper / Lower / Events" autocomplete="off" value="' +
      escapeHtml(programName) +
      '">' +
      '</div>' +
      '<div class="sports-editor-header split-week-header">' +
      '<div><h2 class="sports-editor-title">Your week</h2>' +
      '<p class="sports-editor-lede">Tap a day to name it and add exercises. Weights are filled when you start a workout — Rocky suggests loads from your history.</p></div>' +
      '</div>' +
      '<div class="sports-editor-grid split-editor-grid" role="list">';

    for (var i = 0; i < 7; i++) {
      var label = (days[i] || '').trim() || '—';
      var isRest = /^rest$/i.test(label);
      var count = exerciseCount(i);
      html +=
        '<button type="button" class="sport-card split-day-card' +
        (isRest ? ' split-day-card--rest' : '') +
        '" role="listitem" data-split-day="' +
        i +
        '">' +
        '<span class="sport-card-badge">' +
        escapeHtml(DAY_SHORT[i]) +
        '</span>' +
        '<span class="sport-card-name">' +
        escapeHtml(label) +
        '</span>' +
        '<span class="sport-card-meta">' +
        (count ? count + ' exercise' + (count === 1 ? '' : 's') : isRest ? 'Rest' : 'No exercises yet') +
        '</span>' +
        '<span class="sport-card-schedule">' +
        escapeHtml(formatDayPreview(i)) +
        '</span>' +
        '<span class="sport-card-edit">Edit day →</span></button>';
    }

    html += '</div>';
    weekMountEl.innerHTML = html;

    var nameInput = weekMountEl.querySelector('#split-editor-program-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        programName = nameInput.value.trim();
        notifyChange();
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
        '<div id="split-library-mount" class="split-library-mount"></div>' +
        '<div id="split-week-mount" class="split-week-mount"></div>';
      libraryMountEl = mountEl.querySelector('#split-library-mount');
      weekMountEl = mountEl.querySelector('#split-week-mount');
    }
    renderLibrary();
    renderWeek();
  }

  function exerciseRowHtml(ex, index) {
    ex = templateExercise(ex || {});
    return (
      '<div class="split-exercise-row" data-exercise-row="' +
      index +
      '">' +
      '<input type="text" class="create-input split-exercise-name" value="' +
      escapeHtml(ex.name) +
      '" placeholder="Exercise name" list="' +
      escapeHtml(opts.exerciseDatalistId || 'create-exercise-datalist') +
      '" aria-label="Exercise name">' +
      '<div class="split-exercise-prescription">' +
      '<input type="text" class="create-input split-exercise-sets" value="' +
      escapeHtml(ex.sets) +
      '" placeholder="4" inputmode="numeric" aria-label="Sets">' +
      '<span class="split-exercise-times" aria-hidden="true">×</span>' +
      '<input type="text" class="create-input split-exercise-reps" value="' +
      escapeHtml(ex.reps) +
      '" placeholder="8" inputmode="numeric" aria-label="Reps">' +
      '</div>' +
      '<button type="button" class="split-exercise-remove" aria-label="Remove exercise">×</button>' +
      '</div>'
    );
  }

  function addExerciseRow(container, ex) {
    var index = container.querySelectorAll('.split-exercise-row').length;
    var wrap = document.createElement('div');
    wrap.innerHTML = exerciseRowHtml(ex, index);
    var row = wrap.firstElementChild;
    container.appendChild(row);
    row.querySelector('.split-exercise-remove').addEventListener('click', function () {
      row.remove();
      if (!container.querySelector('.split-exercise-row')) addExerciseRow(container);
    });
    var nameInput = row.querySelector('.split-exercise-name');
    if (nameInput) nameInput.focus();
  }

  function openModal(dayIndex) {
    if (dayIndex < 0 || dayIndex > 6) return;
    closeModal();
    var label = (days[dayIndex] || '').trim();
    var plan = dayPlans[dayIndex];
    var exercises = plan && Array.isArray(plan.exercises) ? plan.exercises : [];

    var rowsHtml = exercises.length
      ? exercises.map(function (ex, i) {
          return exerciseRowHtml(ex, i);
        }).join('')
      : exerciseRowHtml(null, 0);

    modalEl = document.createElement('div');
    modalEl.innerHTML =
      '<div class="sport-modal-backdrop" id="split-day-modal-backdrop">' +
      '<div class="sport-modal split-day-modal" role="dialog" aria-modal="true" aria-labelledby="split-day-modal-title">' +
      '<header class="sport-modal-header">' +
      '<h2 id="split-day-modal-title">' +
      escapeHtml(DAY_NAMES[dayIndex]) +
      '</h2>' +
      '<button type="button" class="sport-modal-close" id="split-day-modal-close" aria-label="Close">×</button>' +
      '</header>' +
      '<div class="sport-modal-body">' +
      '<label class="sport-modal-label" for="split-day-modal-label">Day focus</label>' +
      '<input type="text" id="split-day-modal-label" class="buddy-field customize-input" maxlength="80" placeholder="e.g. Push, Pull, Rest" value="' +
      escapeHtml(label === '—' ? '' : label) +
      '">' +
      '<p class="split-day-modal-hint">Exercises only — no weights. Rocky suggests loads when you start a workout.</p>' +
      '<label class="sport-modal-label">Exercises</label>' +
      '<div class="split-exercise-list" id="split-day-modal-exercises">' +
      rowsHtml +
      '</div>' +
      '<button type="button" class="split-exercise-add" id="split-day-modal-add-exercise">+ Add exercise</button>' +
      '</div>' +
      '<footer class="sport-modal-footer">' +
      '<button type="button" class="customize-save-btn sport-modal-save" id="split-day-modal-save">Save day</button>' +
      '</footer></div></div>';

    document.body.appendChild(modalEl);
    document.body.style.overflow = 'hidden';

    var listEl = modalEl.querySelector('#split-day-modal-exercises');
    listEl.querySelectorAll('.split-exercise-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.split-exercise-row');
        if (row) row.remove();
        if (!listEl.querySelector('.split-exercise-row')) addExerciseRow(listEl);
      });
    });

    modalEl.querySelector('#split-day-modal-add-exercise').addEventListener('click', function () {
      addExerciseRow(listEl);
    });

    function closeAndRestore() {
      closeModal();
    }

    modalEl.querySelector('#split-day-modal-close').addEventListener('click', closeAndRestore);
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
    var label = labelInput && labelInput.value ? labelInput.value.trim() : '';
    days[dayIndex] = label || '—';

    var exercises = [];
    modalEl.querySelectorAll('.split-exercise-row').forEach(function (row) {
      var name = row.querySelector('.split-exercise-name');
      var sets = row.querySelector('.split-exercise-sets');
      var reps = row.querySelector('.split-exercise-reps');
      var ex = parseExerciseInput(name && name.value, sets && sets.value, reps && reps.value);
      if (ex) exercises.push(ex);
    });

    if (/^rest$/i.test(label) || !exercises.length) {
      dayPlans[dayIndex] = exercises.length
        ? { title: label || DAY_NAMES[dayIndex], exercises: exercises }
        : /^rest$/i.test(label)
          ? { title: 'Rest', exercises: [] }
          : null;
    } else {
      dayPlans[dayIndex] = {
        title: label || DAY_NAMES[dayIndex],
        exercises: exercises,
      };
    }

    if (label && !/^rest$/i.test(label)) days[dayIndex] = label;
    renderWeek();
    renderLibrary();
    notifyChange();
  }

  function closeModal() {
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    document.body.style.overflow = '';
  }

  function loadState(state) {
    state = state || {};
    programName = state.programName != null ? String(state.programName) : '';
    days = Array.isArray(state.days) ? state.days.slice() : defaultDays();
    dayPlans = Array.isArray(state.dayPlans) ? state.dayPlans.slice() : emptyDayPlans();
    for (var i = 0; i < 7; i++) {
      if (!days[i]) days[i] = '—';
      if (dayPlans[i] && dayPlans[i].exercises) {
        dayPlans[i] = {
          title: dayPlans[i].title || days[i] || '',
          exercises: dayPlans[i].exercises.map(templateExercise),
        };
      }
    }
    renderAll();
  }

  function getState() {
    syncProgramNameFromDom();
    return {
      programName: programName,
      days: days.slice(),
      dayPlans: dayPlans.map(function (p) {
        if (!p) return null;
        return {
          title: p.title || '',
          exercises: (p.exercises || []).map(templateExercise),
        };
      }),
    };
  }

  function loadActiveSplit() {
    var WS = window.WorkoutSplit;
    if (!WS || typeof WS.load !== 'function') {
      loadState({ days: defaultDays(), dayPlans: emptyDayPlans() });
      return;
    }
    var state = WS.load();
    programName = state.programName || '';
    days = state.days.slice();
    dayPlans = state.dayPlans.map(function (p) {
      if (!p) return null;
      return {
        title: p.title,
        exercises: (p.exercises || []).map(templateExercise),
      };
    });
    for (var i = 0; i < 7; i++) {
      if (!days[i]) days[i] = '—';
    }
    renderAll();
  }

  function saveActiveSplit() {
    syncProgramNameFromDom();
    var WS = window.WorkoutSplit;
    if (!WS || typeof WS.save !== 'function') return false;
    WS.save(getState());
    renderLibrary();
    notifyChange();
    return true;
  }

  function mount(element, options) {
    mountEl = element;
    libraryMountEl = null;
    weekMountEl = null;
    opts = options || {};
    loadActiveSplit();
  }

  window.WorkoutSplitEditor = {
    mount: mount,
    loadActiveSplit: loadActiveSplit,
    saveActiveSplit: saveActiveSplit,
    getState: getState,
    loadState: loadState,
    render: renderAll,
    renderLibrary: renderLibrary,
    closeModal: closeModal,
    templateExercise: templateExercise,
  };
})();
