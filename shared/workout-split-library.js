(function () {
  'use strict';

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function summarizeSplit(split) {
    if (!split) return '';
    var days = split.days || [];
    var training = 0;
    for (var i = 0; i < days.length; i++) {
      var lbl = (days[i] || '').trim();
      if (lbl && !/^rest$/i.test(lbl)) training += 1;
    }
    return training + ' training day' + (training === 1 ? '' : 's');
  }

  function buildCardHtml() {
    return '';
  }

  var PLUS_ICON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var COPY_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V7a2 2 0 0 1 2-2h8"/></svg>';
  var TRASH_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';

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
    var currentId = WS.getActiveSplitId ? WS.getActiveSplitId() : null;
    var selectedId = options.selectedId || currentId;

    var html =
      '<div class="split-library-toolbar">' +
      '<label class="visually-hidden" for="split-library-select">Saved split</label>' +
      '<select id="split-library-select" class="create-input split-library-select" aria-label="Saved split">';

    if (!splits.length) {
      html += '<option value="">No splits yet</option>';
    } else {
      var selectedExists = splits.some(function (s) {
        return s.id === selectedId;
      });
      if (!selectedExists) selectedId = currentId || (splits[0] && splits[0].id);
      splits.forEach(function (split) {
        var label = split.programName || split.name || 'Untitled';
        if (split.id === currentId) label += ' (current)';
        html +=
          '<option value="' +
          escapeHtml(split.id) +
          '"' +
          (split.id === selectedId ? ' selected' : '') +
          '>' +
          escapeHtml(label) +
          '</option>';
      });
    }

    html +=
      '</select>' +
      '<div class="split-library-actions">' +
      '<button type="button" class="split-library-icon-btn" id="split-library-new-btn" title="New split" aria-label="New split">' +
      PLUS_ICON +
      '</button>' +
      '<button type="button" class="split-library-icon-btn split-library-icon-btn--dup" id="split-library-dup-btn" title="Duplicate split" aria-label="Duplicate split">' +
      COPY_ICON +
      '</button>' +
      '<button type="button" class="split-library-icon-btn split-library-icon-btn--danger" id="split-library-del-btn" title="Delete split" aria-label="Delete split">' +
      TRASH_ICON +
      '</button>' +
      '</div></div>' +
      '<p class="split-library-error" id="split-library-error" role="alert" hidden></p>' +
      '<div class="split-library-panel split-library-panel--danger" id="split-library-del-panel" hidden>' +
      '<p class="split-library-panel-copy">Delete this split? You need at least one saved.</p>' +
      '<div class="split-library-panel-row">' +
      '<button type="button" class="split-library-panel-btn" id="split-library-del-cancel">Cancel</button>' +
      '<button type="button" class="split-library-panel-btn split-library-panel-btn--danger" id="split-library-del-confirm">Delete</button>' +
      '</div></div>';

    container.innerHTML = html;

    var errorEl = container.querySelector('#split-library-error');
    var delPanel = container.querySelector('#split-library-del-panel');

    function showError(msg) {
      if (errorEl) {
        errorEl.textContent = msg || '';
        errorEl.hidden = !msg;
      }
      if (typeof options.onError === 'function') options.onError(msg || '');
    }

    function hidePanels() {
      if (delPanel) delPanel.hidden = true;
    }

    var select = container.querySelector('#split-library-select');
    if (select) {
      select.addEventListener('change', function () {
        var id = select.value;
        if (!id) return;
        showError('');
        hidePanels();
        if (typeof options.onBeforeSelect === 'function') options.onBeforeSelect();
        if (typeof options.onSelect === 'function') options.onSelect(id);
      });
    }

    var newBtn = container.querySelector('#split-library-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        showError('');
        hidePanels();
        if (typeof options.onBeforeSelect === 'function') options.onBeforeSelect();
        var newId = WS.createSplit('My Split', null, { activate: false, untouched: true });
        if (typeof options.onSelect === 'function') options.onSelect(newId || WS.getActiveSplitId());
      });
    }

    var dupBtn = container.querySelector('#split-library-dup-btn');
    if (dupBtn) {
      dupBtn.addEventListener('click', function () {
        var id = selectedId || WS.getActiveSplitId();
        if (!id) return;
        showError('');
        hidePanels();
        if (typeof options.onBeforeSelect === 'function') options.onBeforeSelect();
        var copyId = WS.duplicateSplit(id);
        if (typeof options.onSelect === 'function') options.onSelect(copyId || WS.getActiveSplitId());
      });
    }

    var delBtn = container.querySelector('#split-library-del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        var id = selectedId || WS.getActiveSplitId();
        if (!id) return;
        showError('');
        if (delPanel) delPanel.hidden = false;
      });
    }

    var delCancel = container.querySelector('#split-library-del-cancel');
    if (delCancel) {
      delCancel.addEventListener('click', function () {
        if (delPanel) delPanel.hidden = true;
      });
    }

    var delConfirm = container.querySelector('#split-library-del-confirm');
    if (delConfirm) {
      delConfirm.addEventListener('click', function () {
        var id = selectedId || WS.getActiveSplitId();
        if (!id) return;
        if (!WS.deleteSplit(id)) {
          showError('Keep at least one split.');
          if (delPanel) delPanel.hidden = true;
          return;
        }
        showError('');
        if (typeof options.onSelect === 'function') options.onSelect(WS.getActiveSplitId());
      });
    }
  }

  window.WorkoutSplitLibrary = {
    render: renderGrid,
    summarize: summarizeSplit,
    buildCardHtml: buildCardHtml,
  };
})();
