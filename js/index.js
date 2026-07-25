(function () {
  if (typeof window.isLoggedIn === 'function' && window.isLoggedIn()) {
    function goHome() {
      try {
        window.location.replace('/home');
      } catch (e) {
        window.location.href = '/home';
      }
    }
    if (window.ServerWake && typeof window.ServerWake.waitForServer === 'function') {
      window.ServerWake.waitForServer(goHome);
    } else {
      goHome();
    }
    return;
  }

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
          applySiteStats(data);
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
  /* --- Page3: live stats + sticky scroll-scrub reveal --- */
  function formatNum(n) {
    return n.toLocaleString();
  }

  function formatStatDisplay(n) {
    var value = Math.max(0, Math.floor(n));
    return formatNum(value) + (value >= 1000 ? '+' : '');
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
      el.textContent = progress < 1 ? formatNum(value) : formatStatDisplay(target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = formatStatDisplay(target);
    }
    requestAnimationFrame(step);
  }

  var statWorkoutsMade = document.getElementById('stat-workouts-made');
  var statLiftsTracked = document.getElementById('stat-lifts-tracked');
  var statUsers = document.getElementById('stat-users');

  var statElementsByField = {
    workoutsMade: statWorkoutsMade,
    liftsTracked: statLiftsTracked,
    users: statUsers
  };

  var pendingSiteStats = null;
  var animatedStatFields = {};
  var scrubCounterTriggered = {};

  function buildSiteStatsFromApi(data) {
    return {
      workoutsMade: Number(data.workoutsMade) || 0,
      liftsTracked: (Number(data.workoutsTracked) || 0) + (Number(data.liftsRecorded) || 0),
      users: Number(data.accountsCreated) || 0
    };
  }

  function animateStatField(field, value) {
    if (animatedStatFields[field]) return;
    var el = statElementsByField[field];
    if (!el) return;
    animatedStatFields[field] = true;
    animateCounter(el, Number(value) || 0, 900);
  }

  function applySiteStats(data) {
    if (!data) return;
    pendingSiteStats = buildSiteStatsFromApi(data);
    Object.keys(statElementsByField).forEach(function (field) {
      if (!scrubCounterTriggered[field]) return;
      animatedStatFields[field] = false;
      animateStatField(field, pendingSiteStats[field]);
    });
  }

  function initPage3ScrollScrub() {
    var scrub = document.querySelector('.page3-scrub');
    var statsStage = document.querySelector('.page3-scrub-stage--stats');
    var ctaStage = document.querySelector('.page3-scrub-stage--cta');
    var ctaBlock = document.querySelector('.page3-cta-block');
    var lead = document.querySelector('.page3-scrub-lead');
    var footer = document.getElementById('site-footer');
    var lines = Array.prototype.slice.call(document.querySelectorAll('.page3-scrub-lines .page3-stat-line'));
    if (!scrub || !lines.length) return;

    var STEP_COUNT = parseInt(scrub.getAttribute('data-scrub-steps'), 10) || 6;
    scrub.style.height = STEP_COUNT * 100 + 'vh';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      scrub.classList.add('page3-scrub--reduced');
      scrub.style.height = 'auto';
      if (lead) {
        lead.style.opacity = '1';
        lead.style.transform = 'none';
      }
      lines.forEach(function (line) {
        var field = line.getAttribute('data-stat-field');
        if (field && pendingSiteStats) animateStatField(field, pendingSiteStats[field]);
      });
      if (ctaStage) ctaStage.classList.add('is-active');
      if (ctaBlock) {
        ctaBlock.style.opacity = '1';
        ctaBlock.style.transform = 'none';
      }
      if (footer) footer.classList.add('is-visible');
      return;
    }

    var ticking = false;

    function clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function segmentProgress(t, start, end) {
      if (end <= start) return t >= end ? 1 : 0;
      return clamp((t - start) / (end - start), 0, 1);
    }

    function maybeTriggerCounter(field, localIn) {
      if (!field || localIn < 0.5) return;
      scrubCounterTriggered[field] = true;
      if (pendingSiteStats) animateStatField(field, pendingSiteStats[field]);
    }

    function updateFooterGate() {
      if (!footer) return;
      var rect = scrub.getBoundingClientRect();
      var viewportH = window.innerHeight || document.documentElement.clientHeight;
      if (rect.bottom <= viewportH + 2) {
        footer.classList.add('is-visible');
      } else {
        footer.classList.remove('is-visible');
      }
    }

    function updateScrub() {
      ticking = false;
      var rect = scrub.getBoundingClientRect();
      var viewportH = window.innerHeight || document.documentElement.clientHeight;
      var maxScroll = scrub.offsetHeight - viewportH;
      if (maxScroll <= 0) return;

      var scrolled = -rect.top;
      var progress = clamp(scrolled / maxScroll, 0, 1);
      var t = progress * STEP_COUNT;

      if (lead) {
        lead.style.opacity = '1';
        lead.style.transform = 'translateY(0)';
      }

      lines.forEach(function (line, i) {
        var enterStart = 0.15 + i * 0.85;
        var localIn = easeOutCubic(segmentProgress(t, enterStart, enterStart + 0.32));
        var y = (1 - localIn) * 36;

        line.style.opacity = String(localIn);
        line.style.transform = 'translateY(' + y + 'px)';

        maybeTriggerCounter(line.getAttribute('data-stat-field'), localIn);
      });

      var statsFade = 1 - easeOutCubic(segmentProgress(t, 4.6, 5.15));
      var ctaIn = easeOutCubic(segmentProgress(t, 4.85, 5.45));

      if (statsStage) {
        statsStage.style.opacity = String(statsFade);
      }

      if (ctaStage) {
        ctaStage.style.opacity = String(ctaIn);
        if (ctaIn > 0.05) {
          ctaStage.classList.add('is-active');
        } else {
          ctaStage.classList.remove('is-active');
        }
      }

      if (ctaBlock) {
        ctaBlock.style.opacity = String(ctaIn);
        ctaBlock.style.transform = 'translateY(' + ((1 - ctaIn) * 40) + 'px)';
      }

      updateFooterGate();
    }

    function onScrubScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateScrub);
      }
    }

    window.addEventListener('scroll', onScrubScroll, { passive: true });
    window.addEventListener('resize', onScrubScroll, { passive: true });
    updateScrub();
  }

  initPage3ScrollScrub();

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

  var HS_DEMO_EXAMPLES = [
    {
      prompt: '"45-min upper body, badminton in-season — no heavy legs before Saturday match"',
      sport: 'Badminton · singles',
      season: 'In-season',
      practice: 'Mon / Wed / Fri',
      compLabel: 'Match day',
      comp: 'Saturday',
      hint: 'Today: Short session before match (~30 min)',
    },
    {
      prompt: '"Track sprinter — power session without burying legs before Tuesday practice"',
      sport: 'Track · sprints',
      season: 'In-season',
      practice: 'Tue / Thu',
      compLabel: 'Meet day',
      comp: 'Saturday',
      hint: 'Today: Explosive work, low volume (~45 min)',
    },
    {
      prompt: '"Volleyball off-season — build jump power, 90 min upper/lower split"',
      sport: 'Volleyball · OH',
      season: 'Off-season',
      practice: 'Mon / Wed',
      compLabel: 'Match day',
      comp: 'Friday',
      hint: 'Today: Hypertrophy + plyo prep (~90 min)',
    },
  ];

  function initHsDemoRotation() {
    var promptEl = document.getElementById('hero-demo-prompt');
    var sportEl = document.getElementById('hs-demo-sport');
    if (!promptEl && !sportEl) return;
    var idx = 0;
    function applyDemo(i) {
      var ex = HS_DEMO_EXAMPLES[i];
      if (!ex) return;
      if (promptEl) promptEl.textContent = ex.prompt;
      if (sportEl) sportEl.textContent = ex.sport;
      var seasonEl = document.getElementById('hs-demo-season');
      var practiceEl = document.getElementById('hs-demo-practice');
      var compLabelEl = document.getElementById('hs-demo-comp-label');
      var compEl = document.getElementById('hs-demo-comp');
      var hintEl = document.getElementById('hs-demo-hint');
      if (seasonEl) seasonEl.textContent = ex.season;
      if (practiceEl) practiceEl.textContent = ex.practice;
      if (compLabelEl) compLabelEl.textContent = ex.compLabel;
      if (compEl) compEl.textContent = ex.comp;
      if (hintEl) hintEl.textContent = ex.hint;
    }
    applyDemo(0);
    setInterval(function () {
      idx = (idx + 1) % HS_DEMO_EXAMPLES.length;
      applyDemo(idx);
    }, 5500);
  }

  initHsDemoRotation();

  function initCtaHeadlineRotation() {
    var wordEl = document.getElementById('page3-cta-rotate-word');
    if (!wordEl) return;

    var phrases = ['next PR', 'best season', 'physique transformation'];
    var idx = 0;
    var reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) return;

    setInterval(function () {
      wordEl.classList.add('page3-cta-rotate-word--out');
      setTimeout(function () {
        idx = (idx + 1) % phrases.length;
        wordEl.textContent = phrases[idx];
        wordEl.classList.remove('page3-cta-rotate-word--out');
        wordEl.classList.add('page3-cta-rotate-word--in');
        void wordEl.offsetWidth;
        wordEl.classList.remove('page3-cta-rotate-word--in');
      }, 260);
    }, 2200);
  }

  initCtaHeadlineRotation();

  /* Hypothetical PWA install preview — UI only, does not install anything */
  (function initPwaDownloadPreview() {
    var overlay = document.getElementById('pwa-download-overlay');
    if (!overlay) return;
    var closeBtn = document.getElementById('pwa-download-close');
    var cancelBtn = document.getElementById('pwa-download-cancel');
    var installBtn = document.getElementById('pwa-download-install');
    var statusEl = document.getElementById('pwa-download-status');
    var barEl = document.getElementById('pwa-download-bar');
    var steps = overlay.querySelectorAll('.pwa-download-step');
    var timers = [];
    var openTriggers = [
      document.getElementById('hero-download-app'),
      document.getElementById('page3-download-app'),
    ];

    function clearTimers() {
      timers.forEach(function (id) {
        window.clearTimeout(id);
      });
      timers = [];
    }

    function setStep(n) {
      steps.forEach(function (step) {
        var s = parseInt(step.getAttribute('data-step'), 10);
        step.classList.toggle('is-done', s < n);
        step.classList.toggle('is-active', s === n);
      });
    }

    function closeOverlay() {
      clearTimers();
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function openOverlay() {
      clearTimers();
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (installBtn) installBtn.disabled = true;
      if (barEl) barEl.style.width = '8%';
      if (statusEl) statusEl.textContent = 'Starting install preview…';
      setStep(1);

      timers.push(
        window.setTimeout(function () {
          setStep(2);
          if (barEl) barEl.style.width = '42%';
          if (statusEl) statusEl.textContent = 'Building a lightweight app shell…';
        }, 700)
      );
      timers.push(
        window.setTimeout(function () {
          setStep(3);
          if (barEl) barEl.style.width = '88%';
          if (statusEl) statusEl.textContent = 'Almost ready — install is coming soon.';
        }, 1600)
      );
      timers.push(
        window.setTimeout(function () {
          if (barEl) barEl.style.width = '100%';
          if (statusEl) statusEl.textContent = 'Preview complete. Real install isn’t wired up yet.';
          if (installBtn) installBtn.disabled = true;
        }, 2400)
      );
    }

    openTriggers.forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openOverlay();
      });
    });
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);
    if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);
    if (installBtn) {
      installBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (statusEl) statusEl.textContent = 'Install isn’t available yet — stay tuned.';
      });
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeOverlay();
    });
  })();
})();
