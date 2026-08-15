(function () {
  'use strict';

  var statusEl = document.getElementById('dl-status');
  var androidBtn = document.getElementById('dl-android-install');
  var iosCard = document.getElementById('dl-ios-card');
  var androidCard = document.getElementById('dl-android-card');

  function isIOS() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('dl-status--error', !!isError);
  }

  function highlightPlatform() {
    if (isIOS() && iosCard) iosCard.classList.add('dl-card--highlight');
    if (isAndroid() && androidCard) androidCard.classList.add('dl-card--highlight');
  }

  function runAndroidInstall() {
    if (window.StrongmanPWA && window.StrongmanPWA.isStandalone && window.StrongmanPWA.isStandalone()) {
      setStatus('Strongman AI is already installed. Open it from your home screen.');
      return;
    }

    setStatus('Opening install… follow the browser confirmation.');

    if (window.StrongmanPWA && typeof window.StrongmanPWA.promptInstall === 'function') {
      window.StrongmanPWA.promptInstall().then(function (accepted) {
        if (accepted) {
          setStatus('Install started. Check your home screen or app drawer for Strongman AI.');
          return;
        }
        setStatus(
          'No install prompt appeared. Use the menu (⋮) → Install app, or Add to Home screen.',
          true
        );
      });
      return;
    }

    setStatus('Use Chrome menu (⋮) → Install app or Add to Home screen.', true);
  }

  highlightPlatform();

  if (androidBtn) {
    androidBtn.addEventListener('click', runAndroidInstall);
  }
})();
