/**
 * In-app notification inbox (bell panel) — local only, no browser push.
 */
(function () {
  'use strict';

  var STORE_KEY = 'strongman_app_notifications_v1';
  var DISMISS_DOWNLOAD_KEY = 'strongman_app_download_notif_dismissed';

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveStore(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list || []));
    } catch (e) {}
  }

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator && window.navigator.standalone) return true;
    } catch (e) {}
    return false;
  }

  function listActive() {
    return loadStore().filter(function (n) {
      return n && !n.dismissed;
    });
  }

  function upsert(notif) {
    if (!notif || !notif.id) return null;
    var list = loadStore();
    var idx = list.findIndex(function (n) {
      return n && n.id === notif.id;
    });
    var row = Object.assign(
      {
        dismissed: false,
        createdAt: new Date().toISOString(),
      },
      idx >= 0 ? list[idx] : {},
      notif
    );
    if (idx >= 0) list[idx] = row;
    else list.unshift(row);
    saveStore(list);
    try {
      window.dispatchEvent(new CustomEvent('strongman:app-notifications-updated'));
    } catch (e) {}
    return row;
  }

  function dismiss(id) {
    if (!id) return;
    var list = loadStore();
    var changed = false;
    list.forEach(function (n) {
      if (n && n.id === id && !n.dismissed) {
        n.dismissed = true;
        changed = true;
      }
    });
    if (changed) {
      saveStore(list);
      try {
        window.dispatchEvent(new CustomEvent('strongman:app-notifications-updated'));
      } catch (e2) {}
    }
  }

  function ensureDownloadPrompt() {
    if (isStandalone()) return null;
    try {
      if (localStorage.getItem(DISMISS_DOWNLOAD_KEY) === '1') return null;
    } catch (e) {}
    return upsert({
      id: 'download-app',
      kind: 'download',
      title: 'Install Strongman AI',
      body: 'Add the app to your home screen for faster launch and offline stats on this device.',
      url: '/download',
      actionLabel: 'Download app',
      dismissLabel: 'Dismiss',
    });
  }

  function dismissDownloadPrompt() {
    try {
      localStorage.setItem(DISMISS_DOWNLOAD_KEY, '1');
    } catch (e) {}
    dismiss('download-app');
  }

  window.StrongmanAppNotifications = {
    listActive: listActive,
    upsert: upsert,
    dismiss: dismiss,
    ensureDownloadPrompt: ensureDownloadPrompt,
    dismissDownloadPrompt: dismissDownloadPrompt,
  };
})();
