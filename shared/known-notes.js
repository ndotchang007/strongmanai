(function () {
  var FIELD_MAP = {
    'Small goals': 'smallGoals',
    'Big goals': 'bigGoals',
    Discomforts: 'discomforts',
    'Equipment access': 'machines',
    'Favorite exercises': 'favoriteExercises',
    'Least favorite exercises': 'leastFavoriteExercises',
    'Reason for trying Strongman AI': 'tryReason',
  };

  function escapeHtml(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function parseToInitData(knownNotes) {
    var data = {};
    if (!knownNotes) return data;
    String(knownNotes)
      .split('\n')
      .forEach(function (line) {
        var trimmed = line.trim();
        if (!trimmed) return;
        var idx = trimmed.indexOf(': ');
        if (idx < 0) return;
        var label = trimmed.slice(0, idx);
        var field = FIELD_MAP[label];
        if (!field) return;
        data[field] = trimmed
          .slice(idx + 2)
          .split(',')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
      });
    return data;
  }

  function formatHtml(knownNotes) {
    if (!knownNotes || !String(knownNotes).trim()) return '';
    return String(knownNotes)
      .split('\n')
      .map(function (line) {
        var trimmed = line.trim();
        if (!trimmed) return '';
        var idx = trimmed.indexOf(': ');
        if (idx > 0) {
          var cat = trimmed.slice(0, idx);
          var val = trimmed.slice(idx + 2);
          return (
            '<div class="known-note-line">' +
            '<span class="known-note-cat">' +
            escapeHtml(cat) +
            ':</span> ' +
            '<span class="known-note-val">' +
            escapeHtml(val) +
            '</span></div>'
          );
        }
        return '<div class="known-note-line"><span class="known-note-val">' + escapeHtml(trimmed) + '</span></div>';
      })
      .filter(Boolean)
      .join('');
  }

  function normalizeNotesText(text) {
    if (text == null) return '';
    return String(text).replace(/\r\n/g, '\n').trim();
  }

  function textMatchesKnownNotes(notes, known) {
    var a = normalizeNotesText(notes);
    var b = normalizeNotesText(known);
    if (!a || !b) return false;
    return a === b;
  }

  function looksLikeKnownSetupNotes(text) {
    var normalized = normalizeNotesText(text);
    if (!normalized) return false;
    var lines = normalized.split('\n').filter(Boolean);
    if (!lines.length) return false;
    var setupHits = 0;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      var idx = trimmed.indexOf(': ');
      if (idx > 0 && FIELD_MAP[trimmed.slice(0, idx)]) setupHits++;
    });
    return setupHits >= 1;
  }

  /** Text that belongs in "Things I already know", not the freeform textarea. */
  function sanitizeForAnythingElseTextarea(notes, knownNotes) {
    var n = normalizeNotesText(notes);
    if (!n) return '';
    var k = normalizeNotesText(knownNotes);
    if (k && textMatchesKnownNotes(n, k)) return '';
    if (looksLikeKnownSetupNotes(n)) return '';
    return n;
  }

  function sanitizeNotesForSave(notes, knownNotes) {
    var clean = sanitizeForAnythingElseTextarea(notes, knownNotes);
    return clean || null;
  }

  function renderInto(el, knownNotes, emptyText) {
    if (!el) return;
    var known = knownNotes ? String(knownNotes).trim() : '';
    if (!known) {
      el.textContent = emptyText || 'Nothing saved from setup yet.';
      el.classList.add('known-notes--empty');
      return;
    }
    el.innerHTML = formatHtml(known);
    el.classList.remove('known-notes--empty');
  }

  window.KnownNotes = {
    parseToInitData: parseToInitData,
    formatHtml: formatHtml,
    renderInto: renderInto,
    looksLikeKnownSetupNotes: looksLikeKnownSetupNotes,
    sanitizeForAnythingElseTextarea: sanitizeForAnythingElseTextarea,
    sanitizeNotesForSave: sanitizeNotesForSave,
    FIELD_MAP: FIELD_MAP,
  };
})();
