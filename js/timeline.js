(function () {
  var root = document.getElementById('timeline-root');

  function sessions() {
    var WL = window.WorkoutLog;
    return WL && typeof WL.getSessions === 'function' ? WL.getSessions() : [];
  }

  function render() {
    if (!root || !window.TrainingTimeline) return;
    window.TrainingTimeline.mount(root, sessions(), { limit: 120 });
  }

  function load() {
    var TS = window.TrainingSync;
    var after = function () {
      if (window.CoachMemory && typeof window.CoachMemory.syncFromServerAsync === 'function') {
        window.CoachMemory.syncFromServerAsync().then(render, render);
        return;
      }
      render();
    };
    if (TS && typeof TS.syncAll === 'function') {
      var cu = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (cu && cu.token) {
        TS.syncAll({ callback: after });
        return;
      }
    }
    after();
  }

  window.addEventListener('strongman:training-synced', render);
  window.addEventListener('strongman:timeline-updated', render);
  load();
})();
