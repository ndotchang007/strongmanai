(function () {
  var mount = document.getElementById('customize-sports-mount');
  var formMount = document.getElementById('customize-form-mount');
  var saveBtn = document.getElementById('customize-save-btn');
  var completionEl = document.getElementById('customize-completion');
  var setupBannerEl = document.getElementById('customize-setup-banner');
  var SETUP_MODE = /(?:^|[?&])setup=1(?:&|$)/.test(window.location.search || '');
  var FORM_OPTS = { prefix: 'customize-', includeHint: false, includeNotes: true };

  function showSetupBannerIfNeeded() {
    if (!setupBannerEl) return;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var needsSetup =
      SETUP_MODE ||
      (window.AthleteContext &&
        typeof window.AthleteContext.needsScheduleSetup === 'function' &&
        window.AthleteContext.needsScheduleSetup(user));
    setupBannerEl.hidden = !needsSetup;
    if (needsSetup && mount) {
      window.requestAnimationFrame(function () {
        mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
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

  function mountSportsEditor(user) {
    if (!mount || !window.AthleteSportsEditor) return;
    var ctx = window.AthleteProfileForm
      ? window.AthleteProfileForm.loadContext(user)
      : window.AthleteContext.loadAthleteContext(user);
    var sports = window.AthleteContext ? window.AthleteContext.getSports(ctx) : [];
    window.AthleteSportsEditor.mount(mount, {
      initialSports: sports,
      createDefault: !sports.length,
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
    completionEl.textContent = complete
      ? "We're synced — I'll coach around your real schedule."
      : 'Add your sports and pick a season phase for each. Practice and game days help Rocky plan better.';
    completionEl.classList.toggle('is-complete', complete);
  }

  function loadForm() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    mountSportsEditor(user);
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
