(function () {
  const nav = document.querySelector('.page2-nav-inner');
  const slider = document.querySelector('.page2-nav-slider');
  const navButtons = document.querySelectorAll('.page2-nav-btn');
  const tabContents = document.querySelectorAll('.page2-tab-content');

  const generateForm = document.getElementById('generate-ai-section');
  if (generateForm) {
    generateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = this.querySelector('.page2-generate-ai-input');
      const prompt = input && input.value ? input.value.trim() : '';
      if (prompt) {
        console.log('Generate prompt:', prompt);
        // TODO: send to your backend / Python
      }
    });
  }

  function positionSlider(button) {
    if (!nav || !slider || !button) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    slider.style.left = (btnRect.left - navRect.left) + 'px';
    slider.style.width = btnRect.width + 'px';
  }

  function setActive(btn) {
    navButtons.forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    positionSlider(btn);
  }

  if (nav && slider && navButtons.length) {
    const activeBtn = document.querySelector('.page2-nav-btn.active');
    if (activeBtn) {
      positionSlider(activeBtn);
    }
    window.addEventListener('resize', function () {
      const active = document.querySelector('.page2-nav-btn.active');
      if (active) positionSlider(active);
    });
  }

  if (!navButtons.length || !tabContents.length) return;

  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const tab = this.getAttribute('data-tab');
      if (!tab) return;

      setActive(this);

      tabContents.forEach(function (content) {
        const id = content.getAttribute('id');
        if (id === 'content-' + tab) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
  /* --- Page3: live stats counters (console API) --- */
  function formatNum(n) {
    return n.toLocaleString();
  }

  function animateCounter(el, target, duration) {
    if (!el) return;
    var current = parseInt(el.getAttribute('data-value'), 10) || 0;
    target = Math.max(0, Math.floor(target));
    el.setAttribute('data-value', target);
    var start = current;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 2);
      var value = Math.floor(start + (target - start) * eased);
      el.textContent = formatNum(value);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = formatNum(target);
    }
    requestAnimationFrame(step);
  }

  var statWorkoutsMade = document.getElementById('stat-workouts-made');
  var statWorkoutsTracked = document.getElementById('stat-workouts-tracked');
  var statLiftsRecorded = document.getElementById('stat-lifts-recorded');

  function setStats(workoutsMade, workoutsTracked, liftsRecorded) {
    var duration = 800;
    if (statWorkoutsMade) animateCounter(statWorkoutsMade, workoutsMade, duration);
    if (statWorkoutsTracked) animateCounter(statWorkoutsTracked, workoutsTracked, duration);
    if (statLiftsRecorded) animateCounter(statLiftsRecorded, liftsRecorded, duration);
  }

  window.setStats = setStats;

  console.log(
    '%c STRONGMAN AI – Stats\n' +
    'Change the purple section counters from the console.\n' +
    'Usage: setStats(workoutsMade, workoutsTracked, liftsRecorded)\n' +
    'Example: setStats(1000000, 1000000, 1000000)',
    'font-weight: bold; font-size: 12px;'
  );
})();
