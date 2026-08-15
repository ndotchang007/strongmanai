/**
 * Shared footer email modal (mailto to outreach). Used on index + app shell pages.
 * Requires #footer-email-overlay markup and api.js is not required.
 */
(function () {
  var OUTREACH_EMAIL = 'strongmanaioutreach@gmail.com';

  function buildFooterBarHtml() {
    return (
      '<nav class="footer-app-bar" aria-label="Footer">' +
      '<a href="/legal#terms" class="footer-app-link">Terms</a>' +
      '<span class="footer-app-sep" aria-hidden="true">·</span>' +
      '<a href="/legal#privacy" class="footer-app-link">Privacy</a>' +
      '<span class="footer-app-sep" aria-hidden="true">·</span>' +
      '<button type="button" class="footer-app-link footer-link-button" data-email-kind="bug">Report</button>' +
      '<span class="footer-app-sep" aria-hidden="true">·</span>' +
      '<button type="button" class="footer-app-link footer-link-button" data-footer-download="1">Download</button>' +
      '<span class="footer-app-sep footer-app-sep--update" aria-hidden="true" hidden>·</span>' +
      '<button type="button" class="footer-app-link footer-link-button" data-footer-update="1" hidden>Update</button>' +
      '<span class="footer-app-sep footer-app-sep--logout" aria-hidden="true">·</span>' +
      '<button type="button" class="footer-app-link footer-link-button" data-footer-logout="1">Log out</button>' +
      '</nav>'
    );
  }

  function handleFooterDownload() {
    try {
      window.location.assign('/download');
    } catch (e) {
      window.location.href = '/download';
    }
  }

  function handleFooterLogout() {
    if (typeof window.strongmanLogout === 'function') {
      window.strongmanLogout();
      return;
    }
    if (typeof window.setCurrentUser === 'function') {
      window.setCurrentUser(null);
    }
    try {
      window.location.replace('/login');
    } catch (err) {
      window.location.href = '/login';
    }
  }

  function syncFooterAuthState(footer) {
    var logoutBtn = footer.querySelector('[data-footer-logout]');
    var logoutSep = footer.querySelector('.footer-app-sep--logout');
    var viewer = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var showLogout = !!viewer;
    if (logoutBtn) logoutBtn.hidden = !showLogout;
    if (logoutSep) logoutSep.hidden = !showLogout;
    syncFooterUpdateState(footer);
  }

  function syncFooterUpdateState(footer) {
    var updateBtn = footer.querySelector('[data-footer-update]');
    var updateSep = footer.querySelector('.footer-app-sep--update');
    var showUpdate =
      window.StrongmanPWA &&
      typeof window.StrongmanPWA.isStandalone === 'function' &&
      window.StrongmanPWA.isStandalone() &&
      typeof window.StrongmanPWA.hasUpdateAvailable === 'function' &&
      window.StrongmanPWA.hasUpdateAvailable();
    if (updateBtn) updateBtn.hidden = !showUpdate;
    if (updateSep) updateSep.hidden = !showUpdate;
  }

  function bindFooterActions(footer) {
    var downloadBtn = footer.querySelector('[data-footer-download]');
    var logoutBtn = footer.querySelector('[data-footer-logout]');
    if (downloadBtn && !downloadBtn.dataset.bound) {
      downloadBtn.dataset.bound = '1';
      downloadBtn.addEventListener('click', handleFooterDownload);
    }
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = '1';
      logoutBtn.addEventListener('click', handleFooterLogout);
    }
    syncFooterAuthState(footer);
  }

  function minimizeAppFooter(footer) {
    if (
      footer.classList.contains('site-footer--scroll-gated') ||
      footer.dataset.footerMinimized === '1'
    ) {
      bindFooterActions(footer);
      return;
    }
    footer.dataset.footerMinimized = '1';
    footer.removeAttribute('hidden');
    footer.classList.remove('site-footer--compact');
    footer.classList.add('site-footer--app');
    footer.innerHTML = buildFooterBarHtml();
    bindFooterActions(footer);
  }

  function minimizeAppFooters() {
    document.querySelectorAll('.site-footer').forEach(minimizeAppFooter);
  }

  function ensureAppFooter() {
    if (document.querySelector('.site-footer')) return;
    var wrap = document.querySelector('.main-wrap');
    if (!wrap) return;
    var footer = document.createElement('footer');
    footer.className = 'site-footer site-footer--app';
    footer.dataset.footerMinimized = '1';
    footer.innerHTML = buildFooterBarHtml();
    wrap.appendChild(footer);
    bindFooterActions(footer);
  }

  minimizeAppFooters();
  ensureAppFooter();

  window.addEventListener('strongman:user-updated', function () {
    document.querySelectorAll('.site-footer--app').forEach(syncFooterAuthState);
  });

  window.addEventListener('strongman:pwa-update-available', function () {
    document.querySelectorAll('.site-footer--app').forEach(syncFooterUpdateState);
  });

  var footerEmailOverlay = document.getElementById('footer-email-overlay');
  var footerEmailHeading = document.getElementById('footer-email-heading');
  var footerEmailSubject = document.getElementById('footer-email-subject');
  var footerEmailBody = document.getElementById('footer-email-body');
  var footerEmailClose = document.getElementById('footer-email-close');
  var footerEmailCancel = document.getElementById('footer-email-cancel');
  var footerEmailOpen = document.getElementById('footer-email-open');

  function openFooterEmailModal(kind) {
    if (!footerEmailOverlay || !footerEmailSubject || !footerEmailBody || !footerEmailHeading) return;
    var focusBody = false;
    if (kind === 'bug') {
      footerEmailHeading.textContent = 'Report a bug';
      footerEmailSubject.value = 'Bug found';
      footerEmailBody.value = 'Bug found\n\n';
      focusBody = true;
    } else if (kind === 'rate') {
      footerEmailHeading.textContent = 'Rate us';
      footerEmailSubject.value = 'Strongman AI — rating';
      footerEmailBody.value =
        'My rating (e.g. 1–5 stars):\n\nWhat I like:\n\nWhat could improve:\n\n';
      focusBody = true;
    } else if (kind === 'suggestions') {
      footerEmailHeading.textContent = 'Suggestions';
      footerEmailSubject.value = 'Strongman AI — suggestion';
      footerEmailBody.value = 'Suggestion:\n\nWhy it would help:\n\n';
      focusBody = true;
    } else if (kind === 'questions') {
      footerEmailHeading.textContent = 'Questions';
      footerEmailSubject.value = 'Strongman AI — question';
      footerEmailBody.value = 'My question:\n\n';
      focusBody = true;
    } else {
      footerEmailHeading.textContent = 'Contact us';
      footerEmailSubject.value = '';
      footerEmailBody.value = '';
      focusBody = false;
    }
    footerEmailOverlay.hidden = false;
    footerEmailOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (focusBody) {
        footerEmailBody.focus();
        var len = footerEmailBody.value.length;
        footerEmailBody.setSelectionRange(len, len);
      } else {
        footerEmailSubject.focus();
      }
    }, 0);
  }

  function closeFooterEmailModal() {
    if (!footerEmailOverlay) return;
    footerEmailOverlay.hidden = true;
    footerEmailOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openMailtoFromModal() {
    if (!footerEmailSubject || !footerEmailBody) return;
    var sub = footerEmailSubject.value;
    var body = footerEmailBody.value;
    var href =
      'mailto:' +
      OUTREACH_EMAIL +
      '?subject=' +
      encodeURIComponent(sub) +
      '&body=' +
      encodeURIComponent(body);
    window.location.href = href;
    closeFooterEmailModal();
  }

  document.querySelectorAll('[data-email-kind]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (btn.tagName === 'A') e.preventDefault();
      openFooterEmailModal(btn.getAttribute('data-email-kind'));
    });
  });

  if (footerEmailClose) footerEmailClose.addEventListener('click', closeFooterEmailModal);
  if (footerEmailCancel) footerEmailCancel.addEventListener('click', closeFooterEmailModal);
  if (footerEmailOpen) footerEmailOpen.addEventListener('click', openMailtoFromModal);

  if (footerEmailOverlay) {
    footerEmailOverlay.addEventListener('click', function (e) {
      if (e.target === footerEmailOverlay) closeFooterEmailModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!footerEmailOverlay || footerEmailOverlay.hidden) return;
    closeFooterEmailModal();
  });
})();
