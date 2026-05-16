/**
 * Shared footer email modal (mailto to outreach). Used on index + app shell pages.
 * Requires #footer-email-overlay markup and api.js is not required.
 */
(function () {
  var OUTREACH_EMAIL = 'strongmanaioutreach@gmail.com';
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
