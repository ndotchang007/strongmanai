(function () {
  window.coachApplyWorkout = function (plainText) {
    if (!plainText) return;
    try {
      sessionStorage.setItem('strongman-coach-apply-paste', plainText);
    } catch (e) {}
    window.location.href = '/log';
  };

  if (window.CoachThread) {
    new window.CoachThread({
      threadEl: document.getElementById('coach-thread'),
      composerEl: document.getElementById('coach-composer'),
      inputEl: document.getElementById('coach-input'),
      sendBtn: document.getElementById('coach-send'),
      capabilityGrid: document.getElementById('coach-capability-grid'),
      modeStageEl: document.getElementById('coach-mode-stage'),
      modeBackBtn: document.getElementById('coach-modes-back'),
      chatBackBtn: document.getElementById('coach-modes-back'),
      attachBtn: document.getElementById('coach-attach-btn'),
      imageInput: document.getElementById('coach-image-input'),
      attachPreviewEl: document.getElementById('coach-attach-preview'),
      micBtn: document.getElementById('coach-mic-btn'),
      clearBtns: [document.getElementById('coach-clear')],
      quotaEl: document.getElementById('coach-quota'),
      errorEl: document.getElementById('coach-error'),
      chipsEl: document.getElementById('coach-chips'),
      briefingEl: document.getElementById('coach-briefing'),
      briefingMobileEl: document.getElementById('coach-briefing-mobile'),
      layoutEl: document.getElementById('coach-layout'),
      emptyHeroEl: document.getElementById('coach-empty-hero'),
      knowBtn: document.getElementById('coach-know-btn'),
      knowDrawer: document.getElementById('coach-know-drawer'),
      knowBackdrop: document.getElementById('coach-know-backdrop'),
      knowCloseBtn: document.getElementById('coach-know-close'),
    });
  }

  if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
    window.RockySetupAlert.renderAll();
  }
})();
