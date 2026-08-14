(function () {
  var POLL_MS = 45000;
  var root = null;
  var btn = null;
  var panel = null;
  var badge = null;
  var listEl = null;
  var emptyEl = null;
  var countEl = null;
  var invites = [];
  var pollId = null;
  var open = false;
  var busyId = null;
  var lastKnownInviteIds = null;

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  function canUse() {
    return !!(window.isLoggedIn && window.isLoggedIn() && window.apiGet);
  }

  function setOpen(next) {
    open = !!next;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.hidden = !open;
  }

  function setBadgeCount(n) {
    var num = Math.max(0, Number(n) || 0);
    if (!badge) return;
    if (num <= 0) {
      badge.hidden = true;
      badge.textContent = '';
      return;
    }
    badge.hidden = false;
    badge.textContent = num > 9 ? '9+' : String(num);
  }

  function renderPanel() {
    if (!listEl || !emptyEl || !countEl) return;
    countEl.textContent = invites.length ? invites.length + ' pending' : 'None';
    listEl.innerHTML = '';

    if (!invites.length) {
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    invites.forEach(function (inv) {
      var li = document.createElement('li');
      li.className = 'notif-bell-item';
      li.setAttribute('data-comp-id', String(inv.competitionId || inv.id || ''));

      var title = document.createElement('p');
      title.className = 'notif-bell-item-title';
      title.textContent = inv.goalTitle || 'Competition invite';

      var meta = document.createElement('p');
      meta.className = 'notif-bell-item-meta';
      var from = inv.fromUsername || 'Someone';
      var goal = inv.weightGoalLb != null ? String(inv.weightGoalLb) + ' lb goal' : '';
      var end = inv.endDate ? ' · ends ' + inv.endDate : '';
      meta.textContent = from + ' challenged you' + (goal ? ' · ' + goal : '') + end;

      var actions = document.createElement('div');
      actions.className = 'notif-bell-item-actions';

      var accept = document.createElement('button');
      accept.type = 'button';
      accept.className = 'notif-bell-action notif-bell-action--accept';
      accept.textContent = 'Accept';
      accept.setAttribute('data-action', 'accept');

      var decline = document.createElement('button');
      decline.type = 'button';
      decline.className = 'notif-bell-action';
      decline.textContent = 'Decline';
      decline.setAttribute('data-action', 'decline');

      actions.appendChild(accept);
      actions.appendChild(decline);
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }

  function dispatchUpdated() {
    try {
      window.dispatchEvent(new CustomEvent('strongman:competitions-updated'));
    } catch (e) {}
  }

  function maybeNotifyNewInvites(nextInvites) {
    var ids = (nextInvites || []).map(function (inv) {
      return String(inv.competitionId || inv.id || '');
    }).filter(Boolean);
    if (lastKnownInviteIds == null) {
      lastKnownInviteIds = ids;
      return;
    }
    var prev = {};
    lastKnownInviteIds.forEach(function (id) {
      prev[id] = true;
    });
    var fresh = (nextInvites || []).filter(function (inv) {
      var id = String(inv.competitionId || inv.id || '');
      return id && !prev[id];
    });
    lastKnownInviteIds = ids;
    if (!fresh.length) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (localStorage.getItem('strongman-home-notify-push') !== '1') return;
    fresh.slice(0, 3).forEach(function (inv) {
      try {
        var n = new Notification('New competition invite', {
          body:
            (inv.fromUsername || 'Someone') +
            ' challenged you' +
            (inv.goalTitle ? ': ' + inv.goalTitle : ''),
          tag: 'competition-invite-' + String(inv.competitionId || inv.id || ''),
          data: { url: '/leaderboard' },
        });
        n.onclick = function () {
          try {
            window.focus();
            window.location.href = '/leaderboard';
          } catch (e) {}
          n.close();
        };
      } catch (e) {}
    });
  }

  function fetchInvites() {
    if (!canUse()) {
      invites = [];
      setBadgeCount(0);
      if (root) root.hidden = true;
      return Promise.resolve([]);
    }
    if (root) root.hidden = false;
    return window
      .apiGet('/competitions/notifications')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        invites = Array.isArray(data && data.invites) ? data.invites : [];
        setBadgeCount(data && data.count != null ? data.count : invites.length);
        maybeNotifyNewInvites(invites);
        if (open) renderPanel();
        return invites;
      })
      .catch(function () {
        return invites;
      });
  }

  function handleInviteAction(compId, action) {
    if (!compId || !window.apiPost || busyId) return;
    busyId = compId;
    var path = '/competitions/' + encodeURIComponent(String(compId)) + '/' + action;
    window
      .apiPost(path, {})
      .then(function (res) {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then(function () {
        invites = invites.filter(function (inv) {
          return String(inv.competitionId || inv.id) !== String(compId);
        });
        setBadgeCount(invites.length);
        renderPanel();
        if (window.competitionsStoreSync) {
          return window.competitionsStoreSync();
        }
      })
      .then(function () {
        dispatchUpdated();
      })
      .catch(function () {})
      .then(function () {
        busyId = null;
        fetchInvites();
      });
  }

  function onDocumentClick(e) {
    if (!open || !root) return;
    if (root.contains(e.target)) return;
    setOpen(false);
  }

  function onPanelClick(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var action = t.getAttribute('data-action');
    if (!action) return;
    var item = t.closest('.notif-bell-item');
    var compId = item && item.getAttribute('data-comp-id');
    if (!compId) return;
    e.preventDefault();
    handleInviteAction(compId, action);
  }

  function startPolling() {
    stopPolling();
    fetchInvites();
    pollId = setInterval(fetchInvites, POLL_MS);
  }

  function stopPolling() {
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  }

  function syncVisibility() {
    if (!root) return;
    if (!canUse()) {
      root.hidden = true;
      setOpen(false);
      invites = [];
      setBadgeCount(0);
      stopPolling();
      return;
    }
    root.hidden = false;
    startPolling();
  }

  function buildDom() {
    if (document.getElementById('notif-bell-root')) return;
    root = document.createElement('div');
    root.id = 'notif-bell-root';
    root.className = 'notif-bell-root';
    root.hidden = true;
    root.innerHTML =
      '<button type="button" class="notif-bell-btn" id="notif-bell-btn" aria-label="Notifications" aria-expanded="false" aria-haspopup="true" aria-controls="notif-bell-panel">' +
      '<svg class="notif-bell-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3a5.5 5.5 0 0 0-5.5 5.5v2.1c0 .9-.3 1.8-.9 2.5L4.2 15.8A1.2 1.2 0 0 0 5.3 18h13.4a1.2 1.2 0 0 0 1.1-1.7l-1.4-2.7a4.2 4.2 0 0 1-.9-2.5V8.5A5.5 5.5 0 0 0 12 3z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>' +
      '<path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
      '</svg>' +
      '<span class="notif-bell-badge" id="notif-bell-badge" hidden></span>' +
      '</button>' +
      '<div class="notif-bell-panel" id="notif-bell-panel" hidden role="region" aria-label="Competition invites">' +
      '<div class="notif-bell-panel-head">' +
      '<h2 class="notif-bell-panel-title">Invites</h2>' +
      '<span class="notif-bell-panel-count" id="notif-bell-panel-count">None</span>' +
      '</div>' +
      '<p class="notif-bell-empty" id="notif-bell-empty">No pending competition invites.</p>' +
      '<ul class="notif-bell-list" id="notif-bell-list"></ul>' +
      '</div>';

    // Dock into the page header tools when the page has one, so the bell sits
    // beside the settings button instead of floating over the content.
    var tools = document.querySelector('.dash-plan-tools');
    if (tools) {
      tools.appendChild(root);
    } else {
      document.body.appendChild(root);
    }

    btn = document.getElementById('notif-bell-btn');
    panel = document.getElementById('notif-bell-panel');
    badge = document.getElementById('notif-bell-badge');
    listEl = document.getElementById('notif-bell-list');
    emptyEl = document.getElementById('notif-bell-empty');
    countEl = document.getElementById('notif-bell-panel-count');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!open) {
        fetchInvites().then(function () {
          renderPanel();
          setOpen(true);
        });
      } else {
        setOpen(false);
      }
    });

    panel.addEventListener('click', onPanelClick);
    document.addEventListener('click', onDocumentClick);
    window.addEventListener('strongman:user-updated', syncVisibility);
    window.addEventListener('strongman:competitions-updated', fetchInvites);
  }

  function init() {
    buildDom();
    syncVisibility();
  }

  window.NotificationBell = {
    init: init,
    refresh: fetchInvites,
    syncVisibility: syncVisibility
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
