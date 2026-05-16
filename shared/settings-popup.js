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

  function getStoredTheme() {
    var v = localStorage.getItem(THEME_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
    return 'dark';
  }

  function getEffectiveTheme() {
    var stored = getStoredTheme();
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return stored;
  }

  function applyDocumentTheme() {
    document.documentElement.setAttribute('data-theme', getEffectiveTheme());
  }

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
  var settingsBackdrop = document.getElementById('home-settings-backdrop');
  var settingsDialog = document.getElementById('home-settings-dialog');
  var settingsClose = document.getElementById('home-settings-close');
  var themeRadios = document.querySelectorAll('input[name="home-theme"]');
  var unitsSelect = document.getElementById('settings-units-select');
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
      var u = localStorage.getItem(UNITS_KEY);
      unitsSelect.value = u === 'metric' ? 'metric' : 'imperial';
    }
    if (notifyEmail) notifyEmail.checked = localStorage.getItem(NOTIFY_EMAIL_KEY) === '1';
    if (notifyPush) notifyPush.checked = localStorage.getItem(NOTIFY_PUSH_KEY) === '1';
    if (profilePublic) profilePublic.checked = localStorage.getItem(PRIVACY_PUBLIC_KEY) !== '0';
    if (showActivity) showActivity.checked = localStorage.getItem(PRIVACY_ACTIVITY_KEY) !== '0';
    reconcileBrowserNotificationsUI();
    loadReminderScheduleIntoForm();
    if (favoritesTextarea) {
      favoritesTextarea.value = localStorage.getItem(FAVORITES_KEY) || '';
    }
    if (anythingElseTextarea) {
      anythingElseTextarea.value = localStorage.getItem(ANYTHING_ELSE_KEY) || '';
    }
  }

  setThemeRadioFromStorage();
  loadOtherPrefs();

  function openSettings() {
    if (!settingsBackdrop || !settingsDialog || !settingsTrigger) return;
    setThemeRadioFromStorage();
    loadOtherPrefs();
    var delConfirm = document.getElementById('settings-account-delete-confirm');
    var delInput = document.getElementById('settings-account-delete-input');
    var delSubmit = document.getElementById('settings-account-delete-submit');
    var delStatus = document.getElementById('settings-account-delete-status');
    if (delConfirm) delConfirm.hidden = true;
    if (delInput) delInput.value = '';
    if (delSubmit) delSubmit.disabled = true;
    if (delStatus) delStatus.textContent = '';
    settingsBackdrop.classList.add('is-open');
    settingsDialog.classList.add('is-open');
    settingsBackdrop.setAttribute('aria-hidden', 'false');
    settingsDialog.setAttribute('aria-hidden', 'false');
    settingsTrigger.setAttribute('aria-expanded', 'true');
    if (settingsClose) settingsClose.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    if (!settingsBackdrop || !settingsDialog || !settingsTrigger) return;
    if (favoritesTextarea) {
      try {
        localStorage.setItem(FAVORITES_KEY, favoritesTextarea.value.trim().slice(0, 2000));
      } catch (e) {}
    }
    if (anythingElseTextarea) {
      try {
        localStorage.setItem(ANYTHING_ELSE_KEY, anythingElseTextarea.value.trim().slice(0, 4000));
      } catch (e) {}
    }
    settingsBackdrop.classList.remove('is-open');
    settingsDialog.classList.remove('is-open');
    settingsBackdrop.setAttribute('aria-hidden', 'true');
    settingsDialog.setAttribute('aria-hidden', 'true');
    settingsTrigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    settingsTrigger.focus();
  }

  if (settingsTrigger) {
    settingsTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      openSettings();
    });
  }
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

  themeRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!this.checked) return;
      localStorage.setItem(THEME_KEY, this.value);
      applyDocumentTheme();
    });
  });

  if (unitsSelect) {
    unitsSelect.addEventListener('change', function () {
      localStorage.setItem(UNITS_KEY, unitsSelect.value);
    });
  }

  function bindCheckbox(el, key) {
    if (!el) return;
    el.addEventListener('change', function () {
      localStorage.setItem(key, el.checked ? '1' : '0');
    });
  }

  bindCheckbox(notifyEmail, NOTIFY_EMAIL_KEY);

  if (notifyPush) {
    notifyPush.addEventListener('change', function () {
      if (!notifyPush.checked) {
        localStorage.setItem(NOTIFY_PUSH_KEY, '0');
        reconcileBrowserNotificationsUI();
        return;
      }
      if (!('Notification' in window)) {
        notifyPush.checked = false;
        localStorage.setItem(NOTIFY_PUSH_KEY, '0');
        return;
      }
      if (Notification.permission === 'granted') {
        localStorage.setItem(NOTIFY_PUSH_KEY, '1');
        setNotifyBrowserStatus('');
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
          localStorage.setItem(NOTIFY_PUSH_KEY, '1');
          setNotifyBrowserStatus('');
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
    });
  }

  (function initAccountDeletionSettings() {
    var dialog = document.getElementById('home-settings-dialog');
    if (!dialog || dialog.querySelector('#settings-account-delete-open')) return;
    var body = dialog.querySelector('.home-settings-body');
    if (!body) return;
    var footerSection = body.querySelector('.home-settings-section--footer');
    var section = document.createElement('section');
    section.className = 'home-settings-section home-settings-section--danger';
    section.setAttribute('aria-labelledby', 'settings-account-delete-heading');
    section.innerHTML =
      '<h3 class="home-settings-section-title" id="settings-account-delete-heading">Delete account</h3>' +
      '<p class="home-settings-hint home-settings-hint--below-title">Permanently delete your account and related server data. This cannot be undone.</p>' +
      '<button type="button" class="home-settings-danger-btn" id="settings-account-delete-open">Request account deletion…</button>' +
      '<div class="home-settings-delete-confirm" id="settings-account-delete-confirm" hidden>' +
      '<p class="home-settings-hint home-settings-hint--tight">Type <strong>DELETE</strong> to confirm.</p>' +
      '<label class="home-settings-field-label" for="settings-account-delete-input">Confirmation</label>' +
      '<input type="text" id="settings-account-delete-input" class="home-settings-time-input" autocomplete="off" aria-label="Type DELETE to confirm account deletion">' +
      '<div class="home-settings-delete-actions">' +
      '<button type="button" class="home-settings-danger-btn home-settings-danger-btn--solid" id="settings-account-delete-submit" disabled>Delete my account</button>' +
      '<button type="button" class="home-settings-inline-btn" id="settings-account-delete-cancel">Cancel</button>' +
      '</div>' +
      '<p class="home-settings-delete-status" id="settings-account-delete-status" role="status" aria-live="polite"></p>' +
      '</div>';

    if (footerSection) body.insertBefore(section, footerSection);
    else body.appendChild(section);

    var openBtn = document.getElementById('settings-account-delete-open');
    var confirmWrap = document.getElementById('settings-account-delete-confirm');
    var cancelBtn = document.getElementById('settings-account-delete-cancel');
    var inputEl = document.getElementById('settings-account-delete-input');
    var submitBtn = document.getElementById('settings-account-delete-submit');
    var statusEl = document.getElementById('settings-account-delete-status');

    function resetConfirm() {
      if (confirmWrap) confirmWrap.hidden = true;
      if (inputEl) inputEl.value = '';
      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) statusEl.textContent = '';
    }

    if (openBtn && confirmWrap) {
      openBtn.addEventListener('click', function () {
        var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
        if (!u || !u.id) {
          if (statusEl) statusEl.textContent = 'You must be signed in to delete your account.';
          return;
        }
        if (statusEl) statusEl.textContent = '';
        confirmWrap.hidden = false;
        if (inputEl) inputEl.focus();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        resetConfirm();
      });
    }

    if (inputEl && submitBtn) {
      inputEl.addEventListener('input', function () {
        var ok = inputEl.value.trim().toUpperCase() === 'DELETE';
        submitBtn.disabled = !ok;
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
        if (!u || !u.id || !u.token) {
          if (statusEl) statusEl.textContent = 'Not signed in.';
          return;
        }
        if (inputEl && inputEl.value.trim().toUpperCase() !== 'DELETE') return;
        submitBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Deleting…';
        if (typeof window.apiDelete !== 'function') {
          if (statusEl) statusEl.textContent = 'Cannot reach server.';
          submitBtn.disabled = false;
          return;
        }
        window
          .apiDelete('/users/' + encodeURIComponent(String(u.id)))
          .then(function (res) {
            if (res.status === 204) {
              if (typeof window.setCurrentUser === 'function') window.setCurrentUser(null);
              try {
                window.location.href = '/';
              } catch (e2) {}
              return null;
            }
            return res
              .json()
              .catch(function () {
                return {};
              })
              .then(function (j) {
                var msg =
                  (j && j.error) ||
                  (res.status === 403 ? 'You can only delete your own account.' : 'Could not delete account.');
                if (statusEl) statusEl.textContent = msg;
                submitBtn.disabled = false;
              });
          })
          .catch(function () {
            if (statusEl) statusEl.textContent = 'Network error. Try again.';
            submitBtn.disabled = false;
          });
      });
    }
  })();

  window.strongmanNotifyPrefs = {
    emailRemindersEnabled: function () {
      return localStorage.getItem(NOTIFY_EMAIL_KEY) === '1';
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
