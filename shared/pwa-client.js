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
  var installSheetBound = false;

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

  function isIOS() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
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

  function ensureApplePwaMeta() {
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      var capable = document.createElement('meta');
      capable.name = 'apple-mobile-web-app-capable';
      capable.content = 'yes';
      document.head.appendChild(capable);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      var status = document.createElement('meta');
      status.name = 'apple-mobile-web-app-status-bar-style';
      status.content = 'black-translucent';
      document.head.appendChild(status);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      var title = document.createElement('meta');
      title.name = 'apple-mobile-web-app-title';
      title.content = 'Strongman';
      document.head.appendChild(title);
    }
  }

  function ensureInstallSheetStyles() {
    if (document.querySelector('link[data-pwa-install-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/pwa-install-sheet.css';
    link.setAttribute('data-pwa-install-css', '1');
    document.head.appendChild(link);
  }

  function ensureInstallSheet() {
    ensureInstallSheetStyles();
    var sheet = document.getElementById('pwa-install-sheet');
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = 'pwa-install-sheet';
    sheet.className = 'pwa-install-sheet';
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML =
      '<div class="pwa-install-sheet__backdrop" data-pwa-install-close></div>' +
      '<div class="pwa-install-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">' +
      '<button type="button" class="pwa-install-sheet__close" data-pwa-install-close aria-label="Close">×</button>' +
      '<div class="pwa-install-sheet__icon"><img src="/assets/logo.png" alt="" width="56" height="56" decoding="async"></div>' +
      '<h2 id="pwa-install-title" class="pwa-install-sheet__title">Install Strongman AI</h2>' +
      '<p id="pwa-install-desc" class="pwa-install-sheet__desc"></p>' +
      '<ol id="pwa-install-steps" class="pwa-install-sheet__steps" hidden></ol>' +
      '<div class="pwa-install-sheet__actions">' +
      '<button type="button" id="pwa-install-primary" class="pwa-install-sheet__btn pwa-install-sheet__btn--primary">Install app</button>' +
      '<button type="button" class="pwa-install-sheet__btn pwa-install-sheet__btn--ghost" data-pwa-install-close>Not now</button>' +
      '</div>' +
      '<p id="pwa-install-note" class="pwa-install-sheet__note" hidden></p>' +
      '</div>';
    document.body.appendChild(sheet);

    if (!installSheetBound) {
      installSheetBound = true;
      sheet.addEventListener('click', function (e) {
        if (e.target.closest('[data-pwa-install-close]')) hideInstallSheet();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hideInstallSheet();
      });
      var primary = document.getElementById('pwa-install-primary');
      if (primary) {
        primary.addEventListener('click', function () {
          if (primary.dataset.mode === 'installed') {
            hideInstallSheet();
            window.location.href = '/home';
            return;
          }
          if (deferredInstallPrompt) {
            promptInstall().then(function (accepted) {
              if (accepted) hideInstallSheet();
            });
            return;
          }
          hideInstallSheet();
        });
      }
      document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-pwa-install]');
        if (!trigger) return;
        e.preventDefault();
        handleDownloadAction();
      });
    }

    return sheet;
  }

  function hideInstallSheet() {
    var sheet = document.getElementById('pwa-install-sheet');
    if (!sheet) return;
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function manualInstallMode() {
    if (isIOS()) return 'ios';
    if (isAndroid()) return 'android';
    return 'desktop';
  }

  function manualInstallCopy(mode) {
    if (mode === 'ios') {
      return {
        title: 'Add to Home Screen',
        desc: 'Install Strongman AI on your iPhone or iPad from Safari.',
        steps: [
          'Open this site in Safari (not an in-app browser).',
          'Tap the Share button in the toolbar.',
          'Scroll and tap Add to Home Screen.',
          'Tap Add in the top right corner.',
        ],
        primary: 'Got it',
        note: 'After installing, open Strongman AI from your home screen to sign in.',
      };
    }
    if (mode === 'android') {
      return {
        title: 'Install the app',
        desc: 'Add Strongman AI to your home screen from Chrome.',
        steps: [
          'Tap the menu (⋮) in the top right of Chrome.',
          'Tap Install app or Add to Home screen.',
          'Confirm the install prompt.',
        ],
        primary: 'Got it',
        note: 'If you do not see Install app, try Add to Home screen in the menu.',
      };
    }
    return {
      title: 'Install in your browser',
      desc: 'Add Strongman AI as an app on desktop Chrome or Edge.',
      steps: [
        'Look for the install icon in the address bar.',
        'Or open the browser menu and choose Install Strongman AI.',
        'Click Install in the dialog.',
      ],
      primary: 'Got it',
      note: 'Safari on Mac: File → Add to Dock after opening the site.',
    };
  }

  function showInstallSheet(mode) {
    ensureInstallSheet();
    var sheet = document.getElementById('pwa-install-sheet');
    var title = document.getElementById('pwa-install-title');
    var desc = document.getElementById('pwa-install-desc');
    var steps = document.getElementById('pwa-install-steps');
    var primary = document.getElementById('pwa-install-primary');
    var note = document.getElementById('pwa-install-note');
    if (!sheet || !title || !desc || !steps || !primary) return;

    steps.innerHTML = '';
    steps.hidden = true;
    if (note) {
      note.hidden = true;
      note.textContent = '';
    }

    if (mode === 'installed') {
      title.textContent = 'Already installed';
      desc.textContent = 'You are using Strongman AI from your home screen or installed app.';
      primary.textContent = 'Open dashboard';
      primary.dataset.mode = 'installed';
      primary.hidden = false;
    } else if (mode === 'prompt' || deferredInstallPrompt) {
      title.textContent = 'Install Strongman AI';
      desc.textContent =
        'Add Strongman AI to this device for faster access, offline workout logging, and push reminders.';
      primary.textContent = 'Install now';
      primary.dataset.mode = 'prompt';
      primary.hidden = false;
      if (note) {
        note.hidden = false;
        note.textContent = 'Free · official build from Strongman AI only.';
      }
    } else {
      var copy = manualInstallCopy(mode || manualInstallMode());
      title.textContent = copy.title;
      desc.textContent = copy.desc;
      primary.textContent = copy.primary;
      primary.dataset.mode = 'manual';
      primary.hidden = false;
      copy.steps.forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = text;
        steps.appendChild(li);
      });
      steps.hidden = false;
      if (note) {
        note.hidden = false;
        note.textContent = copy.note;
      }
    }

    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    primary.focus();
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

  function promptInstall() {
    if (isStandalone()) return Promise.resolve(false);
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      return deferredInstallPrompt.userChoice.then(function (choice) {
        var accepted = !!(choice && choice.outcome === 'accepted');
        deferredInstallPrompt = null;
        if (accepted) hideInstallBanner();
        return accepted;
      });
    }
    return Promise.resolve(false);
  }

  function handleDownloadAction() {
    if (isStandalone()) {
      showInstallSheet('installed');
      return Promise.resolve(false);
    }
    if (deferredInstallPrompt) {
      return promptInstall().then(function (accepted) {
        if (!accepted) showInstallSheet('prompt');
        return accepted;
      });
    }
    showInstallSheet(manualInstallMode());
    return Promise.resolve(false);
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

  function bindBeforeInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      showInstallBanner();
    });
  }

  function bindInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (!banner) return;
    var installBtn = document.getElementById('pwa-install-btn');
    var dismissBtn = document.getElementById('pwa-install-dismiss');
    var closeBtn = document.getElementById('pwa-install-close');

    if (installBtn) {
      installBtn.addEventListener('click', function () {
        handleDownloadAction();
      });
    }
    if (dismissBtn) dismissBtn.addEventListener('click', dismissInstallBanner);
    if (closeBtn) closeBtn.addEventListener('click', hideInstallBanner);

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

  function boot() {
    ensureManifestLink();
    ensureThemeMeta();
    ensureApplePwaMeta();
    bindBeforeInstallPrompt();
    enforceStandaloneEntry();
    polishStandaloneLogin();
    bindAutoSync();
    registerServiceWorker().then(function () {
      syncWhenOnline();
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
    promptInstall: promptInstall,
    handleDownloadAction: handleDownloadAction,
    showInstallSheet: showInstallSheet,
    showInstallBanner: showInstallBanner,
    dismissInstallBanner: dismissInstallBanner,
  };

  boot();
})();
