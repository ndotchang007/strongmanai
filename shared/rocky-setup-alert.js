(function () {
  'use strict';

  var DISMISS_KEY = 'strongman-rocky-sport-dismissed';

  function needsSportsSetup(user) {
    if (!window.AthleteContext) return true;
    if (typeof window.AthleteContext.needsGlobalSportsSetup === 'function') {
      if (window.AthleteContext.needsGlobalSportsSetup(user)) return true;
    }
    if (typeof window.AthleteContext.needsScheduleSetup === 'function') {
      return window.AthleteContext.needsScheduleSetup(user);
    }
    if (typeof window.AthleteContext.hasNullSportFieldValue === 'function') {
      return window.AthleteContext.hasNullSportFieldValue(user);
    }
    return true;
  }

  function getDismissedKeys() {
    try {
      var raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function dismissSportAlert(sportKey) {
    if (!sportKey) return;
    var keys = getDismissedKeys();
    if (keys.indexOf(sportKey) < 0) keys.push(sportKey);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(keys));
    } catch (e) {}
    renderSportAlerts();
  }

  function renderGlobalAlerts(show) {
    document.querySelectorAll('[data-rocky-setup-alert]').forEach(function (el) {
      el.hidden = !show;
    });
  }

  function renderSportAlerts() {
    var mounts = document.querySelectorAll('[data-rocky-sport-alerts]');
    if (!mounts.length || !window.AthleteContext) return;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var issues =
      typeof window.AthleteContext.getSportsWithSetupIssues === 'function'
        ? window.AthleteContext.getSportsWithSetupIssues(user)
        : [];
    var dismissed = getDismissedKeys();

    mounts.forEach(function (mount) {
      mount.innerHTML = '';
      issues.forEach(function (item) {
        if (dismissed.indexOf(item.key) >= 0) return;
        var alert = document.createElement('div');
        alert.className = 'dash-rocky-setup-alert rocky-sport-setup-alert';
        alert.setAttribute('role', 'alert');
        alert.setAttribute('data-sport-key', item.key);

        var mark = document.createElement('span');
        mark.className = 'dash-rocky-setup-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = 'R';

        var copy = document.createElement('div');
        copy.className = 'dash-rocky-setup-copy';

        var title = document.createElement('p');
        title.className = 'dash-rocky-setup-title';
        title.textContent = item.sport + ' needs a few details';

        var text = document.createElement('p');
        text.className = 'dash-rocky-setup-text';
        text.textContent =
          'Missing: ' +
          item.issues.join(', ') +
          '. Edit the sport card below so Rocky can plan around your real schedule.';

        var actions = document.createElement('div');
        actions.className = 'rocky-sport-alert-actions';

        var ignoreBtn = document.createElement('button');
        ignoreBtn.type = 'button';
        ignoreBtn.className = 'rocky-sport-alert-ignore';
        ignoreBtn.textContent = 'Ignore for now';
        ignoreBtn.addEventListener('click', function () {
          dismissSportAlert(item.key);
        });

        actions.appendChild(ignoreBtn);
        copy.appendChild(title);
        copy.appendChild(text);
        copy.appendChild(actions);
        alert.appendChild(mark);
        alert.appendChild(copy);
        mount.appendChild(alert);
      });
      mount.hidden = mount.children.length === 0;
    });
  }

  function renderAll() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    renderGlobalAlerts(needsSportsSetup(user));
    renderSportAlerts();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-rocky-sport-dismiss]') : null;
    if (!btn) return;
    dismissSportAlert(btn.getAttribute('data-rocky-sport-dismiss'));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }

  window.addEventListener('storage', function (e) {
    if (e.key && (e.key.indexOf('athlete') !== -1 || e.key.indexOf('strongman_user') !== -1)) {
      renderAll();
    }
    if (e.key === DISMISS_KEY) renderSportAlerts();
  });

  window.addEventListener('strongman:user-updated', renderAll);

  window.RockySetupAlert = {
    needsSportsSetup: needsSportsSetup,
    renderAll: renderAll,
    dismissSportAlert: dismissSportAlert,
  };
})();
