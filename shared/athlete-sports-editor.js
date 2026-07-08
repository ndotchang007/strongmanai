(function () {
  var mountEl = null;
  var sports = [];
  var opts = {};
  var modalEl = null;
  var editingKey = null;
  var sportPicker = null;
  var MAX_SPORTS = 6;

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function programLabel(type) {
    var AC = window.AthleteContext;
    if (AC && AC.PROGRAM_LABELS && AC.PROGRAM_LABELS[type]) {
      return AC.PROGRAM_LABELS[type];
    }
    return type || 'School';
  }

  function seasonLabel(phase) {
    if (!phase) return 'Select season';
    var AC = window.AthleteContext;
    if (AC && AC.SEASON_LABELS && AC.SEASON_LABELS[phase]) {
      return AC.SEASON_LABELS[phase];
    }
    return phase || 'Select season';
  }

  function displaySeasonPhase(entry) {
    if (!entry) return null;
    if (window.AthleteContext && window.AthleteContext.resolveSeasonPhase) {
      return window.AthleteContext.resolveSeasonPhase(entry) || entry.seasonPhase || null;
    }
    return entry.seasonPhase || null;
  }

  function formatPreviewSchedule(entry) {
    var AC = window.AthleteContext;
    var parts = [];
    if (AC && entry.practiceDays && entry.practiceDays.length) {
      parts.push('Practice ' + AC.formatWeekdays(entry.practiceDays));
    }
    if (AC && entry.gameDays && entry.gameDays.length) {
      var comp =
        AC.competitionLabelForEntry && AC.competitionLabelForEntry(entry)
          ? AC.competitionLabelForEntry(entry)
          : 'Game';
      parts.push(comp + ' ' + AC.formatWeekdays(entry.gameDays));
    }
    if (entry.seasonStartDate && AC && AC.daysUntilDate) {
      var d = AC.daysUntilDate(entry.seasonStartDate);
      if (d != null && d >= 0) parts.push('Season in ' + d + 'd');
    }
    if (entry.skipPracticeDays && entry.skipPracticeDays.length && AC && AC.formatWeekdays) {
      parts.push('Skip practice ' + AC.formatWeekdays(entry.skipPracticeDays));
    }
    if (entry.equipmentAccess) {
      var eqLabels = { local: 'Full gym', home: 'Home gym', none: 'Minimal equipment' };
      parts.push('Equipment: ' + (eqLabels[entry.equipmentAccess] || entry.equipmentAccess));
    }
    if (entry.nextEventDate && AC && AC.daysUntilDate) {
      var ed = AC.daysUntilDate(entry.nextEventDate);
      if (ed != null && ed >= 0) {
        parts.push((entry.nextEventLabel || 'Event') + ' in ' + ed + 'd');
      }
    }
    return parts.join(' · ') || 'Tap to set schedule';
  }

  function renderCards() {
    if (!mountEl) return;
    var html =
      '<div class="sports-editor-header">' +
      '<div><h2 class="sports-editor-title">Your sports</h2>' +
      '<p class="sports-editor-lede">School, club, or both — each sport gets its own schedule.</p></div>' +
      (sports.length < MAX_SPORTS
        ? '<button type="button" class="sports-editor-add" id="sports-editor-add">+ Add sport</button>'
        : '') +
      '</div>' +
      '<div class="sports-editor-grid" role="list">';

    if (!sports.length) {
      html +=
        '<button type="button" class="sport-card sport-card--empty" id="sports-editor-add-first">' +
        '<span class="sport-card-plus">+</span>' +
        '<span>Add your first sport</span></button>';
    } else {
      sports.forEach(function (entry) {
        html +=
          '<button type="button" class="sport-card" role="listitem" data-sport-key="' +
          escapeHtml(entry.key) +
          '">' +
          '<span class="sport-card-badge">' +
          escapeHtml(programLabel(entry.programType)) +
          '</span>' +
          '<span class="sport-card-name">' +
          escapeHtml(entry.sport || 'Untitled sport') +
          '</span>' +
          (entry.position
            ? '<span class="sport-card-meta">' + escapeHtml(entry.position) + '</span>'
            : '') +
          '<span class="sport-card-phase">' +
          escapeHtml(seasonLabel(displaySeasonPhase(entry))) +
          '</span>' +
          '<span class="sport-card-schedule">' +
          escapeHtml(formatPreviewSchedule(entry)) +
          '</span>' +
          '<span class="sport-card-edit">Edit schedule →</span></button>';
      });
    }
    html += '</div>';
    mountEl.innerHTML = html;

    mountEl.querySelectorAll('.sport-card[data-sport-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(btn.getAttribute('data-sport-key'));
      });
    });
    var addBtn = el('sports-editor-add');
    if (addBtn) addBtn.addEventListener('click', addSport);
    var addFirst = el('sports-editor-add-first');
    if (addFirst) addFirst.addEventListener('click', addSport);
  }

  function addSport() {
    if (sports.length >= MAX_SPORTS) return;
    var entry = window.AthleteContext
      ? window.AthleteContext.defaultSport({ isPrimary: false })
      : { key: 'sport_new', sport: '', isPrimary: false };
    sports.push(entry);
    renderCards();
    openModal(entry.key);
  }

  function findSport(key) {
    return sports.find(function (s) {
      return s.key === key;
    });
  }

  function dayChip(cls, wd, label) {
    return (
      '<label class="buddy-day"><input type="checkbox" class="' +
      cls +
      '" data-weekday="' +
      wd +
      '"><span>' +
      label +
      '</span></label>'
    );
  }

  function buildModalHtml(entry) {
    var comp =
      window.AthleteContext && window.AthleteContext.competitionLabelForEntry
        ? window.AthleteContext.competitionLabelForEntry(entry)
        : 'Game';
    var storedPhase = entry.seasonPhase || '';
    return (
      '<div class="sport-modal-backdrop" id="sport-modal-backdrop">' +
      '<div class="sport-modal" role="dialog" aria-modal="true" aria-labelledby="sport-modal-title">' +
      '<header class="sport-modal-header">' +
      '<h2 id="sport-modal-title">Edit sport</h2>' +
      '<button type="button" class="sport-modal-close" id="sport-modal-close" aria-label="Close">×</button>' +
      '</header>' +
      '<div class="sport-modal-body">' +
      '<input type="hidden" id="sport-modal-sport-id" value="' +
      escapeHtml(entry.sportId || '') +
      '">' +
      '<label class="sport-modal-label" for="sport-modal-sport">Sport</label>' +
      '<input type="text" id="sport-modal-sport" class="buddy-field customize-input" maxlength="80" list="sport-datalist" value="' +
      escapeHtml(entry.sport || '') +
      '">' +
      '<label class="sport-modal-label" for="sport-modal-program">Program</label>' +
      '<select id="sport-modal-program" class="buddy-field customize-input">' +
      '<option value="school"' +
      (entry.programType === 'school' ? ' selected' : '') +
      '>School</option>' +
      '<option value="club"' +
      (entry.programType === 'club' ? ' selected' : '') +
      '>Club</option>' +
      '<option value="other"' +
      (entry.programType === 'other' ? ' selected' : '') +
      '>Other</option></select>' +
      '<label class="sport-modal-label" for="sport-modal-position">Position / event</label>' +
      '<input type="text" id="sport-modal-position" class="buddy-field customize-input" maxlength="40" value="' +
      escapeHtml(entry.position || '') +
      '">' +
      '<label class="sport-modal-label" for="sport-modal-season">Season phase</label>' +
      '<select id="sport-modal-season" class="buddy-field customize-input">' +
      '<option value=""' +
      (!storedPhase ? ' selected' : '') +
      ' disabled>Select what season you are in</option>' +
      '<option value="pre_season"' +
      (storedPhase === 'pre_season' ? ' selected' : '') +
      '>Pre-season</option>' +
      '<option value="in_season"' +
      (storedPhase === 'in_season' ? ' selected' : '') +
      '>In-season</option>' +
      '<option value="off_season"' +
      (storedPhase === 'off_season' ? ' selected' : '') +
      '>Off-season</option></select>' +
      '<p class="sport-modal-label">Practice days</p>' +
      '<div class="buddy-days">' +
      dayChip('sport-modal-practice', 1, 'M') +
      dayChip('sport-modal-practice', 2, 'T') +
      dayChip('sport-modal-practice', 3, 'W') +
      dayChip('sport-modal-practice', 4, 'T') +
      dayChip('sport-modal-practice', 5, 'F') +
      dayChip('sport-modal-practice', 6, 'S') +
      dayChip('sport-modal-practice', 0, 'S') +
      '</div>' +
      '<p class="sport-modal-label">' +
      comp +
      ' days</p>' +
      '<div class="buddy-days">' +
      dayChip('sport-modal-game', 1, 'M') +
      dayChip('sport-modal-game', 2, 'T') +
      dayChip('sport-modal-game', 3, 'W') +
      dayChip('sport-modal-game', 4, 'T') +
      dayChip('sport-modal-game', 5, 'F') +
      dayChip('sport-modal-game', 6, 'S') +
      dayChip('sport-modal-game', 0, 'S') +
      '</div>' +
      '<div class="sport-modal-dates">' +
      '<div><label class="sport-modal-label" for="sport-modal-season-start">Season start</label>' +
      '<input type="date" id="sport-modal-season-start" class="buddy-field customize-input" value="' +
      escapeHtml(entry.seasonStartDate || '') +
      '"></div>' +
      '<div><label class="sport-modal-label" for="sport-modal-season-end">Season end</label>' +
      '<input type="date" id="sport-modal-season-end" class="buddy-field customize-input" value="' +
      escapeHtml(entry.seasonEndDate || '') +
      '"></div></div>' +
      '<div class="sport-modal-dates">' +
      '<div><label class="sport-modal-label" for="sport-modal-next-date">Next ' +
      comp.toLowerCase() +
      ' / event</label>' +
      '<input type="date" id="sport-modal-next-date" class="buddy-field customize-input" value="' +
      escapeHtml(entry.nextEventDate || '') +
      '"></div>' +
      '<div><label class="sport-modal-label" for="sport-modal-next-label">Event label</label>' +
      '<input type="text" id="sport-modal-next-label" class="buddy-field customize-input" maxlength="80" placeholder="Regionals, opener, etc." value="' +
      escapeHtml(entry.nextEventLabel || '') +
      '"></div></div>' +
      '<details class="sport-modal-advanced">' +
      '<summary class="sport-modal-advanced-summary">Advanced settings</summary>' +
      '<div class="sport-modal-advanced-body">' +
      '<p class="sport-modal-label">Skip practice on</p>' +
      '<div class="buddy-days">' +
      dayChip('sport-modal-skip-practice', 1, 'M') +
      dayChip('sport-modal-skip-practice', 2, 'T') +
      dayChip('sport-modal-skip-practice', 3, 'W') +
      dayChip('sport-modal-skip-practice', 4, 'T') +
      dayChip('sport-modal-skip-practice', 5, 'F') +
      dayChip('sport-modal-skip-practice', 6, 'S') +
      dayChip('sport-modal-skip-practice', 0, 'S') +
      '</div>' +
      '<label class="sport-modal-label" for="sport-modal-equipment">Equipment access</label>' +
      '<select id="sport-modal-equipment" class="buddy-field customize-input">' +
      '<option value=""' +
      (!entry.equipmentAccess ? ' selected' : '') +
      '>— Not set —</option>' +
      '<option value="local"' +
      (entry.equipmentAccess === 'local' ? ' selected' : '') +
      '>Full gym</option>' +
      '<option value="home"' +
      (entry.equipmentAccess === 'home' ? ' selected' : '') +
      '>Home gym</option>' +
      '<option value="none"' +
      (entry.equipmentAccess === 'none' ? ' selected' : '') +
      '>Minimal equipment</option></select>' +
      '</div></details>' +
      '<p class="sport-modal-warn" id="sport-modal-warn" role="status" aria-live="polite" hidden></p>' +
      '</div>' +
      '<footer class="sport-modal-footer">' +
      '<button type="button" class="sport-modal-delete" id="sport-modal-delete">Remove sport</button>' +
      '<button type="button" class="customize-save-btn sport-modal-save" id="sport-modal-save">Save sport</button>' +
      '</footer></div></div>'
    );
  }

  function loadDaysIntoModal(entry) {
    document.querySelectorAll('.sport-modal-practice').forEach(function (cb) {
      var wd = parseInt(cb.getAttribute('data-weekday'), 10);
      cb.checked = (entry.practiceDays || []).some(function (p) {
        return p && Number(p.weekday) === wd;
      });
    });
    document.querySelectorAll('.sport-modal-game').forEach(function (cb) {
      var wd = parseInt(cb.getAttribute('data-weekday'), 10);
      cb.checked = (entry.gameDays || []).some(function (g) {
        return g && Number(g.weekday) === wd;
      });
    });
    document.querySelectorAll('.sport-modal-skip-practice').forEach(function (cb) {
      var wd = parseInt(cb.getAttribute('data-weekday'), 10);
      cb.checked = (entry.skipPracticeDays || []).some(function (g) {
        return g && Number(g.weekday) === wd;
      });
    });
  }

  function setModalWarn(msg) {
    var warnEl = el('sport-modal-warn');
    if (!warnEl) return;
    if (!msg) {
      warnEl.hidden = true;
      warnEl.textContent = '';
      return;
    }
    warnEl.hidden = false;
    warnEl.textContent = msg;
  }

  function collectSportWarnings(entry) {
    var warnings = [];
    if (!entry.position) warnings.push('No position or event set.');
    if (!entry.practiceDays.length && !entry.gameDays.length) {
      warnings.push('No practice or game days selected yet.');
    }
    if (!entry.seasonStartDate && !entry.seasonEndDate) {
      warnings.push('Season dates not set.');
    }
    if (!entry.equipmentAccess) warnings.push('Equipment access not set.');
    return warnings;
  }

  function readModalForm() {
    var practiceDays = [];
    document.querySelectorAll('.sport-modal-practice:checked').forEach(function (cb) {
      practiceDays.push({ weekday: parseInt(cb.getAttribute('data-weekday'), 10) });
    });
    var gameDays = [];
    document.querySelectorAll('.sport-modal-game:checked').forEach(function (cb) {
      gameDays.push({ weekday: parseInt(cb.getAttribute('data-weekday'), 10) });
    });
    var skipPracticeDays = [];
    document.querySelectorAll('.sport-modal-skip-practice:checked').forEach(function (cb) {
      skipPracticeDays.push({ weekday: parseInt(cb.getAttribute('data-weekday'), 10) });
    });
    var seasonRaw = (el('sport-modal-season') || {}).value || '';
    var equipmentRaw = (el('sport-modal-equipment') || {}).value || '';
    var sportName = (el('sport-modal-sport') || {}).value || '';
    var sportIdEl = el('sport-modal-sport-id');
    var sportId = sportIdEl && sportIdEl.value ? sportIdEl.value.trim() : null;
    if (!sportId && sportName.trim() && window.SportDatabase) {
      var resolved = window.SportDatabase.resolveSport(sportName.trim());
      if (resolved) sportId = resolved.id;
    }
    var form = {
      key: editingKey,
      sport: sportName.trim(),
      sportId: sportId || null,
      position: ((el('sport-modal-position') || {}).value || '').trim() || null,
      programType: (el('sport-modal-program') || {}).value || 'school',
      seasonPhase: seasonRaw || null,
      practiceDays: practiceDays,
      gameDays: gameDays,
      skipPracticeDays: skipPracticeDays,
      equipmentAccess: equipmentRaw || null,
      seasonStartDate: (el('sport-modal-season-start') || {}).value || null,
      seasonEndDate: (el('sport-modal-season-end') || {}).value || null,
      nextEventDate: (el('sport-modal-next-date') || {}).value || null,
      nextEventLabel: ((el('sport-modal-next-label') || {}).value || '').trim() || null,
      isPrimary: false,
    };
    return form;
  }

  function closeModal() {
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    editingKey = null;
    sportPicker = null;
    document.body.style.overflow = '';
  }

  function saveModal() {
    var entry = readModalForm();
    setModalWarn('');
    if (!entry.sport) {
      setModalWarn('Please enter a sport name.');
      return;
    }
    if (!entry.seasonPhase) {
      setModalWarn('Pick what season you are in.');
      return;
    }
    if (window.NamePolicy) {
      var hit = window.NamePolicy.checkAccountNameFields({
        sport: entry.sport,
        position: entry.position,
      });
      if (hit) {
        setModalWarn(window.NamePolicy.formatNamePolicyErrorPlain(hit.reason));
        return;
      }
    }
    var warnings = collectSportWarnings(entry);
    if (warnings.length) {
      setModalWarn('Saved — you can fill in later: ' + warnings.join(' '));
    }
    var idx = sports.findIndex(function (s) {
      return s.key === editingKey;
    });
    if (idx === -1) return;
    sports[idx] = entry;
    closeModal();
    renderCards();
    if (typeof opts.onChange === 'function') opts.onChange(getSports());
  }

  function deleteSport() {
    if (!editingKey) return;
    if (sports.length <= 1) {
      var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var ctx =
        user && window.AthleteContext
          ? window.AthleteContext.loadAthleteContext(user)
          : null;
      var sportFocused =
        ctx &&
        window.AthleteContext.isSportFocusedGoal &&
        window.AthleteContext.isSportFocusedGoal(ctx);
      if (sportFocused) {
        alert('Keep at least one sport, or clear fields if you are between seasons.');
        return;
      }
    }
    if (!window.confirm('Remove this sport from your profile?')) return;
    sports = sports.filter(function (s) {
      return s.key !== editingKey;
    });
    closeModal();
    renderCards();
    if (typeof opts.onChange === 'function') opts.onChange(getSports());
  }

  function openModal(key) {
    var entry = findSport(key);
    if (!entry) return;
    closeModal();
    editingKey = key;
    modalEl = document.createElement('div');
    modalEl.innerHTML = buildModalHtml(entry);
    document.body.appendChild(modalEl.firstChild);
    modalEl = el('sport-modal-backdrop');
    setModalWarn('');
    loadDaysIntoModal(entry);

    if (window.bindSportPicker) {
      sportPicker = window.bindSportPicker({
        inputId: 'sport-modal-sport',
        hiddenId: 'sport-modal-sport-id',
        datalistId: 'sport-datalist',
      });
      if (sportPicker && sportPicker.setSport) {
        sportPicker.setSport(entry.sportId, entry.sport);
      }
    }

    el('sport-modal-close').addEventListener('click', closeModal);
    el('sport-modal-backdrop').addEventListener('click', function (e) {
      if (e.target === el('sport-modal-backdrop')) closeModal();
    });
    el('sport-modal-save').addEventListener('click', saveModal);
    el('sport-modal-delete').addEventListener('click', deleteSport);
    document.body.style.overflow = 'hidden';
  }

  function mount(element, options) {
    mountEl = element;
    opts = options || {};
    sports = Array.isArray(options.initialSports) ? options.initialSports.slice() : [];
    if (!sports.length && options.createDefault !== false) {
      sports.push(
        window.AthleteContext
          ? window.AthleteContext.defaultSport({ isPrimary: false })
          : { key: 'sport_1', sport: '', isPrimary: false }
      );
    }
    renderCards();
  }

  function getSports() {
    return sports.slice();
  }

  function setSports(list) {
    sports = Array.isArray(list) ? list.slice() : [];
    sports.forEach(function (s) {
      s.isPrimary = false;
    });
    renderCards();
  }

  window.AthleteSportsEditor = {
    mount: mount,
    getSports: getSports,
    setSports: setSports,
    render: renderCards,
    closeModal: closeModal,
  };
})();
