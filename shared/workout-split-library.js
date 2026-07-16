(function () {
  'use strict';

  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function summarizeSplit(split) {
    if (!split) return { trainingDays: 0, exerciseCount: 0, preview: 'Tap to customize' };
    var days = split.days || [];
    var plans = split.dayPlans || [];
    var trainingDays = 0;
    var exerciseCount = 0;
    var parts = [];

    for (var i = 0; i < 7; i++) {
      var label = (days[i] || '').trim();
      if (!label || label === '—') continue;
      if (/^rest$/i.test(label)) continue;
      var plan = plans[i];
      var exCount =
        plan && Array.isArray(plan.exercises)
          ? plan.exercises.filter(function (ex) {
              return ex && ex.name;
            }).length
          : 0;
      if (exCount || (label && !/^rest$/i.test(label))) trainingDays += 1;
      exerciseCount += exCount;
      if (parts.length < 4) parts.push(DAY_SHORT[i] + ' ' + label);
    }

    var preview = parts.length ? parts.join(' · ') : 'No days set yet';
    if (parts.length < trainingDays && trainingDays > parts.length) preview += ' · …';

    return {
      trainingDays: trainingDays,
      exerciseCount: exerciseCount,
      preview: preview,
    };
  }

  function cardTagHtml(isActive, isNew) {
    if (isActive) {
      return '<span class="split-library-card-tag">Currently selected</span>';
    }
    if (isNew) {
      return '<span class="split-library-card-tag">New</span>';
    }
    return '';
  }

  function cardClassName(isActive, isNew) {
    var cls = 'sport-card split-library-card';
    if (isActive || isNew) cls += ' split-library-card--highlight';
    if (isActive) cls += ' split-library-card--active';
    if (isNew && !isActive) cls += ' split-library-card--new';
    return cls;
  }

  function buildCardHtml(split, activeId, unseenIds) {
    var isActive = split.id === activeId;
    var isNew = unseenIds.indexOf(split.id) >= 0;
    var summary = summarizeSplit(split);
    var sourceLabel = split.source === 'ai' ? 'Rocky' : 'Yours';
    var meta =
      summary.trainingDays +
      ' training day' +
      (summary.trainingDays === 1 ? '' : 's') +
      (summary.exerciseCount ? ' · ' + summary.exerciseCount + ' lifts' : '');

    return (
      '<button type="button" class="' +
      cardClassName(isActive, isNew) +
      '" role="listitem" data-split-id="' +
      escapeHtml(split.id) +
      '" aria-pressed="' +
      (isActive ? 'true' : 'false') +
      '">' +
      '<span class="split-library-card-accent" aria-hidden="true"></span>' +
      '<span class="split-library-card-top">' +
      '<span class="sport-card-badge">' +
      escapeHtml(sourceLabel) +
      '</span>' +
      cardTagHtml(isActive, isNew) +
      '</span>' +
      '<span class="sport-card-name">' +
      escapeHtml(split.programName || 'Untitled split') +
      '</span>' +
      '<span class="sport-card-meta">' +
      escapeHtml(meta) +
      '</span>' +
      '<span class="sport-card-schedule">' +
      escapeHtml(summary.preview) +
      '</span>' +
      '<span class="sport-card-edit">' +
      (isActive ? 'Editing below' : 'Select') +
      '</span></button>'
    );
  }

  function renderGrid(container, options) {
    options = options || {};
    if (!container) return;
    var WS = window.WorkoutSplit;
    if (!WS) {
      container.innerHTML = '';
      return;
    }

    var lib = WS.loadLibrary ? WS.loadLibrary() : null;
    var splits = lib && lib.splits ? lib.splits : [];
    var activeId = WS.getActiveSplitId ? WS.getActiveSplitId() : null;
    var unseen = lib && lib.unseenSplitIds ? lib.unseenSplitIds : [];
    var compact = !!options.compact;
    var showAdd = options.showAdd !== false && !compact;

    var html = '';
    if (showAdd) {
      html +=
        '<div class="sports-editor-header split-library-header">' +
        '<div><h2 class="sports-editor-title">Saved splits</h2>' +
        '<p class="sports-editor-lede">Pick one to edit the week. Duplicate or add a fresh program anytime.</p></div>' +
        '<div class="split-library-actions">' +
        (options.showDuplicate !== false
          ? '<button type="button" class="split-library-action-btn" id="split-library-dup-btn">Duplicate</button>'
          : '') +
        (options.showDelete !== false
          ? '<button type="button" class="split-library-action-btn split-library-action-btn--danger" id="split-library-del-btn">Delete</button>'
          : '') +
        '<button type="button" class="sports-editor-add" id="split-library-new-btn">+ New split</button>' +
        '</div></div>';
    }

    html +=
      '<div class="sports-editor-grid split-library-grid' +
      (compact ? ' split-library-grid--compact' : '') +
      '" role="list">';

    if (!splits.length) {
      html +=
        '<button type="button" class="sport-card sport-card--empty split-library-card--empty" id="split-library-add-first">' +
        '<span class="sport-card-plus">+</span><span>Add your first split</span></button>';
    } else {
      splits.forEach(function (split) {
        html += buildCardHtml(split, activeId, unseen);
      });
    }

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('[data-split-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-split-id');
        if (!id) return;
        if (typeof options.onBeforeSelect === 'function') options.onBeforeSelect();
        if (WS.setActiveSplit) WS.setActiveSplit(id);
        if (typeof options.onSelect === 'function') options.onSelect(id);
        renderGrid(container, options);
      });
    });

    var newBtn = container.querySelector('#split-library-new-btn');
    var addFirst = container.querySelector('#split-library-add-first');
    function addSplit() {
      var name = window.prompt('Name for your new split:', 'My split');
      if (name == null) return;
      if (typeof options.onBeforeSelect === 'function') options.onBeforeSelect();
      WS.createSplit(name.trim() || 'My split');
      if (typeof options.onSelect === 'function') options.onSelect(WS.getActiveSplitId());
      renderGrid(container, options);
    }
    if (newBtn) newBtn.addEventListener('click', addSplit);
    if (addFirst) addFirst.addEventListener('click', addSplit);

    var dupBtn = container.querySelector('#split-library-dup-btn');
    if (dupBtn) {
      dupBtn.addEventListener('click', function () {
        var id = WS.getActiveSplitId();
        if (!id) return;
        if (typeof options.onBeforeSelect === 'function') options.onBeforeSelect();
        WS.duplicateSplit(id);
        if (typeof options.onSelect === 'function') options.onSelect(WS.getActiveSplitId());
        renderGrid(container, options);
      });
    }

    var delBtn = container.querySelector('#split-library-del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        var id = WS.getActiveSplitId();
        if (!id) return;
        if (!window.confirm('Delete this split? You need at least one split saved.')) return;
        if (!WS.deleteSplit(id)) {
          window.alert('Keep at least one split.');
          return;
        }
        if (typeof options.onSelect === 'function') options.onSelect(WS.getActiveSplitId());
        renderGrid(container, options);
      });
    }
  }

  window.WorkoutSplitLibrary = {
    render: renderGrid,
    summarize: summarizeSplit,
    buildCardHtml: buildCardHtml,
  };
})();
