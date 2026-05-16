(function () {
  function applyImageFallbacks() {
    document.querySelectorAll('img[data-fallback-src]').forEach(function (img) {
      img.addEventListener('error', function onErr() {
        img.removeEventListener('error', onErr);
        var fb = img.getAttribute('data-fallback-src');
        if (fb && img.src.indexOf(fb) === -1) {
          img.src = fb;
        }
      });
    });
  }
  applyImageFallbacks();

  var generateWorkoutOverlay = document.getElementById('generate-workout-overlay');
  var generateWorkoutPromptDisplay = document.getElementById('generate-workout-prompt-display');
  var generateWorkoutResult = document.getElementById('generate-workout-result');
  var generateWorkoutClose = document.getElementById('generate-workout-close');
  var generateWorkoutDone = document.getElementById('generate-workout-done');

  function closeGenerateWorkoutModal() {
    if (!generateWorkoutOverlay) return;
    generateWorkoutOverlay.hidden = true;
    generateWorkoutOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    var dlg = generateWorkoutOverlay.querySelector('.generate-workout-dialog');
    if (dlg) dlg.setAttribute('aria-busy', 'false');
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function buildPlaceholderWorkoutHtml(prompt) {
    var plan =
      'DAY 1 — Strength\n' +
      '• Warm-up: 8–10 min easy cardio + dynamic arms\n' +
      '• Primary lift (squat or hinge pattern) 4×6\n' +
      '• Secondary push 3×8–10\n' +
      '• Rows / rear delts 3×12\n' +
      '• Core 10–12 min\n\n' +
      'DAY 2 — Power & conditioning\n' +
      '• Jump or throw primer 5×3\n' +
      '• Upper pull volume 4×AMRAP quality reps\n' +
      '• Accessories + arms as needed\n' +
      '• Conditioning finisher 10–15 min\n\n' +
      'DAY 3 — Recovery & skill\n' +
      '• Mobility 15 min\n' +
      '• Light technique + weak-point work\n' +
      '• Stretch / walk-off\n\n' +
      '— Framed for your request: ' +
      prompt;
    return (
      '<div class="generate-workout-plan">' +
      '<p class="generate-workout-note">Preview — hook up your AI backend to replace this placeholder.</p>' +
      '<pre class="generate-workout-pre">' +
      escapeHtml(plan) +
      '</pre></div>'
    );
  }

  function openGenerateWorkoutModal(prompt) {
    if (!generateWorkoutOverlay || !generateWorkoutPromptDisplay || !generateWorkoutResult) return;
    if (typeof window.apiPost === 'function') {
      window.apiPost('/stats/workouts-made', {}).then(function (res) {
        if (!res.ok) return;
        return res.json().then(function (data) {
          if (typeof window.applySiteStats === 'function') window.applySiteStats(data);
        });
      }).catch(function () {});
    }
    generateWorkoutPromptDisplay.textContent = prompt;
    generateWorkoutResult.innerHTML =
      '<p class="generate-workout-loading">Generating your workout…</p>';
    generateWorkoutOverlay.hidden = false;
    generateWorkoutOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var dlg = generateWorkoutOverlay.querySelector('.generate-workout-dialog');
    if (dlg) dlg.setAttribute('aria-busy', 'true');

    window.setTimeout(function () {
      generateWorkoutResult.innerHTML = buildPlaceholderWorkoutHtml(prompt);
      if (dlg) dlg.setAttribute('aria-busy', 'false');
    }, 750);
  }

  if (generateWorkoutClose) {
    generateWorkoutClose.addEventListener('click', closeGenerateWorkoutModal);
  }
  if (generateWorkoutDone) {
    generateWorkoutDone.addEventListener('click', closeGenerateWorkoutModal);
  }
  if (generateWorkoutOverlay) {
    generateWorkoutOverlay.addEventListener('click', function (e) {
      if (e.target === generateWorkoutOverlay) closeGenerateWorkoutModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (generateWorkoutOverlay && !generateWorkoutOverlay.hidden) {
      closeGenerateWorkoutModal();
    }
  });

  var indexLoginForm = document.getElementById('index-login-form');
  var indexLoginError = document.getElementById('index-login-error');
  var indexGoogleBtn = document.getElementById('index-google-btn');

  function showIndexLoginError(msg) {
    if (indexLoginError) {
      indexLoginError.textContent = msg;
      indexLoginError.hidden = false;
    }
  }
  function hideIndexLoginError() {
    if (indexLoginError) {
      indexLoginError.textContent = '';
      indexLoginError.hidden = true;
    }
  }

  if (indexGoogleBtn) {
    indexGoogleBtn.addEventListener('click', function () {
      showIndexLoginError('Google sign-in is not set up yet. Use email and password, or create an account.');
    });
  }

  function readSafeNextPathFromUrl() {
    try {
      var q = new URLSearchParams(window.location.search);
      var n = q.get('next');
      if (n && n.charAt(0) === '/' && n.indexOf('//') !== 0) {
        return n;
      }
    } catch (e) {}
    return null;
  }

  if (indexLoginForm && typeof window.apiPost === 'function' && typeof window.setCurrentUser === 'function') {
    indexLoginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideIndexLoginError();
      var emailEl = document.getElementById('index-login-email');
      var passEl = document.getElementById('index-login-password');
      var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
      var password = passEl ? passEl.value : '';
      if (!email || !password) {
        showIndexLoginError('Please enter email and password.');
        return;
      }
      window
        .apiPost('/users/login', { email: email, password: password })
        .then(function (res) {
          return res.json().then(function (data) {
            if (res.ok) {
              window.setCurrentUser(data);
              window.location.href = readSafeNextPathFromUrl() || '/home';
            } else {
              showIndexLoginError(data.error || 'Invalid email or password.');
            }
          });
        })
        .catch(function () {
          showIndexLoginError('Network error. Is the backend running?');
        });
    });
  }

  document.querySelectorAll('[data-page2-carousel]').forEach(function (root) {
    var track = root.querySelector('.page2-carousel-track');
    var slides = root.querySelectorAll('.page2-carousel-slide');
    var prevBtn = root.querySelector('.page2-carousel-prev');
    var nextBtn = root.querySelector('.page2-carousel-next');
    var dots = root.querySelectorAll('.page2-carousel-dot');
    if (!track || !slides.length) return;
    var n = slides.length;
    track.style.width = n * 100 + '%';
    slides.forEach(function (slide) {
      slide.style.flex = '0 0 ' + 100 / n + '%';
    });
    var index = 0;

    function go(i) {
      index = ((i % slides.length) + slides.length) % slides.length;
      track.style.transform = 'translateX(' + -index * (100 / n) + '%)';
      dots.forEach(function (d, di) {
        d.classList.toggle('active', di === index);
        d.setAttribute('aria-selected', di === index ? 'true' : 'false');
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });
    dots.forEach(function (d, di) {
      d.addEventListener('click', function () { go(di); });
    });
    go(0);
  });

  const nav = document.querySelector('.page2-nav-inner');
  const slider = document.querySelector('.page2-nav-slider');
  const navButtons = document.querySelectorAll('.page2-nav-btn');
  const tabContents = document.querySelectorAll('.page2-tab-content');

  var pendingGeneratePrompt = '';
  var generateReadyBar = document.getElementById('page2-generate-ready');
  var openGenerateDraftBtn = document.getElementById('page2-open-generate-modal');

  var generateForm = document.getElementById('generate-ai-section');
  if (generateForm) {
    generateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('page2-generate-prompt');
      var prompt = input && input.value ? input.value.trim() : '';
      if (!prompt) return;
      pendingGeneratePrompt = prompt;
      if (generateReadyBar) generateReadyBar.hidden = false;
    });
  }
  if (openGenerateDraftBtn) {
    openGenerateDraftBtn.addEventListener('click', function () {
      if (!pendingGeneratePrompt) return;
      openGenerateWorkoutModal(pendingGeneratePrompt);
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
  var statAccountsCreated = document.getElementById('stat-accounts-created');
  var statActiveUsers = document.getElementById('stat-active-users');

  function setStats(workoutsMade, workoutsTracked, liftsRecorded, accountsCreated, activeUsers) {
    var duration = 800;
    if (statWorkoutsMade) animateCounter(statWorkoutsMade, workoutsMade, duration);
    if (statWorkoutsTracked) animateCounter(statWorkoutsTracked, workoutsTracked, duration);
    if (statLiftsRecorded) animateCounter(statLiftsRecorded, liftsRecorded, duration);
    if (statAccountsCreated) animateCounter(statAccountsCreated, accountsCreated, duration);
    if (statActiveUsers) animateCounter(statActiveUsers, activeUsers, duration);
  }

  function applySiteStats(data) {
    if (!data) return;
    setStats(
      Number(data.workoutsMade) || 0,
      Number(data.workoutsTracked) || 0,
      Number(data.liftsRecorded) || 0,
      Number(data.accountsCreated) || 0,
      Number(data.activeUsers) || 0
    );
  }

  window.setStats = setStats;
  window.applySiteStats = applySiteStats;

  if (typeof window.apiGet === 'function') {
    window
      .apiGet('/stats')
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data) applySiteStats(data);
      })
      .catch(function () {});
  }

  console.log(
    '%c STRONGMAN AI – Stats\n' +
    'Counters load from GET /api/v1/stats. Override from the console with:\n' +
    'setStats(workoutsMade, workoutsTracked, liftsRecorded, accountsCreated, activeUsers)',
    'font-weight: bold; font-size: 12px;'
  );
})();
