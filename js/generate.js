(function () {
  window.coachApplyWorkout = function (plainText) {
    if (!plainText) return;
    try {
      sessionStorage.setItem('strongman-coach-apply-paste', plainText);
    } catch (e) {}
    window.location.href = '/create';
  };

  if (window.CoachThread) {
    new window.CoachThread({
      threadEl: document.getElementById('coach-thread'),
      composerEl: document.getElementById('coach-composer'),
      inputEl: document.getElementById('coach-input'),
      sendBtn: document.getElementById('coach-send'),
      routineToggle: document.getElementById('coach-routine-mode'),
      clearBtns: [
        document.getElementById('coach-clear'),
        document.getElementById('coach-clear-desktop'),
      ],
      quotaEl: document.getElementById('coach-quota'),
      errorEl: document.getElementById('coach-error'),
      chipsEl: document.getElementById('coach-chips'),
      briefingEl: document.getElementById('coach-briefing'),
      briefingMobileEl: document.getElementById('coach-briefing-mobile'),
    });
  }

  if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
    window.RockySetupAlert.renderAll();
  }
})();
