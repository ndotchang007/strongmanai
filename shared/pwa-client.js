(function () {
  'use strict';

  var INSTALL_DISMISS_KEY = 'strongman_pwa_install_dismissed';
  var LANDING_PATHS = [
    '/',
    '/about',
    '/download',
    '/legal',
    '/leaderboards',
    '/blog',
    '/surveys',
    '/versions',
    '/explore',
  ];
  var deferredInstallPrompt = null;
  var swRegistration = null;
  var updatePollTimer = null;

  function normalizePath(path) {
    var p = path || '/';
    if (p.length > 1 && p.slice(-1) === '/') p = p.slice(0, -1);
    return p || '/';
  }

  function currentPath() {
    return normalizePath(window.location.pathname || '/');
  }

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator && window.navigator.standalone) return true;
    } catch (e) {}
    return false;
  }

  function isLandingPath(path) {
    path = normalizePath(path);
    if (path === '/login' || path === '/signup' || path === '/verify-email') return false;
    if (path === '/index.html' || path === '/login.html') return false;
    var i;
    for (i = 0; i < LANDING_PATHS.length; i++) {
      if (path === LANDING_PATHS[i]) return true;
    }
    if (/^\/blog\//.test(path)) return true;
    if (/^\/survey\//.test(path)) return true;
    if (/^\/versions\//.test(path)) return true;
    return false;
  }

  function ensureManifestLink() {
    if (document.querySelector('link[rel="manifest"]')) return;
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
  }

  function ensureThemeMeta() {
    if (document.querySelector('meta[name="theme-color"]')) return;
    var meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#ff4d0d';
    document.head.appendChild(meta);
  }

  function enforceStandaloneEntry() {
    if (!isStandalone()) return;
    document.documentElement.classList.add('pwa-standalone');
    var path = currentPath();
    if (isLandingPath(path)) {
      try {
        window.location.replace('/login');
      } catch (e) {
        window.location.href = '/login';
      }
    }
  }

  function isWorkoutActive() {
    try {
      if (window.WorkoutSession && typeof window.WorkoutSession.loadSession === 'function') {
        var session = window.WorkoutSession.loadSession();
        if (session && session.status === 'active') return true;
      }
      var prefix = 'strongman_workout_session_v1';
      var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var suffix = u && u.id != null ? '_u' + u.id : '_guest';
      var raw = localStorage.getItem(prefix + suffix);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.status === 'active') return true;
      }
    } catch (e) {}
    return false;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (reg) {
        swRegistration = reg;
        listenForWaitingWorker(reg);
        scheduleUpdateCheck(reg);
        return reg;
      })
      .catch(function (err) {
        console.warn('[pwa] service worker registration failed', err);
        return null;
      });
  }

  function applyWaitingUpdate() {
    if (!swRegistration || !swRegistration.waiting) return;
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function listenForWaitingWorker(reg) {
    if (!reg) return;
    if (reg.waiting) maybeApplyUpdate(reg);
    reg.addEventListener('updatefound', function () {
      var installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          maybeApplyUpdate(reg);
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (sessionStorage.getItem('strongman_pwa_reload_pending') === '1') {
        sessionStorage.removeItem('strongman_pwa_reload_pending');
        window.location.reload();
      }
    });
  }

  function maybeApplyUpdate(reg) {
    if (!reg || !reg.waiting) return;
    if (isWorkoutActive()) {
      window.setTimeout(function () {
        maybeApplyUpdate(reg);
      }, 15000);
      return;
    }
    sessionStorage.setItem('strongman_pwa_reload_pending', '1');
    applyWaitingUpdate();
  }

  function scheduleUpdateCheck(reg) {
    if (updatePollTimer) clearInterval(updatePollTimer);
    updatePollTimer = window.setInterval(function () {
      if (reg && typeof reg.update === 'function') reg.update();
    }, 60 * 60 * 1000);
  }

  function syncWhenOnline() {
    if (!navigator.onLine) return;
    if (window.TrainingSync && typeof window.TrainingSync.bootSync === 'function') {
      window.TrainingSync.bootSync();
    }
    if (window.WorkoutLog && typeof window.WorkoutLog.hydrateStoreForCurrentUser === 'function') {
      window.WorkoutLog.hydrateStoreForCurrentUser();
    }
  }

  function bindAutoSync() {
    window.addEventListener('online', syncWhenOnline);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') syncWhenOnline();
    });
    window.addEventListener('strongman:user-updated', syncWhenOnline);
    window.addEventListener('strongman:training-synced', function () {
      try {
        window.dispatchEvent(new CustomEvent('strongman:offline-data-ready'));
      } catch (e) {}
    });
  }

  function installDismissed() {
    try {
      return localStorage.getItem(INSTALL_DISMISS_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function dismissInstallBanner() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    } catch (e) {}
    hideInstallBanner();
  }

  function hideInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.hidden = true;
  }

  function showInstallBanner() {
    if (isStandalone() || installDismissed() || !deferredInstallPrompt) return;
    var banner = document.getElementById('pwa-install-banner');
    if (!banner) return;
    banner.hidden = false;
  }

  function bindInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (!banner) return;
    var installBtn = document.getElementById('pwa-install-btn');
    var dismissBtn = document.getElementById('pwa-install-dismiss');
    var closeBtn = document.getElementById('pwa-install-close');

    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') hideInstallBanner();
          deferredInstallPrompt = null;
        });
      });
    }
    if (dismissBtn) dismissBtn.addEventListener('click', dismissInstallBanner);
    if (closeBtn) closeBtn.addEventListener('click', hideInstallBanner);

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      showInstallBanner();
    });

    showInstallBanner();
  }

  function polishStandaloneLogin() {
    if (!isStandalone()) return;
    document.body.classList.add('auth-standalone');
    var homeLink = document.querySelector('.auth-home');
    if (homeLink) {
      homeLink.removeAttribute('href');
      homeLink.style.cursor = 'default';
    }
  }

  function maybePromptForNotifications() {
    if (!isStandalone()) return;
    if (!window.isLoggedIn || !window.isLoggedIn()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem('strongman_pwa_notify_prompted') === '1') return;
    try {
      localStorage.setItem('strongman_pwa_notify_prompted', '1');
    } catch (e) {}
    window.setTimeout(function () {
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') return;
        try {
          localStorage.setItem('strongman-home-notify-push', '1');
        } catch (e2) {}
        if (window.StrongmanPush && typeof window.StrongmanPush.subscribe === 'function') {
          window.StrongmanPush.subscribe();
        }
        var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
        if (u && u.id && typeof window.apiPut === 'function') {
          window.apiPut('/users/' + u.id, { notifyPush: true }).catch(function () {});
        }
      });
    }, 1200);
  }

  function boot() {
    ensureManifestLink();
    ensureThemeMeta();
    enforceStandaloneEntry();
    polishStandaloneLogin();
    bindAutoSync();
    registerServiceWorker().then(function () {
      syncWhenOnline();
      maybePromptForNotifications();
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindInstallBanner);
    } else {
      bindInstallBanner();
    }
  }

  window.StrongmanPWA = {
    isStandalone: isStandalone,
    isWorkoutActive: isWorkoutActive,
    registerServiceWorker: registerServiceWorker,
    syncWhenOnline: syncWhenOnline,
    showInstallBanner: showInstallBanner,
    dismissInstallBanner: dismissInstallBanner,
  };

  boot();
})();
