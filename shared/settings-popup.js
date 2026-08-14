(function () {
  var THEME_KEY = 'strongman-home-theme';
  var UNITS_KEY = 'strongman-home-units';
  var NOTIFY_EMAIL_KEY = 'strongman-home-notify-email';
  var NOTIFY_PUSH_KEY = 'strongman-home-notify-push';
  var PRIVACY_PUBLIC_KEY = 'strongman-home-profile-public';
  var PRIVACY_ACTIVITY_KEY = 'strongman-home-show-activity';
  var REMINDER_SCHEDULE_KEY = 'strongman-reminder-schedule';
  var REMINDER_LAST_FIRE_KEY = 'strongman-reminder-last-fire';
  var FAVORITES_KEY = 'strongman-favorite-movements';
  var ANYTHING_ELSE_KEY = 'strongman-coach-anything-else';
  var EXPERIMENTAL_KEY = 'strongman-experimental-mode';
  var LOG_STYLE_KEY = 'strongman-preferred-log-style';
  var LOG_STYLE_VALUES = ['coach', 'quick', 'guided', 'table'];

  function getStoredTheme() {
    if (window.StrongmanTheme && typeof window.StrongmanTheme.getStoredTheme === 'function') {
      return window.StrongmanTheme.getStoredTheme();
    }
    var v = localStorage.getItem(THEME_KEY);
    if (v === 'auto') return 'system';
    if (v === 'dark' || v === 'light' || v === 'system') return v;
    if (v === 'voltage' || v === 'forge' || v === 'aurora' || v === 'signal') return v;
    if (v === 'tidepool' || v === 'noir-lilac' || v === 'citrus') return 'aurora';
    if (v === 'marble') return 'light';
    return 'signal';
  }

  function getEffectiveTheme() {
    if (window.StrongmanTheme && typeof window.StrongmanTheme.getEffectiveTheme === 'function') {
      return window.StrongmanTheme.getEffectiveTheme();
    }
    var stored = getStoredTheme();
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'signal' : 'light';
    }
    return stored;
  }

  function applyDocumentTheme() {
    if (window.StrongmanTheme && typeof window.StrongmanTheme.applyDocumentTheme === 'function') {
      window.StrongmanTheme.applyDocumentTheme();
      return;
    }
    document.documentElement.setAttribute('data-theme', getEffectiveTheme());
  }

  if (!window.StrongmanTheme) {
    applyDocumentTheme();

    var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    if (mqDark.addEventListener) {
      mqDark.addEventListener('change', function () {
        if (getStoredTheme() === 'system') applyDocumentTheme();
      });
    } else if (mqDark.addListener) {
      mqDark.addListener(function () {
        if (getStoredTheme() === 'system') applyDocumentTheme();
      });
    }
  }

  function isExperimentalEnabled() {
    return localStorage.getItem(EXPERIMENTAL_KEY) === '1';
  }

  function applyExperimentalMode() {
    document.documentElement.setAttribute('data-experimental', isExperimentalEnabled() ? 'true' : 'false');
  }

  applyExperimentalMode();

  var experimentalToggle = null;

  function bindExperimentalToggle(el) {
    if (!el || el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    experimentalToggle = el;
    el.addEventListener('change', function () {
      localStorage.setItem(EXPERIMENTAL_KEY, el.checked ? '1' : '0');
      applyExperimentalMode();
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('strongman:experimental-change', { detail: { enabled: el.checked } }));
      }
    });
  }

  function loadExperimentalToggle() {
    var el = document.getElementById('settings-experimental-mode');
    if (!el) return;
    el.checked = isExperimentalEnabled();
    bindExperimentalToggle(el);
  }

  window.strongmanExperimentalMode = {
    isEnabled: isExperimentalEnabled,
    apply: applyExperimentalMode,
  };

  function defaultReminderSchedule() {
    return {
      enabled: false,
      time: '09:00',
      frequency: 'weekdays',
      customDays: [1, 2, 3, 4, 5],
    };
  }

  function normalizeTime(t) {
    if (typeof t !== 'string' || !/^\d{1,2}:\d{2}$/.test(t)) return '09:00';
    var p = t.split(':');
    var h = Math.min(23, Math.max(0, parseInt(p[0], 10) || 0));
    var m = Math.min(59, Math.max(0, parseInt(p[1], 10) || 0));
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function loadReminderSchedule() {
    try {
      var raw = localStorage.getItem(REMINDER_SCHEDULE_KEY);
      if (!raw) return defaultReminderSchedule();
      var o = JSON.parse(raw);
      if (typeof o !== 'object' || o === null) return defaultReminderSchedule();
      var freq = o.frequency;
      if (['daily', 'weekdays', 'weekends', 'custom'].indexOf(freq) === -1) {
        freq = 'weekdays';
      }
      var cd = Array.isArray(o.customDays)
        ? o.customDays
            .map(function (d) {
              return parseInt(d, 10);
            })
            .filter(function (d) {
              return !isNaN(d) && d >= 0 && d <= 6;
            })
        : [1, 2, 3, 4, 5];
      return {
        enabled: !!o.enabled,
        time: normalizeTime(typeof o.time === 'string' ? o.time : '09:00'),
        frequency: freq,
        customDays: cd.length ? cd : [1, 2, 3, 4, 5],
      };
    } catch (e) {
      return defaultReminderSchedule();
    }
  }

  function saveReminderSchedule(sched) {
    localStorage.setItem(REMINDER_SCHEDULE_KEY, JSON.stringify(sched));
  }

  function reminderDaysForSchedule(s) {
    if (s.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    if (s.frequency === 'weekdays') return [1, 2, 3, 4, 5];
    if (s.frequency === 'weekends') return [0, 6];
    var d = s.customDays && s.customDays.length ? s.customDays.slice() : [1, 2, 3, 4, 5];
    return d;
  }

  function localDateKey(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return (
      d.getFullYear() +
      '-' +
      (m < 10 ? '0' : '') +
      m +
      '-' +
      (day < 10 ? '0' : '') +
      day
    );
  }

  function browserNotificationsReady() {
    if (!('Notification' in window)) return false;
    return localStorage.getItem(NOTIFY_PUSH_KEY) === '1' && Notification.permission === 'granted';
  }

  function maybeFireScheduledReminder() {
    if (!browserNotificationsReady()) return;
    var s = loadReminderSchedule();
    if (!s.enabled) return;
    var now = new Date();
    var parts = s.time.split(':');
    var th = parseInt(parts[0], 10);
    var tm = parseInt(parts[1], 10);
    if (now.getHours() !== th || now.getMinutes() !== tm) return;
    var wd = now.getDay();
    var allowed = reminderDaysForSchedule(s);
    if (allowed.indexOf(wd) === -1) return;
    var key = localDateKey(now);
    if (localStorage.getItem(REMINDER_LAST_FIRE_KEY) === key) return;
    try {
      new Notification('Strongman AI — reminder', {
        body: 'Time for a quick check-in or your next session.',
        tag: 'strongman-daily-reminder',
      });
    } catch (e) {
      /* ignore */
    }
    localStorage.setItem(REMINDER_LAST_FIRE_KEY, key);
  }

  var settingsTrigger = document.getElementById('sidebar-settings-trigger');
  var settingsTriggers = document.querySelectorAll('.sidebar-settings-trigger');
  var activeSettingsTrigger = null;
  var settingsBackdrop = document.getElementById('home-settings-backdrop');
  var settingsDialog = document.getElementById('home-settings-dialog');
  var settingsClose = document.getElementById('home-settings-close');
  var themeRadios = document.querySelectorAll('input[name="home-theme"]');

  function bindThemeRadios() {
    themeRadios = document.querySelectorAll('input[name="home-theme"]');
    themeRadios.forEach(function (radio) {
      if (radio.dataset.themeBound === '1') return;
      radio.dataset.themeBound = '1';
      radio.addEventListener('change', function () {
        if (!this.checked) return;
        if (window.StrongmanTheme && typeof window.StrongmanTheme.setThemePreference === 'function') {
          window.StrongmanTheme.setThemePreference(this.value);
        } else {
          try {
            localStorage.setItem(THEME_KEY, this.value);
          } catch (e) {}
          applyDocumentTheme();
        }
      });
    });
  }

  function mountThemePicker() {
    var catalog =
      window.StrongmanTheme && window.StrongmanTheme.THEME_CATALOG
        ? window.StrongmanTheme.THEME_CATALOG
        : null;
    var rows = document.querySelectorAll('.home-settings-theme-row');
    if (!catalog || !rows.length) {
      bindThemeRadios();
      return;
    }
    var selected = getStoredTheme();
    rows.forEach(function (row) {
      row.classList.add('settings-theme-grid');
      row.setAttribute('role', 'radiogroup');
      row.setAttribute('aria-label', 'Color theme');
      row.innerHTML = '';
      catalog.forEach(function (theme) {
        var label = document.createElement('label');
        label.className = 'settings-theme-card';
        label.title = theme.blurb || theme.nickname;

        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'home-theme';
        input.value = theme.id;
        input.className = 'home-settings-radio';
        input.checked = theme.id === selected;

        var swatches = document.createElement('div');
        swatches.className = 'settings-theme-card-swatches';
        swatches.setAttribute('aria-hidden', 'true');
        (theme.swatches || []).forEach(function (color) {
          var chip = document.createElement('span');
          chip.className = 'settings-theme-card-swatch';
          chip.style.background = color;
          swatches.appendChild(chip);
        });

        var name = document.createElement('span');
        name.className = 'settings-theme-card-name';
        name.textContent = theme.nickname;

        var blurb = document.createElement('span');
        blurb.className = 'settings-theme-card-blurb';
        blurb.textContent = theme.blurb || '';

        label.appendChild(input);
        label.appendChild(swatches);
        label.appendChild(name);
        label.appendChild(blurb);
        row.appendChild(label);
      });
    });
    bindThemeRadios();
  }

  mountThemePicker();

  var unitsSelect = document.getElementById('settings-units-select');
  var weightIncrementSelect = document.getElementById('settings-weight-increment');

  function ensureWeightIncrementControl() {
    if (weightIncrementSelect || !unitsSelect) return;
    var section = unitsSelect.closest('.home-settings-section');
    if (!section) return;
    var label = document.createElement('label');
    label.className = 'home-settings-field-label';
    label.setAttribute('for', 'settings-weight-increment');
    label.textContent = 'Weight increment';
    var select = document.createElement('select');
    select.id = 'settings-weight-increment';
    select.className = unitsSelect.className;
    select.innerHTML =
      '<option value="standard">Standard (5 lb / 2.5 kg)</option>' +
      '<option value="fine">Fine (2.5 lb / 1.25 kg)</option>' +
      '<option value="personal">Personal (from your equipment scan)</option>';
    var hint = document.createElement('p');
    hint.className = 'home-settings-hint home-settings-hint--tight';
    hint.textContent =
      'Personal uses the plate/pin steps Rocky read from your equipment photos in Customize.';
    unitsSelect.insertAdjacentElement('afterend', label);
    label.insertAdjacentElement('afterend', select);
    select.insertAdjacentElement('afterend', hint);
    weightIncrementSelect = select;
  }

  ensureWeightIncrementControl();

  var preferredLogStyleSelect = document.getElementById('settings-preferred-log-style');

  function normalizeLogStyle(value) {
    var v = String(value || '').trim().toLowerCase();
    return LOG_STYLE_VALUES.indexOf(v) !== -1 ? v : 'coach';
  }

  function getPreferredLogStyle() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var fromUser =
      u && u.athleteContext && u.athleteContext.preferredLogStyle
        ? u.athleteContext.preferredLogStyle
        : null;
    if (fromUser) return normalizeLogStyle(fromUser);
    return normalizeLogStyle(localStorage.getItem(LOG_STYLE_KEY));
  }

  function ensurePreferredLogStyleControl() {
    if (preferredLogStyleSelect) return;
    var appearanceHeading = document.getElementById('settings-appearance-heading');
    var section = appearanceHeading
      ? appearanceHeading.closest('.home-settings-section')
      : null;
    if (!section) return;
    var label = document.createElement('label');
    label.className = 'home-settings-field-label';
    label.setAttribute('for', 'settings-preferred-log-style');
    label.textContent = 'Preferred log view';
    var select = document.createElement('select');
    select.id = 'settings-preferred-log-style';
    select.className = 'home-settings-select';
    select.innerHTML =
      '<option value="coach">Coach</option>' +
      '<option value="quick">Quick</option>' +
      '<option value="guided">Guided</option>' +
      '<option value="table">Table</option>';
    var hint = document.createElement('p');
    hint.className = 'home-settings-hint home-settings-hint--tight';
    hint.textContent = 'Default layout when you open the logbook. Change anytime.';
    section.appendChild(label);
    section.appendChild(select);
    section.appendChild(hint);
    preferredLogStyleSelect = select;
  }

  ensurePreferredLogStyleControl();

  function syncPreferredLogStyleFromUser() {
    if (!preferredLogStyleSelect) return;
    preferredLogStyleSelect.value = getPreferredLogStyle();
  }

  function persistPreferredLogStyle(style) {
    var next = normalizeLogStyle(style);
    try {
      localStorage.setItem(LOG_STYLE_KEY, next);
    } catch (e) {}
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') {
      window.dispatchEvent(
        new CustomEvent('strongman:preferred-log-style-changed', { detail: { style: next } })
      );
      return Promise.resolve(next);
    }
    var athleteContext = Object.assign({}, u.athleteContext || {}, {
      preferredLogStyle: next,
    });
    return window
      .apiPut('/users/' + u.id, { athleteContext: athleteContext })
      .then(function (res) {
        if (!res.ok) return next;
        return res.json().then(function (body) {
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
          return next;
        });
      })
      .catch(function () {
        return next;
      })
      .then(function (saved) {
        window.dispatchEvent(
          new CustomEvent('strongman:preferred-log-style-changed', {
            detail: { style: saved },
          })
        );
        return saved;
      });
  }

  if (preferredLogStyleSelect) {
    syncPreferredLogStyleFromUser();
    preferredLogStyleSelect.addEventListener('change', function () {
      persistPreferredLogStyle(preferredLogStyleSelect.value);
    });
  }

  window.strongmanPreferredLogStyle = {
    get: getPreferredLogStyle,
    set: persistPreferredLogStyle,
    normalize: normalizeLogStyle,
  };

  var notifyEmail = document.getElementById('settings-notify-email');
  var notifyPush = document.getElementById('settings-notify-push');
  var notifyBrowserStatus = document.getElementById('settings-notify-browser-status');
  var profilePublic = document.getElementById('settings-profile-public');
  var showActivity = document.getElementById('settings-show-activity');
  var reminderEnabledEl = document.getElementById('settings-reminder-enabled');
  var reminderFields = document.getElementById('settings-reminder-fields');
  var reminderTimeEl = document.getElementById('settings-reminder-time');
  var reminderFreqEl = document.getElementById('settings-reminder-frequency');
  var reminderCustom = document.getElementById('settings-reminder-custom-days');
  var favoritesTextarea = document.getElementById('settings-favorite-movements');
  var anythingElseTextarea = document.getElementById('settings-anything-else');
  var knownNotesEl = document.getElementById('settings-known-notes');

  function setNotifyBrowserStatus(message) {
    if (!notifyBrowserStatus) return;
    if (!message) {
      notifyBrowserStatus.hidden = true;
      notifyBrowserStatus.textContent = '';
      return;
    }
    notifyBrowserStatus.hidden = false;
    notifyBrowserStatus.textContent = message;
  }

  function reconcileBrowserNotificationsUI() {
    if (!notifyPush) return;
    if (!('Notification' in window)) {
      notifyPush.disabled = true;
      notifyPush.checked = false;
      localStorage.setItem(NOTIFY_PUSH_KEY, '0');
      setNotifyBrowserStatus('Browser notifications are not available in this environment.');
      return;
    }
    notifyPush.disabled = false;
    if (Notification.permission === 'denied') {
      var hadPreference = localStorage.getItem(NOTIFY_PUSH_KEY) === '1';
      if (notifyPush.checked) {
        notifyPush.checked = false;
      }
      localStorage.setItem(NOTIFY_PUSH_KEY, '0');
      if (hadPreference) {
        setNotifyBrowserStatus(
          'Notifications are blocked for this site. Allow them in your browser settings to use browser reminders.'
        );
      } else {
        setNotifyBrowserStatus('');
      }
      return;
    }
    if (localStorage.getItem(NOTIFY_PUSH_KEY) === '1' && Notification.permission !== 'granted') {
      notifyPush.checked = false;
      localStorage.setItem(NOTIFY_PUSH_KEY, '0');
    }
    setNotifyBrowserStatus('');
  }

  function readCustomDaysFromForm() {
    var days = [];
    document.querySelectorAll('.settings-reminder-day').forEach(function (cb) {
      if (cb.checked) days.push(parseInt(cb.getAttribute('data-weekday'), 10));
    });
    days.sort(function (a, b) {
      return a - b;
    });
    return days;
  }

  function saveReminderScheduleFromForm() {
    if (!reminderEnabledEl) return;
    var custom = readCustomDaysFromForm();
    var sched = {
      enabled: reminderEnabledEl.checked,
      time: reminderTimeEl ? normalizeTime(reminderTimeEl.value || '09:00') : '09:00',
      frequency:
        reminderFreqEl && ['daily', 'weekdays', 'weekends', 'custom'].indexOf(reminderFreqEl.value) >= 0
          ? reminderFreqEl.value
          : 'weekdays',
      customDays: custom.length ? custom : [1, 2, 3, 4, 5],
    };
    saveReminderSchedule(sched);
    if (window.StrongmanPush && typeof window.StrongmanPush.syncReminderSchedule === 'function') {
      window.StrongmanPush.syncReminderSchedule(sched);
    }
  }

  function updateReminderScheduleVisibility() {
    if (reminderFields) {
      reminderFields.hidden = !reminderEnabledEl || !reminderEnabledEl.checked;
    }
    if (reminderCustom && reminderFreqEl) {
      var hideCustom =
        !reminderFreqEl ||
        reminderFreqEl.value !== 'custom' ||
        (reminderFields && reminderFields.hidden);
      reminderCustom.hidden = hideCustom;
    }
  }

  function loadReminderScheduleIntoForm() {
    if (!reminderEnabledEl) return;
    var s = loadReminderSchedule();
    reminderEnabledEl.checked = s.enabled;
    if (reminderTimeEl) reminderTimeEl.value = s.time;
    if (reminderFreqEl) reminderFreqEl.value = s.frequency;
    document.querySelectorAll('.settings-reminder-day').forEach(function (cb) {
      var wd = parseInt(cb.getAttribute('data-weekday'), 10);
      cb.checked = s.customDays.indexOf(wd) >= 0;
    });
    updateReminderScheduleVisibility();
  }

  function setThemeRadioFromStorage() {
    var t = getStoredTheme();
    themeRadios.forEach(function (r) {
      r.checked = r.value === t;
    });
  }

  function loadOtherPrefs() {
    if (unitsSelect) {
      var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var units = u && u.measurement ? u.measurement : null;
      if (!units) {
        try {
          units = localStorage.getItem(UNITS_KEY);
        } catch (eU) {}
      }
      unitsSelect.value = units === 'metric' ? 'metric' : 'imperial';
      try {
        localStorage.setItem(UNITS_KEY, unitsSelect.value);
      } catch (eLs) {}
    }
    syncNotifyEmailFromUser();
    syncWeightIncrementFromUser();
    if (notifyPush) notifyPush.checked = localStorage.getItem(NOTIFY_PUSH_KEY) === '1';
    if (profilePublic) profilePublic.checked = localStorage.getItem(PRIVACY_PUBLIC_KEY) !== '0';
    if (showActivity) showActivity.checked = localStorage.getItem(PRIVACY_ACTIVITY_KEY) !== '0';
    reconcileBrowserNotificationsUI();
    loadReminderScheduleIntoForm();
    loadExperimentalToggle();
    if (favoritesTextarea) {
      favoritesTextarea.value = localStorage.getItem(FAVORITES_KEY) || '';
    }
    loadCoachNotesFromUser();
  }

  function resolveCoachNotesFields(ctx) {
    ctx = ctx || {};
    var known = ctx.knownNotes ? String(ctx.knownNotes).trim() : '';
    var userNotes = ctx.notes ? String(ctx.notes).trim() : '';
    if (!known && userNotes) {
      known = userNotes;
      userNotes = '';
    }
    return { known: known, userNotes: userNotes };
  }

  function loadCoachNotesFromUser() {
    if (!anythingElseTextarea && !knownNotesEl) return;
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ctx =
      u && window.AthleteContext ? window.AthleteContext.loadAthleteContext(u) : {};
    var fields = resolveCoachNotesFields(ctx);
    if (knownNotesEl) {
      if (window.KnownNotes && window.KnownNotes.renderInto) {
        window.KnownNotes.renderInto(
          knownNotesEl,
          fields.known,
          'Nothing saved from setup yet.'
        );
        knownNotesEl.classList.toggle('home-settings-known-notes--empty', !fields.known);
      } else {
        knownNotesEl.textContent = fields.known || 'Nothing saved from setup yet.';
        knownNotesEl.classList.toggle('home-settings-known-notes--empty', !fields.known);
      }
    }
    if (anythingElseTextarea) {
      var known = ctx.knownNotes ? String(ctx.knownNotes).trim() : '';
      var userNotes =
        window.KnownNotes && window.KnownNotes.sanitizeForAnythingElseTextarea
          ? window.KnownNotes.sanitizeForAnythingElseTextarea(ctx.notes, known)
          : (function () {
              var n = ctx.notes ? String(ctx.notes).trim() : '';
              if (known && n === known) return '';
              return n;
            })();
      anythingElseTextarea.value = userNotes;
      anythingElseTextarea.placeholder = '';
      anythingElseTextarea.removeAttribute('placeholder');
      try {
        var stored = localStorage.getItem(ANYTHING_ELSE_KEY);
        if (stored) {
          if (
            window.KnownNotes &&
            window.KnownNotes.sanitizeForAnythingElseTextarea &&
            !window.KnownNotes.sanitizeForAnythingElseTextarea(stored, fields.known)
          ) {
            localStorage.removeItem(ANYTHING_ELSE_KEY);
          } else if (fields.known && stored.trim() === fields.known.trim()) {
            localStorage.removeItem(ANYTHING_ELSE_KEY);
          }
        }
        if (userNotes) localStorage.setItem(ANYTHING_ELSE_KEY, userNotes);
        else localStorage.removeItem(ANYTHING_ELSE_KEY);
      } catch (e) {}
    }
  }

  function persistCoachNotesToServer() {
    if (!anythingElseTextarea) return Promise.resolve();
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') return Promise.resolve();
    var notes = anythingElseTextarea.value.trim().slice(0, 4000) || null;
    var ctx =
      window.AthleteContext && u ? window.AthleteContext.loadAthleteContext(u) : {};
    var fields = resolveCoachNotesFields(ctx);
    var knownNotes = ctx.knownNotes != null ? ctx.knownNotes : fields.known || null;
    var notesToSave = notes;
    if (window.KnownNotes) {
      if (
        !knownNotes &&
        notes &&
        window.KnownNotes.looksLikeKnownSetupNotes(notes)
      ) {
        knownNotes = String(notes).trim();
        notesToSave = null;
      } else if (window.KnownNotes.sanitizeNotesForSave) {
        notesToSave = window.KnownNotes.sanitizeNotesForSave(notes, knownNotes);
      }
    }
    var athleteContext = Object.assign({}, ctx, {
      knownNotes: knownNotes,
      notes: notesToSave,
    });
    var reason =
      window.AthleteContext && window.AthleteContext.primaryGoalToReason
        ? window.AthleteContext.primaryGoalToReason(ctx.primaryGoal || 'sport_performance')
        : u.reason || 'sports';
    return window
      .apiPut('/users/' + u.id, { reason: reason, athleteContext: athleteContext })
      .then(function (res) {
        if (!res.ok) return;
        return res.json().then(function (body) {
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
          loadCoachNotesFromUser();
        });
      });
  }

  setThemeRadioFromStorage();
  loadOtherPrefs();

  function openSettings(triggerEl) {
    if (!settingsBackdrop || !settingsDialog) return;
    activeSettingsTrigger =
      triggerEl ||
      settingsTrigger ||
      (settingsTriggers.length ? settingsTriggers[0] : null);
    setThemeRadioFromStorage();
    loadOtherPrefs();
    var delStatus = document.getElementById('settings-account-delete-status');
    if (delStatus) delStatus.textContent = '';
    settingsBackdrop.classList.add('is-open');
    settingsDialog.classList.add('is-open');
    settingsBackdrop.setAttribute('aria-hidden', 'false');
    settingsDialog.setAttribute('aria-hidden', 'false');
    settingsTriggers.forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'true');
    });
    if (settingsClose) settingsClose.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    if (!settingsBackdrop || !settingsDialog) return;
    settingsBackdrop.classList.remove('is-open');
    settingsDialog.classList.remove('is-open');
    settingsBackdrop.setAttribute('aria-hidden', 'true');
    settingsDialog.setAttribute('aria-hidden', 'true');
    settingsTriggers.forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
    if (activeSettingsTrigger && typeof activeSettingsTrigger.focus === 'function') {
      activeSettingsTrigger.focus();
    }
    activeSettingsTrigger = null;
    document.body.style.overflow = '';
  }

  settingsTriggers.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openSettings(btn);
    });
  });
  if (settingsDialog) {
    settingsDialog.addEventListener('click', function (e) {
      if (!e.target.closest('.home-settings-panel')) closeSettings();
    });
  }
  if (settingsClose) {
    settingsClose.addEventListener('click', closeSettings);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && settingsDialog && settingsDialog.classList.contains('is-open')) {
      closeSettings();
    }
  });

  if (unitsSelect) {
    unitsSelect.addEventListener('change', function () {
      var toUnits = unitsSelect.value === 'metric' ? 'metric' : 'imperial';
      var fromUnits =
        window.UserAccountForm && window.UserAccountForm.getUnits
          ? window.UserAccountForm.getUnits()
          : toUnits === 'metric'
            ? 'imperial'
            : 'metric';
      try {
        localStorage.setItem(UNITS_KEY, toUnits);
      } catch (e) {}
      if (window.UserAccountForm) {
        if (typeof window.UserAccountForm.convertFormMetrics === 'function') {
          window.UserAccountForm.convertFormMetrics(fromUnits, toUnits);
        }
        if (typeof window.UserAccountForm.updateUnitLabels === 'function') {
          window.UserAccountForm.updateUnitLabels();
        }
      }
      var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (u && u.id && u.token && typeof window.apiPut === 'function') {
        window
          .apiPut('/users/' + u.id, { measurement: toUnits })
          .then(function (res) {
            if (!res.ok) return;
            return res.json().then(function (body) {
              if (typeof window.setCurrentUser === 'function') {
                var merged = Object.assign({}, u, body);
                if (u.token) merged.token = u.token;
                window.setCurrentUser(merged);
              }
            });
          })
          .catch(function () {});
      }
      window.dispatchEvent(new CustomEvent('strongman:units-changed', { detail: { units: toUnits } }));
    });
  }

  function syncWeightIncrementFromUser() {
    if (!weightIncrementSelect) return;
    var mode =
      window.Units && typeof window.Units.getWeightIncrementMode === 'function'
        ? window.Units.getWeightIncrementMode()
        : 'standard';
    weightIncrementSelect.value = mode;
  }

  function persistWeightIncrement(mode) {
    var next =
      window.Units && typeof window.Units.setWeightIncrementMode === 'function'
        ? window.Units.setWeightIncrementMode(mode)
        : mode;
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') {
      window.dispatchEvent(
        new CustomEvent('strongman:weight-increment-changed', { detail: { mode: next } })
      );
      return Promise.resolve();
    }
    var athleteContext = Object.assign({}, u.athleteContext || {}, { weightIncrement: next });
    return window
      .apiPut('/users/' + u.id, { athleteContext: athleteContext })
      .then(function (res) {
        if (!res.ok) return;
        return res.json().then(function (body) {
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
        });
      })
      .catch(function () {})
      .then(function () {
        window.dispatchEvent(
          new CustomEvent('strongman:weight-increment-changed', { detail: { mode: next } })
        );
      });
  }

  if (weightIncrementSelect) {
    syncWeightIncrementFromUser();
    weightIncrementSelect.addEventListener('change', function () {
      persistWeightIncrement(weightIncrementSelect.value);
    });
  }

  function isEmailNotificationsEnabled() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (u && typeof u.notifyEmail === 'boolean') return u.notifyEmail;
    return localStorage.getItem(NOTIFY_EMAIL_KEY) === '1';
  }

  function syncNotifyEmailFromUser() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (u && typeof u.notifyEmail === 'boolean') {
      localStorage.setItem(NOTIFY_EMAIL_KEY, u.notifyEmail ? '1' : '0');
      if (notifyEmail) notifyEmail.checked = u.notifyEmail;
      return;
    }
    if (notifyEmail) notifyEmail.checked = localStorage.getItem(NOTIFY_EMAIL_KEY) === '1';
  }

  function persistNotifyEmailToServer(enabled) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') return Promise.resolve();
    return window
      .apiPut('/users/' + u.id, { notifyEmail: !!enabled })
      .then(function (res) {
        if (!res.ok) {
          if (notifyEmail) {
            setNotifyBrowserStatus(
              'Could not save email preference. Check your connection and try again.'
            );
          }
          return;
        }
        return res.json().then(function (body) {
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
          if (enabled && typeof window.apiPost === 'function') {
            return window
              .apiPost('/notifications/email/confirm', {})
              .then(function (confirmRes) {
                if (confirmRes.ok) {
                  setNotifyBrowserStatus('Confirmation email sent — check your inbox.');
                } else {
                  return confirmRes.json().then(function (errBody) {
                    var msg =
                      (errBody && errBody.error) ||
                      'Email preference saved, but confirmation email could not be sent.';
                    setNotifyBrowserStatus(msg);
                  }).catch(function () {
                    setNotifyBrowserStatus(
                      'Email preference saved, but confirmation email could not be sent.'
                    );
                  });
                }
              })
              .catch(function () {
                setNotifyBrowserStatus(
                  'Email preference saved. Confirmation email may arrive shortly.'
                );
              });
          }
          if (!enabled) setNotifyBrowserStatus('');
        });
      })
      .catch(function () {
        setNotifyBrowserStatus('Could not save email preference. Try again in a moment.');
      });
  }

  function bindCheckbox(el, key) {
    if (!el) return;
    el.addEventListener('change', function () {
      localStorage.setItem(key, el.checked ? '1' : '0');
    });
  }

  bindCheckbox(profilePublic, PRIVACY_PUBLIC_KEY);
  bindCheckbox(showActivity, PRIVACY_ACTIVITY_KEY);

  if (notifyEmail) {
    notifyEmail.addEventListener('change', function () {
      localStorage.setItem(NOTIFY_EMAIL_KEY, notifyEmail.checked ? '1' : '0');
      persistNotifyEmailToServer(notifyEmail.checked);
    });
  }

  if (notifyPush) {
    notifyPush.addEventListener('change', function () {
      if (!notifyPush.checked) {
        localStorage.setItem(NOTIFY_PUSH_KEY, '0');
        if (window.StrongmanPush && typeof window.StrongmanPush.unsubscribe === 'function') {
          window.StrongmanPush.unsubscribe();
        }
        persistNotifyPushToServer(false);
        reconcileBrowserNotificationsUI();
        return;
      }
      if (!('Notification' in window)) {
        notifyPush.checked = false;
        localStorage.setItem(NOTIFY_PUSH_KEY, '0');
        setNotifyBrowserStatus('This browser does not support notifications.');
        return;
      }
      function afterGranted() {
        localStorage.setItem(NOTIFY_PUSH_KEY, '1');
        setNotifyBrowserStatus('');
        persistNotifyPushToServer(true);
        if (window.StrongmanPush && typeof window.StrongmanPush.subscribe === 'function') {
          window.StrongmanPush.subscribe().then(function (result) {
            if (result && result.ok) {
              setNotifyBrowserStatus('Browser notifications enabled — including when the app is closed.');
              return;
            }
            if (result && result.reason === 'not_configured') {
              setNotifyBrowserStatus(
                'Permission granted. Local reminders work with this tab open; server push is not configured yet.'
              );
              return;
            }
            setNotifyBrowserStatus(
              'Permission granted. Local reminders are on; push subscription may need a refresh.'
            );
          });
        }
        if (window.StrongmanPush && typeof window.StrongmanPush.syncReminderSchedule === 'function') {
          window.StrongmanPush.syncReminderSchedule(loadReminderSchedule());
        }
      }
      if (Notification.permission === 'granted') {
        afterGranted();
        return;
      }
      if (Notification.permission === 'denied') {
        notifyPush.checked = false;
        localStorage.setItem(NOTIFY_PUSH_KEY, '0');
        reconcileBrowserNotificationsUI();
        return;
      }
      Notification.requestPermission().then(function (perm) {
        if (perm === 'granted') {
          afterGranted();
        } else {
          notifyPush.checked = false;
          localStorage.setItem(NOTIFY_PUSH_KEY, '0');
          if (perm === 'denied') {
            setNotifyBrowserStatus(
              'Notifications were denied. You can allow them later in your browser site settings.'
            );
          } else {
            setNotifyBrowserStatus('Permission was not granted.');
          }
        }
      });
    });
  }

  function persistNotifyPushToServer(enabled) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || typeof window.apiPut !== 'function') return Promise.resolve();
    return window
      .apiPut('/users/' + u.id, { notifyPush: !!enabled })
      .then(function (res) {
        if (!res.ok) return;
        return res.json().then(function (body) {
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
        });
      })
      .catch(function () {});
  }

  bindCheckbox(profilePublic, PRIVACY_PUBLIC_KEY);
  bindCheckbox(showActivity, PRIVACY_ACTIVITY_KEY);

  if (reminderEnabledEl) {
    reminderEnabledEl.addEventListener('change', function () {
      saveReminderScheduleFromForm();
      updateReminderScheduleVisibility();
    });
  }
  if (reminderTimeEl) {
    reminderTimeEl.addEventListener('change', saveReminderScheduleFromForm);
  }
  if (reminderFreqEl) {
    reminderFreqEl.addEventListener('change', function () {
      saveReminderScheduleFromForm();
      updateReminderScheduleVisibility();
    });
  }
  document.querySelectorAll('.settings-reminder-day').forEach(function (cb) {
    cb.addEventListener('change', saveReminderScheduleFromForm);
  });

  if (favoritesTextarea) {
    favoritesTextarea.addEventListener('change', function () {
      try {
        localStorage.setItem(FAVORITES_KEY, favoritesTextarea.value.trim().slice(0, 2000));
      } catch (e) {}
    });
  }

  if (anythingElseTextarea) {
    anythingElseTextarea.addEventListener('change', function () {
      try {
        localStorage.setItem(ANYTHING_ELSE_KEY, anythingElseTextarea.value.trim().slice(0, 4000));
      } catch (e) {}
      persistCoachNotesToServer();
    });
  }

  (function initAccountDeletionSettings() {
    var dialog = document.getElementById('home-settings-dialog');
    if (!dialog || dialog.querySelector('#settings-account-delete-send')) return;
    var body = dialog.querySelector('.home-settings-body');
    if (!body) return;
    var footerSection = body.querySelector('.home-settings-section--footer');
    var section = document.createElement('section');
    section.className =
      'home-settings-section home-settings-section--danger settings-buddy-card';
    section.setAttribute('aria-labelledby', 'settings-account-delete-heading');
    section.innerHTML =
      '<h3 class="home-settings-section-title" id="settings-account-delete-heading">Delete account</h3>' +
      '<p class="home-settings-hint home-settings-hint--below-title">Permanently delete your account and related server data. We email you a confirmation link — this cannot be undone.</p>' +
      '<button type="button" class="home-settings-danger-btn" id="settings-account-delete-send">Send deletion confirmation email</button>' +
      '<p class="home-settings-delete-status" id="settings-account-delete-status" role="status" aria-live="polite"></p>';

    if (footerSection) body.insertBefore(section, footerSection);
    else body.appendChild(section);

    var sendBtn = document.getElementById('settings-account-delete-send');
    var statusEl = document.getElementById('settings-account-delete-status');

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
        if (!u || !u.id || !u.token) {
          if (statusEl) statusEl.textContent = 'You must be signed in to delete your account.';
          return;
        }
        sendBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Sending confirmation email…';
        if (typeof window.apiPost !== 'function') {
          if (statusEl) statusEl.textContent = 'Cannot reach server.';
          sendBtn.disabled = false;
          return;
        }
        window
          .apiPost('/users/' + encodeURIComponent(String(u.id)) + '/request-account-deletion')
          .then(function (res) {
            return res
              .json()
              .catch(function () {
                return {};
              })
              .then(function (j) {
                if (res.ok) {
                  if (statusEl) {
                    statusEl.textContent =
                      (j && j.message) ||
                      'Check your email for a link to confirm account deletion.';
                  }
                  sendBtn.disabled = false;
                  return;
                }
                var msg =
                  (j && j.error) ||
                  (res.status === 403
                    ? 'You can only delete your own account.'
                    : 'Could not send deletion email.');
                if (statusEl) statusEl.textContent = msg;
                sendBtn.disabled = false;
              });
          })
          .catch(function () {
            if (statusEl) statusEl.textContent = 'Network error. Try again.';
            sendBtn.disabled = false;
          });
      });
    }
  })();

  (function initSettingsHub() {
    var dialog = document.getElementById('home-settings-dialog');
    if (!dialog || dialog.dataset.hubInit === '1') return;
    dialog.dataset.hubInit = '1';
    dialog.classList.add('settings-hub', 'settings-buddy');

    var header = dialog.querySelector('.home-settings-header');
    var title = dialog.querySelector('.home-settings-title');
    if (header && title && !header.querySelector('.settings-hub-brand')) {
      var brand = document.createElement('div');
      brand.className = 'settings-hub-brand';
      brand.innerHTML =
        '<span class="settings-hub-mark" aria-hidden="true">SM</span>' +
        '<div class="settings-hub-brand-text">' +
        '<span class="settings-hub-eyebrow">Strongman AI</span>' +
        '<span class="settings-hub-title-text">Settings</span>' +
        '</div>';
      header.insertBefore(brand, title);
      title.textContent = 'Settings';
      title.classList.add('visually-hidden');
    }

    var body = dialog.querySelector('.home-settings-body');
    if (!body) return;

    if (!body.querySelector('.settings-hub-intro')) {
      var intro = document.createElement('p');
      intro.className = 'settings-hub-intro';
      intro.textContent =
        'Theme, log view, notifications, and app preferences. Equipment, schedule, and goals live in User settings under You.';
      body.insertBefore(intro, body.firstChild);
    }

    if (!body.querySelector('#settings-hub-info-card')) {
      var infoCard = document.createElement('a');
      infoCard.href = '/info';
      infoCard.className = 'settings-hub-training-card settings-hub-info-card';
      infoCard.id = 'settings-hub-info-card';
      infoCard.innerHTML =
        '<span class="settings-hub-training-kicker">Guide</span>' +
        '<span class="settings-hub-training-title">How to use Strongman AI</span>' +
        '<span class="settings-hub-training-desc">Setup steps, tips for Rocky, and where everything lives in the app.</span>' +
        '<span class="settings-hub-training-arrow">Open guide →</span>';
      var introEl = body.querySelector('.settings-hub-intro');
      body.insertBefore(infoCard, introEl ? introEl.nextSibling : body.firstChild);
    }

    var trainingCard = document.getElementById('settings-hub-training-card');
    if (trainingCard) trainingCard.remove();

    ['settings-coach-heading', 'settings-anything-heading', 'settings-account-heading'].forEach(function (id) {
      var heading = document.getElementById(id);
      if (!heading) return;
      var sec = heading.closest('.home-settings-section');
      if (sec) sec.classList.add('settings-hub-section--hidden-workout');
    });

    var injectedAccount = document.querySelector('.settings-account-section');
    if (injectedAccount) injectedAccount.remove();

    var themeRow = body.querySelector('.home-settings-theme-row');
    if (themeRow && !themeRow.querySelector('.settings-theme-card')) {
      themeRow.classList.add('settings-theme-pills');
      themeRow.querySelectorAll('.home-settings-radio-label').forEach(function (lbl) {
        lbl.classList.add('settings-theme-pill');
      });
    } else if (themeRow) {
      themeRow.classList.remove('settings-theme-pills');
    }

    var unitsSection = document.getElementById('settings-units-heading');
    if (unitsSection) {
      var unitsSec = unitsSection.closest('.home-settings-section');
      if (unitsSec) unitsSec.classList.add('settings-buddy-card');
    }

    var appearanceSection = document.getElementById('settings-appearance-heading');
    if (appearanceSection) {
      var appSec = appearanceSection.closest('.home-settings-section');
      if (appSec) appSec.classList.add('settings-buddy-card');
    }

    var notifySection = document.getElementById('settings-notifications-heading');
    if (notifySection) {
      var nSec = notifySection.closest('.home-settings-section');
      if (nSec) nSec.classList.add('settings-buddy-card');
    }

    var privacySection = document.getElementById('settings-privacy-heading');
    if (privacySection) {
      var pSec = privacySection.closest('.home-settings-section');
      if (pSec) pSec.classList.add('settings-buddy-card');
    }

    var aboutHeadingForCard = document.getElementById('settings-about-heading');
    if (aboutHeadingForCard) {
      var aboutCardSec = aboutHeadingForCard.closest('.home-settings-section');
      if (aboutCardSec) aboutCardSec.classList.add('settings-buddy-card');
    }

    if (!document.getElementById('settings-experimental-mode')) {
      var labsSection = document.createElement('section');
      labsSection.className =
        'home-settings-section settings-buddy-card settings-hub-labs';
      labsSection.setAttribute('aria-labelledby', 'settings-labs-heading');
      labsSection.innerHTML =
        '<h3 class="home-settings-section-title" id="settings-labs-heading">' +
        'Labs <span class="settings-hub-labs-badge">Beta</span></h3>' +
        '<div class="settings-hub-toggle-row">' +
        '<div class="settings-hub-toggle-copy">' +
        '<span class="settings-hub-toggle-label">Experimental mode</span>' +
        '<span class="settings-hub-toggle-hint">Try in-progress features before they ship. May change or break without notice.</span>' +
        '</div>' +
        '<label class="settings-hub-switch" aria-label="Enable experimental mode">' +
        '<input type="checkbox" id="settings-experimental-mode" class="home-settings-checkbox">' +
        '<span class="settings-hub-switch-track" aria-hidden="true"></span>' +
        '</label>' +
        '</div>';

      var aboutHeading = document.getElementById('settings-about-heading');
      var aboutSec = aboutHeading && aboutHeading.closest('.home-settings-section');
      if (aboutSec && aboutSec.parentNode) {
        aboutSec.parentNode.insertBefore(labsSection, aboutSec);
      } else {
        body.appendChild(labsSection);
      }
    }

    loadExperimentalToggle();

    var legacyWorkoutRest = document.getElementById('settings-workout-auto-rest');
    if (legacyWorkoutRest) {
      var legacySec = legacyWorkoutRest.closest('.home-settings-section');
      if (legacySec && legacySec.parentNode) legacySec.parentNode.removeChild(legacySec);
    }

    if (!body.querySelector('#settings-hub-versions-card')) {
      var currentSlug =
        (window.VERSION_CATALOG && window.VERSION_CATALOG.current) || 'v1.3';
      var currentRelease =
        window.VERSION_CATALOG && typeof window.VERSION_CATALOG.get === 'function'
          ? window.VERSION_CATALOG.get(currentSlug)
          : null;
      var versionsCard = document.createElement('a');
      versionsCard.href = '/versions/' + encodeURIComponent(currentSlug);
      versionsCard.className = 'settings-hub-training-card settings-hub-info-card';
      versionsCard.id = 'settings-hub-versions-card';
      versionsCard.innerHTML =
        '<span class="settings-hub-training-kicker">' +
        currentSlug +
        ' · Patch notes</span>' +
        '<span class="settings-hub-training-title">Version history</span>' +
        '<span class="settings-hub-training-desc">' +
        (currentRelease && currentRelease.summary
          ? currentRelease.summary
          : 'Download page, progressive-overload docs, modernized Settings, and marketing polish.') +
        '</span>' +
        '<span class="settings-hub-training-arrow">Read ' +
        currentSlug +
        ' notes →</span>';
      var aboutHeading = document.getElementById('settings-about-heading');
      var aboutSec = aboutHeading && aboutHeading.closest('.home-settings-section');
      if (aboutSec && aboutSec.parentNode) {
        aboutSec.parentNode.insertBefore(versionsCard, aboutSec);
      } else {
        body.appendChild(versionsCard);
      }
    }

    var aboutLinks = document.querySelector(
      '#settings-about-heading'
    );
    if (aboutLinks) {
      aboutLinks = aboutLinks.closest('.home-settings-section');
      if (aboutLinks) aboutLinks = aboutLinks.querySelector('.home-settings-inline-links');
    }
    if (aboutLinks && !aboutLinks.querySelector('a[href="/versions"]')) {
      var sep = document.createElement('span');
      sep.className = 'home-settings-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '·';
      var patchLink = document.createElement('a');
      patchLink.href = '/versions';
      patchLink.className = 'home-settings-inline-link';
      patchLink.textContent = 'Patch notes';
      aboutLinks.appendChild(sep);
      aboutLinks.appendChild(patchLink);
    }

    var aboutMeta = body.querySelector('.home-settings-meta');
    if (aboutMeta) {
      aboutMeta.textContent =
        'Strongman AI ' +
        ((window.VERSION_CATALOG && window.VERSION_CATALOG.current) || 'v1.3');
    }

    var lede = body.querySelector('.settings-buddy-lede');
    if (lede) lede.remove();
  })();

  window.strongmanNotifyPrefs = {
    emailRemindersEnabled: function () {
      return isEmailNotificationsEnabled();
    },
    browserRemindersEnabled: function () {
      return browserNotificationsReady();
    },
    reminderScheduleEnabled: function () {
      return loadReminderSchedule().enabled;
    },
    getReminderSchedule: function () {
      return loadReminderSchedule();
    },
  };

  /* Align to each wall-clock minute so background-tab timer throttling (~1/min) still hits the scheduled minute. Fully suspended tabs need Web Push or a native app. */
  (function scheduleReminderMinuteTicks() {
    function arm() {
      var now = new Date();
      var msInto = now.getSeconds() * 1000 + now.getMilliseconds();
      var delay = 60000 - msInto;
      if (delay <= 0) delay += 60000;
      setTimeout(function () {
        maybeFireScheduledReminder();
        setInterval(maybeFireScheduledReminder, 60000);
      }, delay);
    }
    arm();
  })();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) maybeFireScheduledReminder();
  });
  maybeFireScheduledReminder();
})();
