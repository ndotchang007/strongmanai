(function () {
  var mount = document.getElementById('customize-sports-mount');
  var splitMount = document.getElementById('split') || document.getElementById('customize-split-mount');
  var formMount = document.getElementById('customize-form-mount');
  var saveBtn = document.getElementById('customize-save-btn');
  var completionEl = document.getElementById('customize-completion');
  var setupBannerEl = document.getElementById('customize-setup-banner');
  var SETUP_MODE = /(?:^|[?&])setup=1(?:&|$)/.test(window.location.search || '');
  var FORM_OPTS = { prefix: 'customize-', includeHint: false, includeNotes: true };

  function showSetupBannerIfNeeded() {
    if (!setupBannerEl) return;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ctx = window.AthleteContext ? window.AthleteContext.loadAthleteContext(user) : null;
    var sportFocused =
      ctx &&
      window.AthleteContext &&
      typeof window.AthleteContext.isSportFocusedGoal === 'function' &&
      window.AthleteContext.isSportFocusedGoal(ctx);
    var needsSetup =
      SETUP_MODE ||
      (window.AthleteContext &&
        typeof window.AthleteContext.needsScheduleSetup === 'function' &&
        window.AthleteContext.needsScheduleSetup(user)) ||
      (window.AthleteContext &&
        !sportFocused &&
        typeof window.AthleteContext.isProfileComplete === 'function' &&
        !window.AthleteContext.isProfileComplete(ctx));
    setupBannerEl.hidden = !needsSetup;
    if (needsSetup) {
      var titleEl = setupBannerEl.querySelector('.customize-setup-banner-title');
      var textEl = setupBannerEl.querySelector('.customize-setup-banner-text');
      if (titleEl && textEl) {
        if (sportFocused) {
          titleEl.textContent = 'Almost there — lock in your schedule';
          textEl.textContent =
            'For each sport, pick school or club, set practice nights and game/meet days, and choose your season phase. Rocky uses this to plan lifting around your real week.';
        } else {
          titleEl.textContent = 'Almost there — confirm your training preferences';
          textEl.textContent =
            'Pick your main goal and weekday/weekend session caps below. Sports are optional if you train for general health or daily exercise.';
        }
      }
      if (mount) {
        window.requestAnimationFrame(function () {
          mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  function renderForm() {
    if (!formMount || !window.AthleteProfileForm) return;
    formMount.innerHTML = window.AthleteProfileForm.formHtml(FORM_OPTS);
    if (window.InfoTip) window.InfoTip.scan(formMount);
    window.AthleteProfileForm.bindAutoSave(formMount, FORM_OPTS);
    window.AthleteProfileForm.initBuddyPills(formMount, FORM_OPTS);
  }

  function mountAccountForm() {
    if (window.UserAccountForm) window.UserAccountForm.mount('user-account-mount');
  }

  function mountSplitEditor() {
    if (!splitMount || !window.WorkoutSplitEditor) return;
    if (splitMount.getAttribute('data-split-editor-mounted') === '1') {
      window.WorkoutSplitEditor.loadActiveSplit();
      return;
    }
    window.WorkoutSplitEditor.mount(splitMount, {
      manageLibrary: true,
      onChange: function () {},
    });
    splitMount.setAttribute('data-split-editor-mounted', '1');
  }

  function mountSportsEditor(user) {
    if (!mount || !window.AthleteSportsEditor) return;
    var ctx = window.AthleteProfileForm
      ? window.AthleteProfileForm.loadContext(user)
      : window.AthleteContext.loadAthleteContext(user);
    var sports = window.AthleteContext ? window.AthleteContext.getSports(ctx) : [];
    var sportFocused =
      window.AthleteContext &&
      typeof window.AthleteContext.isSportFocusedGoal === 'function' &&
      window.AthleteContext.isSportFocusedGoal(ctx);
    window.AthleteSportsEditor.mount(mount, {
      initialSports: sports,
      createDefault: sportFocused && !sports.length,
      onChange: function () {
        updateCompletionBadge();
        window.AthleteProfileForm.persist(null, Object.assign({}, FORM_OPTS, { quiet: true }));
        if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
          window.RockySetupAlert.renderAll();
        }
      },
    });
  }

  function updateCompletionBadge() {
    if (!completionEl || !window.AthleteContext) return;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ctx = window.AthleteProfileForm ? window.AthleteProfileForm.loadContext(user) : null;
    var complete = window.AthleteContext.isProfileComplete(ctx);
    var sportFocused =
      ctx &&
      typeof window.AthleteContext.isSportFocusedGoal === 'function' &&
      window.AthleteContext.isSportFocusedGoal(ctx);
    completionEl.textContent = complete
      ? sportFocused
        ? "We're synced — I'll coach around your real schedule."
        : "We're synced — I'll coach around your goals and session caps."
      : sportFocused
        ? 'Add your sports and pick a season phase for each. Practice and game days help Rocky plan better.'
        : 'Set your main goal and weekday/weekend session caps below so Rocky knows how to plan your week.';
    completionEl.classList.toggle('is-complete', complete);
  }

  function loadForm() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    mountSportsEditor(user);
    mountSplitEditor();
    if (window.AthleteProfileForm) {
      window.AthleteProfileForm.loadIntoForm(user, FORM_OPTS);
    }
    if (window.UserAccountForm) window.UserAccountForm.loadFromUser();
    updateCompletionBadge();
    showSetupBannerIfNeeded();
    if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
      window.RockySetupAlert.renderAll();
    }
  }

  mountAccountForm();
  renderForm();
  loadForm();
  if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
    window.RockySetupAlert.renderAll();
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      saveBtn.disabled = true;
      var accountSave =
        window.UserAccountForm && window.UserAccountForm.saveIfDirty
          ? window.UserAccountForm.saveIfDirty()
          : Promise.resolve();
      accountSave
        .then(function () {
          return window.AthleteProfileForm.persist(null, FORM_OPTS);
        })
        .then(function () {
          if (window.WorkoutSplitEditor) window.WorkoutSplitEditor.saveActiveSplit();
          return null;
        })
        .then(function () {
          loadForm();
          showSetupBannerIfNeeded();
          if (window.RockySetupAlert && typeof window.RockySetupAlert.renderAll === 'function') {
            window.RockySetupAlert.renderAll();
          }
        })
        .finally(function () {
          saveBtn.disabled = false;
        });
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) loadForm();
  });
})();
