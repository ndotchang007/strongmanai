(function () {
  var LEGACY_STORAGE_KEY = 'strongman-coach-thread';
  var COACH_NAME = 'Rocky';

  function getStorageKey() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var uid = user && user.id != null ? String(user.id) : 'anon';
    return 'strongman-coach-thread-u' + uid;
  }

  function CoachThread(opts) {
    opts = opts || {};
    this.threadEl = opts.threadEl;
    this.composerEl = opts.composerEl;
    this.inputEl = opts.inputEl;
    this.sendBtn = opts.sendBtn;
    this.routineToggle = opts.routineToggle || null;
    this.physiqueToggle = opts.physiqueToggle || null;
    this.projectionToggle = opts.projectionToggle || document.getElementById('coach-projection-mode');
    this.capabilityGrid = opts.capabilityGrid || document.getElementById('coach-capability-grid');
    this.attachBtn = opts.attachBtn || null;
    this.imageInput = opts.imageInput || null;
    this.attachPreviewEl = opts.attachPreviewEl || null;
    this.micBtn = opts.micBtn || null;
    this.modelBtn = opts.modelBtn || null;
    this.modelMenu = opts.modelMenu || null;
    this.coachMode = 'chat';
    this.clearBtns = opts.clearBtns || (opts.clearBtn ? [opts.clearBtn] : []);
    this.quotaEl = opts.quotaEl;
    this.errorEl = opts.errorEl;
    this.chipsEl = opts.chipsEl;
    this.briefingEl = opts.briefingEl;
    this.briefingMobileEl = opts.briefingMobileEl;
    this.layoutEl = opts.layoutEl || document.getElementById('coach-layout');
    this.emptyHeroEl = opts.emptyHeroEl || document.getElementById('coach-empty-hero');
    this.modeStageEl = opts.modeStageEl || document.getElementById('coach-mode-stage');
    this.chatBodyEl =
      opts.chatBodyEl ||
      document.getElementById('coach-chat-body') ||
      (this.threadEl && this.threadEl.closest('.coach-chat-body')) ||
      null;
    this.modeBackBtn =
      opts.modeBackBtn ||
      document.getElementById('coach-modes-back') ||
      document.getElementById('coach-mode-back');
    this.chatBackBtn =
      opts.chatBackBtn ||
      document.getElementById('coach-modes-back') ||
      document.getElementById('coach-chat-back');
    this.projKind = 'lift';
    this.knowBtn = opts.knowBtn || null;
    this.knowDrawer = opts.knowDrawer || null;
    this.knowBackdrop = opts.knowBackdrop || null;
    this.knowCloseBtn = opts.knowCloseBtn || null;
    this.messages = [];
    this.pending = false;
    this.coachView = 'hub';
    this.projKind = 'lift';
    this.loadingEl = null;
    this.streamingEl = null;
    this.streamingTextEl = null;
    this.streamedText = '';
    this.pendingAttachments = [];
    this.recognition = null;
    this.isListening = false;
    this.typewriterTimer = null;
    this.loadFromStorage();
    if (window.location.search && /(?:^|[?&])new=1(?:&|$)/.test(window.location.search)) {
      this.messages = [];
      this.saveToStorage();
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    }
    this.syncMemoryFromThread();
    this.bindEvents();
    this.bindKnowDrawer();
    this.refreshBriefing();
    this.buildChips();
    this.applyCoachView('hub');
    this.fetchQuota();
    this.resumePendingReply();
    if (window.CoachPending) window.CoachPending.clearReplyReady();
  }

  CoachThread.prototype.hasActiveThread = function () {
    return this.coachView === 'chat';
  };

  CoachThread.prototype.getModeOutputEl = function () {
    if (this.coachView === 'physique') return document.getElementById('coach-physique-output');
    if (this.coachView === 'routine') return document.getElementById('coach-routine-output');
    if (this.coachView === 'projection') return document.getElementById('coach-projection-output');
    return null;
  };

  CoachThread.prototype.getMountEl = function () {
    if (this.coachView === 'chat') return this.threadEl;
    return this.getModeOutputEl() || this.threadEl;
  };

  CoachThread.prototype.viewScreenEl = function (view) {
    if (view === 'hub') return this.emptyHeroEl;
    if (view === 'physique' || view === 'routine' || view === 'projection') return this.modeStageEl;
    if (view === 'chat') return this.threadEl;
    return null;
  };

  CoachThread.prototype.prefersReducedMotion = function () {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  };

  CoachThread.prototype.navDirection = function (from, to) {
    if (to === 'hub') return 'back';
    if (from === 'hub') return 'forward';
    if (from === 'chat' && to !== 'chat') return 'back';
    return 'forward';
  };

  CoachThread.prototype.setCoachView = function (view) {
    var next = view || 'hub';
    if (next === 'physique') {
      this.setError('Physique scanner is coming soon.');
      next = 'hub';
    }
    if (next !== 'hub' && next !== 'chat' && next !== 'physique' && next !== 'routine' && next !== 'projection') {
      next = 'hub';
    }
    var prev = this.coachView || 'hub';
    if (this._viewTransitioning) return;
    if (prev === next) {
      this.applyCoachView(next);
      return;
    }
    if (this.prefersReducedMotion()) {
      this.applyCoachView(next);
      return;
    }
    this.transitionCoachView(prev, next, this.navDirection(prev, next));
  };

  CoachThread.prototype.applyCoachView = function (next) {
    this.coachView = next;
    if (next === 'physique' || next === 'routine' || next === 'projection' || next === 'chat') {
      this.coachMode = next === 'chat' ? 'chat' : next;
    } else {
      this.coachMode = 'chat';
    }
    if (this.emptyHeroEl) {
      this.emptyHeroEl.classList.remove(
        'coach-screen-enter-forward',
        'coach-screen-enter-back',
        'coach-screen-exit-forward',
        'coach-screen-exit-back'
      );
    }
    if (this.modeStageEl) {
      this.modeStageEl.classList.remove(
        'coach-screen-enter-forward',
        'coach-screen-enter-back',
        'coach-screen-exit-forward',
        'coach-screen-exit-back'
      );
    }
    if (this.threadEl) {
      this.threadEl.classList.remove(
        'coach-screen-enter-forward',
        'coach-screen-enter-back',
        'coach-screen-exit-forward',
        'coach-screen-exit-back'
      );
    }
    if (this.composerEl) {
      this.composerEl.classList.remove('coach-composer-enter', 'coach-composer-exit');
    }
    if (this.layoutEl) {
      this.layoutEl.classList.remove('is-transitioning', 'nav-back', 'nav-forward');
    }
    this.syncLayoutState();
    this.resetViewScroll();
    if (next === 'chat') {
      this.render();
      if (this.inputEl) {
        try {
          this.inputEl.focus({ preventScroll: true });
        } catch (e) {
          try {
            this.inputEl.focus();
          } catch (e2) {}
        }
      }
    }
    if (next === 'hub') {
      // Do not restart the typewriter — clearing the greeting reflows the hub and feels like a jump.
      this.runEmptyGreetingTypewriter({ restart: false });
    }
    if (next === 'projection') this.prefillProjectionDefaults();
    if (next === 'routine') this.prefillRoutineDefaults();
    this.setError('');
    var self = this;
    requestAnimationFrame(function () {
      self.resetViewScroll();
    });
  };

  CoachThread.prototype.resetViewScroll = function () {
    var nodes = [];
    var body = this.chatBodyEl || (this.threadEl && this.threadEl.closest('.coach-chat-body'));
    if (body) nodes.push(body);
    if (this.modeStageEl) nodes.push(this.modeStageEl);
    if (this.emptyHeroEl) nodes.push(this.emptyHeroEl);
    var mainWrap = document.querySelector('.main-wrap');
    if (mainWrap) nodes.push(mainWrap);
    var chat = document.querySelector('.coach-chat');
    if (chat) nodes.push(chat);
    nodes.push(document.documentElement, document.body);
    nodes.forEach(function (el) {
      if (el && typeof el.scrollTop === 'number') el.scrollTop = 0;
    });
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
    this.updateScrollFade();
  };

  CoachThread.prototype.transitionCoachView = function (from, to, dir) {
    var self = this;
    var fromEl = this.viewScreenEl(from);
    var toEl = this.viewScreenEl(to);
    this._viewTransitioning = true;
    this.coachView = to;
    if (to === 'physique' || to === 'routine' || to === 'projection' || to === 'chat') {
      this.coachMode = to === 'chat' ? 'chat' : to;
    } else {
      this.coachMode = 'chat';
    }

    var isMode = to === 'physique' || to === 'routine' || to === 'projection';
    if (this.layoutEl) {
      this.layoutEl.classList.toggle('is-empty', to === 'hub');
      this.layoutEl.classList.toggle('is-active', to !== 'hub');
      this.layoutEl.classList.toggle('is-mode', isMode);
      this.layoutEl.classList.toggle('is-chat', to === 'chat');
      this.layoutEl.dataset.coachView = to;
      this.layoutEl.classList.add('is-transitioning', dir === 'back' ? 'nav-back' : 'nav-forward');
    }

    // Show both screens for the slide, then settle.
    if (this.emptyHeroEl) this.emptyHeroEl.hidden = !(from === 'hub' || to === 'hub');
    if (this.modeStageEl) {
      this.modeStageEl.hidden = !(
        from === 'physique' ||
        from === 'routine' ||
        from === 'projection' ||
        isMode
      );
    }
    if (this.threadEl) this.threadEl.hidden = !(from === 'chat' || to === 'chat');
    if (this.composerEl) this.composerEl.hidden = to !== 'chat' && from !== 'chat';

    if (isMode) {
      document.querySelectorAll('[data-mode-panel]').forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-mode-panel') !== to;
      });
    }
    if (to === 'chat') {
      if (this.composerEl) {
        this.composerEl.hidden = false;
        this.composerEl.classList.add('coach-composer-enter');
      }
      this.render();
    }
    if (from === 'chat' && to !== 'chat' && this.composerEl) {
      this.composerEl.classList.add('coach-composer-exit');
    }
    if (to === 'projection') this.prefillProjectionDefaults();
    if (to === 'routine') this.prefillRoutineDefaults();

    if (toEl) {
      toEl.hidden = false;
      toEl.classList.remove(
        'coach-screen-exit-forward',
        'coach-screen-exit-back',
        'coach-screen-enter-forward',
        'coach-screen-enter-back'
      );
      void toEl.offsetWidth;
      toEl.classList.add(dir === 'back' ? 'coach-screen-enter-back' : 'coach-screen-enter-forward');
    }
    if (fromEl && fromEl !== toEl) {
      fromEl.hidden = false;
      fromEl.classList.remove(
        'coach-screen-exit-forward',
        'coach-screen-exit-back',
        'coach-screen-enter-forward',
        'coach-screen-enter-back'
      );
      void fromEl.offsetWidth;
      fromEl.classList.add(dir === 'back' ? 'coach-screen-exit-back' : 'coach-screen-exit-forward');
    }

    var settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      self._viewTransitioning = false;
      self.applyCoachView(to);
    }
    window.setTimeout(finish, 360);
  };

  CoachThread.prototype.prefillRoutineDefaults = function () {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var AC = window.AthleteContext;
    var ctx = AC && user && typeof AC.loadAthleteContext === 'function' ? AC.loadAthleteContext(user) : null;
    var goal = (ctx && ctx.primaryGoal) || 'strength';
    var goalRadio = document.querySelector(
      'input[name="coach-routine-goal"][value="' + goal + '"]'
    );
    if (goalRadio) goalRadio.checked = true;

    var schoolCap =
      ctx && ctx.schoolNightMaxMinutes != null ? Number(ctx.schoolNightMaxMinutes) : null;
    if (schoolCap) {
      var nearest = [45, 60, 75, 90].reduce(function (best, n) {
        return Math.abs(n - schoolCap) < Math.abs(best - schoolCap) ? n : best;
      }, 60);
      var minRadio = document.querySelector(
        'input[name="coach-routine-minutes"][value="' + nearest + '"]'
      );
      if (minRadio) minRadio.checked = true;
    }
  };

  CoachThread.prototype.syncProjectionBwDelta = function () {
    var amountEl = document.getElementById('coach-proj-bw-amount');
    var deltaEl = document.getElementById('coach-proj-bw-delta');
    var dirEl = document.querySelector('input[name="coach-proj-bw-dir"]:checked');
    if (!amountEl || !deltaEl) return;
    var amount = Math.abs(parseFloat(amountEl.value) || 0);
    var dir = dirEl ? dirEl.value : 'lose';
    deltaEl.value = String(dir === 'gain' ? amount : -amount);
  };

  CoachThread.prototype.bestPrForLift = function (liftName) {
    var best = null;
    if (!window.PRLog || typeof window.PRLog.getRecords !== 'function') return best;
    var needle = String(liftName || '')
      .toLowerCase()
      .split(' ')[0];
    window.PRLog.getRecords().forEach(function (r) {
      if (!r || r.discipline !== 'weightlifting') return;
      if (String(r.eventLabel || '').toLowerCase().indexOf(needle) === -1) return;
      if (r.weight == null) return;
      var w = Number(r.weight);
      if (!isFinite(w)) return;
      if (best == null || w > best) best = w;
    });
    return best;
  };

  CoachThread.prototype.defaultLiftCurrent = function (liftName) {
    var n = String(liftName || '').toLowerCase();
    if (n.indexOf('squat') !== -1) return 225;
    if (n.indexOf('deadlift') !== -1) return 275;
    if (n.indexOf('overhead') !== -1 || n.indexOf('ohp') !== -1) return 115;
    return 185; // bench / default
  };

  CoachThread.prototype.syncLiftProjectionFields = function (opts) {
    opts = opts || {};
    var liftSelect = document.getElementById('coach-proj-lift-name');
    var liftNow = document.getElementById('coach-proj-lift-now');
    var liftTarget = document.getElementById('coach-proj-lift-target');
    var sourceEl = document.getElementById('coach-proj-lift-source');
    if (!liftSelect || !liftNow) return;
    var lift = liftSelect.value || 'Bench Press';
    var best = this.bestPrForLift(lift);
    var current;
    var source;
    if (best != null) {
      current = Math.round(best);
      source = 'From your PRs';
    } else {
      current = this.defaultLiftCurrent(lift);
      source = 'Default start';
    }
    if (opts.force || !liftNow.dataset.userTouched) {
      liftNow.value = String(current);
    }
    if (sourceEl) sourceEl.textContent = source;
    if (liftTarget && (opts.force || !liftTarget.dataset.userTouched)) {
      var t = Math.max(Number(liftTarget.value) || 0, Math.round(current + 40));
      liftTarget.value = String(Math.round(t / 5) * 5);
    }
  };

  CoachThread.prototype.adjustStepperValue = function (inputId, delta) {
    var el = document.getElementById(inputId);
    if (!el) return;
    var min = el.min !== '' && el.min != null ? Number(el.min) : null;
    var max = el.max !== '' && el.max != null ? Number(el.max) : null;
    var cur = parseFloat(el.value);
    if (isNaN(cur)) cur = 0;
    var next = cur + Number(delta || 0);
    if (min != null && isFinite(min)) next = Math.max(min, next);
    if (max != null && isFinite(max)) next = Math.min(max, next);
    // Keep 5 lb increments for lift/bodyweight steppers
    next = Math.round(next / 5) * 5;
    if (min != null && isFinite(min) && next < min) next = min;
    el.value = String(next);
    el.dataset.userTouched = '1';
    if (inputId === 'coach-proj-bw-amount' || inputId === 'coach-proj-bw-now') {
      this.syncProjectionBwDelta();
    }
    try {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
  };

  CoachThread.prototype.prefillProjectionDefaults = function () {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var bwEl = document.getElementById('coach-proj-bw-now');
    if (bwEl && !bwEl.dataset.userTouched && user && user.weight != null && !isNaN(Number(user.weight))) {
      bwEl.value = String(Math.round(Number(user.weight) / 5) * 5);
    }
    this.syncProjectionBwDelta();
    this.syncLiftProjectionFields({ force: true });
  };

  CoachThread.prototype.syncLayoutState = function () {
    var view = this.coachView || 'hub';
    var isHub = view === 'hub';
    var isChat = view === 'chat';
    var isMode = view === 'physique' || view === 'routine' || view === 'projection';

    if (this.layoutEl) {
      this.layoutEl.classList.toggle('is-empty', isHub);
      this.layoutEl.classList.toggle('is-active', !isHub);
      this.layoutEl.classList.toggle('is-mode', isMode);
      this.layoutEl.classList.toggle('is-chat', isChat);
      this.layoutEl.dataset.coachView = view;
    }

    if (this.emptyHeroEl) {
      if (isHub) this.emptyHeroEl.removeAttribute('hidden');
      else this.emptyHeroEl.setAttribute('hidden', '');
    }
    if (this.modeStageEl) {
      if (isMode) this.modeStageEl.removeAttribute('hidden');
      else this.modeStageEl.setAttribute('hidden', '');
    }
    if (this.composerEl) {
      if (isChat) this.composerEl.removeAttribute('hidden');
      else this.composerEl.setAttribute('hidden', '');
    }
    if (this.threadEl) {
      if (isChat) this.threadEl.removeAttribute('hidden');
      else this.threadEl.setAttribute('hidden', '');
    }

    document.querySelectorAll('[data-mode-panel]').forEach(function (panel) {
      var on = isMode && panel.getAttribute('data-mode-panel') === view;
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });

    document.body.classList.toggle('coach-chat-active', isChat);
    document.body.classList.toggle('coach-chat-empty', isHub);
    document.body.classList.toggle('coach-mode-active', isMode);

    // Don't restart the typewriter here — syncLayoutState runs often and
    // was causing overlapping animations. applyCoachView handles hub entry.
    this.bindScrollFade();
    this.updateScrollFade();
  };

  CoachThread.prototype.bindScrollFade = function () {
    var el = this.getScrollContainer();
    if (!el || el.getAttribute('data-scroll-fade-bound') === '1') return;
    el.setAttribute('data-scroll-fade-bound', '1');
    var self = this;
    el.addEventListener(
      'scroll',
      function () {
        self.updateScrollFade();
      },
      { passive: true }
    );
    window.addEventListener('resize', function () {
      self.updateScrollFade();
    });
  };

  CoachThread.prototype.updateScrollFade = function () {
    var el = this.getScrollContainer();
    if (!el) return;
    var canScroll = el.scrollHeight > el.clientHeight + 8;
    el.classList.toggle('is-scrollable', canScroll);
  };

  CoachThread.prototype.showHubGreeting = function () {
    var el =
      (this.emptyHeroEl && this.emptyHeroEl.querySelector('.coach-empty-greeting')) ||
      document.querySelector('.coach-empty-greeting');
    if (!el) return;
    if (this._greetingTimer) {
      window.clearTimeout(this._greetingTimer);
      this._greetingTimer = null;
    }
    this._greetingGen = (this._greetingGen || 0) + 1;
    el.classList.remove('is-typing');
    el.textContent = "What's up Champ — what do you need?";
  };

  CoachThread.prototype.runEmptyGreetingTypewriter = function (opts) {
    opts = opts || {};
    var el =
      (this.emptyHeroEl && this.emptyHeroEl.querySelector('.coach-empty-greeting')) ||
      document.querySelector('.coach-empty-greeting');
    if (!el) return;

    var full = "What's up Champ — what do you need?";
    if (this._greetingTimer) {
      window.clearTimeout(this._greetingTimer);
      this._greetingTimer = null;
    }

    // Already finished once this session and not forced — keep static text.
    if (!opts.restart && el.dataset.typed === '1') {
      el.classList.remove('is-typing');
      el.textContent = full;
      return;
    }

    var reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.dataset.typed = '1';
      el.classList.remove('is-typing');
      el.textContent = full;
      return;
    }

    var gen = (this._greetingGen || 0) + 1;
    this._greetingGen = gen;
    el.dataset.typed = '0';
    el.textContent = '';
    el.classList.add('is-typing');

    var self = this;
    var i = 0;
    function tick() {
      if (self._greetingGen !== gen) return;
      if (i >= full.length) {
        el.classList.remove('is-typing');
        el.dataset.typed = '1';
        self._greetingTimer = null;
        return;
      }
      el.textContent += full.charAt(i);
      i += 1;
      self._greetingTimer = window.setTimeout(
        tick,
        22 + (full.charAt(i - 1) === ' ' ? 18 : 0)
      );
    }
    tick();
  };

  CoachThread.prototype.setKnowDrawerOpen = function (open) {
    var isOpen = !!open;
    if (this.knowDrawer) {
      this.knowDrawer.hidden = !isOpen;
      this.knowDrawer.classList.toggle('is-open', isOpen);
    }
    if (this.knowBackdrop) {
      this.knowBackdrop.hidden = !isOpen;
    }
    if (this.knowBtn) {
      this.knowBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    document.body.classList.toggle('coach-know-open', isOpen);
    if (isOpen) this.refreshBriefing();
  };

  CoachThread.prototype.bindKnowDrawer = function () {
    var self = this;
    if (this.knowBtn) {
      this.knowBtn.addEventListener('click', function () {
        var open = self.knowBtn.getAttribute('aria-expanded') === 'true';
        self.setKnowDrawerOpen(!open);
      });
    }
    if (this.knowCloseBtn) {
      this.knowCloseBtn.addEventListener('click', function () {
        self.setKnowDrawerOpen(false);
      });
    }
    if (this.knowBackdrop) {
      this.knowBackdrop.addEventListener('click', function () {
        self.setKnowDrawerOpen(false);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.setKnowDrawerOpen(false);
    });
  };

  CoachThread.prototype.getScrollContainer = function () {
    if (!this.threadEl) return null;
    var body = this.threadEl.closest('.coach-chat-body');
    return body || this.threadEl;
  };

  CoachThread.prototype.scrollThread = function (toBottom) {
    var el = this.getScrollContainer();
    if (!el) return;
    if (toBottom) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = 0;
    }
    this.updateScrollFade();
  };

  CoachThread.prototype.loadFromStorage = function () {
    this.messages = [];
    if (window.CoachPending && typeof window.CoachPending.loadThread === 'function') {
      this.messages = window.CoachPending.loadThread();
    } else {
      var key = getStorageKey();
      try {
        var raw = localStorage.getItem(key);
        if (!raw) {
          raw = sessionStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) {
            localStorage.setItem(key, raw);
            sessionStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
        if (raw) this.messages = JSON.parse(raw);
      } catch (e) {
        this.messages = [];
      }
    }
    if (!Array.isArray(this.messages)) this.messages = [];
  };

  CoachThread.prototype.saveToStorage = function () {
    try {
      var thin = (this.messages || []).slice(-40).map(function (m) {
        if (!m || !m.images || !m.images.length) return m;
        var copy = Object.assign({}, m);
        copy.images = m.images.map(function () {
          return { placeholder: true };
        });
        return copy;
      });
      if (window.CoachPending && typeof window.CoachPending.saveThread === 'function') {
        window.CoachPending.saveThread(thin);
      } else {
        localStorage.setItem(getStorageKey(), JSON.stringify(thin));
      }
    } catch (e) {}
  };

  CoachThread.prototype.getUserInitial = function () {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (user && user.firstName) return String(user.firstName).charAt(0).toUpperCase();
    return 'You';
  };

  CoachThread.prototype.syncMemoryFromThread = function () {
    if (!window.CoachMemory) return;
    // Merge from thread — never wipe durable memory that may have synced from server
    var self = this;
    this.messages.forEach(function (m) {
      if (m.role === 'user' && m.content) {
        window.CoachMemory.ingestUserMessage(m.content);
      }
    });
  };

  CoachThread.prototype.refreshBriefing = function () {
    if (!window.CoachBriefing) return;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    window.CoachBriefing.render(this.briefingEl, user, {
      mobileEl: this.briefingMobileEl,
    });
  };

  CoachThread.prototype.getContextBlock = function () {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var extras = {};
    try {
      extras.notes = localStorage.getItem('strongman-coach-anything-else') || '';
    } catch (e) {}
    var parts = [];
    if (window.AthleteContext && user) {
      var builder =
        typeof window.AthleteContext.buildCompactCoachPromptBlock === 'function'
          ? window.AthleteContext.buildCompactCoachPromptBlock
          : window.AthleteContext.buildCoachPromptBlock;
      parts.push(builder.call(window.AthleteContext, user, extras));
    }
    if (window.CoachMemory) {
      var memBlock = window.CoachMemory.buildPromptBlock(window.CoachMemory.load());
      if (memBlock) parts.push(memBlock);
    }
    return parts.filter(Boolean).join('\n\n');
  };

  CoachThread.prototype.buildChips = function () {
    if (!this.chipsEl) return;
    this.chipsEl.innerHTML = '';
    this.chipsEl.hidden = true;
  };

  CoachThread.prototype.autosizeInput = function () {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    var next = Math.min(Math.max(this.inputEl.scrollHeight, 24), 160);
    this.inputEl.style.height = next + 'px';
    if (this.composerEl) {
      this.composerEl.classList.toggle('coach-composer--multiline', next > 40);
    }
  };

  CoachThread.prototype.syncModeFromToggles = function () {
    if (this.physiqueToggle && this.physiqueToggle.checked) {
      this.setCoachMode('physique');
    } else if (this.routineToggle && this.routineToggle.checked) {
      this.setCoachMode('routine');
    } else if (this.projectionToggle && this.projectionToggle.checked) {
      this.setCoachMode('projection');
    } else {
      this.setCoachMode('chat');
    }
  };

  CoachThread.prototype.clearModeTogglesExcept = function (keep) {
    if (this.routineToggle && keep !== 'routine') this.routineToggle.checked = false;
    if (this.physiqueToggle && keep !== 'physique') this.physiqueToggle.checked = false;
    if (this.projectionToggle && keep !== 'projection') this.projectionToggle.checked = false;
  };

  CoachThread.prototype.renderAttachPreview = function () {
    var el = this.attachPreviewEl;
    if (!el) return;
    el.innerHTML = '';
    if (!this.pendingAttachments.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    var self = this;
    this.pendingAttachments.forEach(function (att, idx) {
      var chip = document.createElement('div');
      chip.className = 'coach-attach-chip';
      var img = document.createElement('img');
      img.src = att.previewUrl || ('data:' + att.mediaType + ';base64,' + att.data);
      img.alt = 'Attachment ' + (idx + 1);
      chip.appendChild(img);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'coach-attach-remove';
      remove.setAttribute('aria-label', 'Remove image');
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        if (self.pendingAttachments[idx] && self.pendingAttachments[idx].previewUrl) {
          try {
            URL.revokeObjectURL(self.pendingAttachments[idx].previewUrl);
          } catch (eRev) {}
        }
        self.pendingAttachments.splice(idx, 1);
        self.renderAttachPreview();
      });
      chip.appendChild(remove);
      el.appendChild(chip);
    });
  };

  CoachThread.prototype.compressImageFile = function (file) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Not an image'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Could not read image'));
      };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxSide = 1280;
          var w = img.width;
          var h = img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          var dataUrl = canvas.toDataURL(mediaType, 0.78);
          var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
          if (!m) {
            reject(new Error('Could not encode image'));
            return;
          }
          resolve({
            mediaType: m[1],
            data: m[2],
            previewUrl: URL.createObjectURL(file),
          });
        };
        img.onerror = function () {
          reject(new Error('Could not load image'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  CoachThread.prototype.addImageFiles = function (fileList) {
    var self = this;
    var files = Array.prototype.slice.call(fileList || [], 0).slice(0, 3);
    if (!files.length) return;
    var room = Math.max(0, 3 - this.pendingAttachments.length);
    files = files.slice(0, room);
    Promise.all(
      files.map(function (f) {
        return self.compressImageFile(f).catch(function () {
          return null;
        });
      })
    ).then(function (atts) {
      atts.forEach(function (a) {
        if (a) self.pendingAttachments.push(a);
      });
      self.renderAttachPreview();
      if (self.coachMode === 'physique' && self.inputEl && !self.inputEl.value.trim()) {
        self.inputEl.placeholder = 'Optional notes — what should Rocky focus on?';
      }
    });
  };

  CoachThread.prototype.clearAttachments = function () {
    this.pendingAttachments.forEach(function (a) {
      if (a && a.previewUrl) {
        try {
          URL.revokeObjectURL(a.previewUrl);
        } catch (e) {}
      }
    });
    this.pendingAttachments = [];
    this.renderAttachPreview();
  };

  CoachThread.prototype.toggleModelMenu = function (force) {
    if (!this.modelMenu || !this.modelBtn) return;
    var open = typeof force === 'boolean' ? force : this.modelMenu.hidden;
    this.modelMenu.hidden = !open;
    this.modelBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  CoachThread.prototype.toggleDictation = function () {
    var self = this;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.setError('Voice input is not supported in this browser.');
      return;
    }
    if (this.isListening && this.recognition) {
      try {
        this.recognition.stop();
      } catch (eStop) {}
      this.isListening = false;
      if (this.micBtn) this.micBtn.classList.remove('is-listening');
      return;
    }
    var rec = new SR();
    this.recognition = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = function () {
      self.isListening = true;
      if (self.micBtn) self.micBtn.classList.add('is-listening');
    };
    rec.onresult = function (ev) {
      var text = '';
      for (var i = 0; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      if (self.inputEl) {
        self.inputEl.value = text.trim();
        self.autosizeInput();
      }
    };
    rec.onerror = function () {
      self.isListening = false;
      if (self.micBtn) self.micBtn.classList.remove('is-listening');
    };
    rec.onend = function () {
      self.isListening = false;
      if (self.micBtn) self.micBtn.classList.remove('is-listening');
    };
    try {
      rec.start();
    } catch (eStart) {
      this.setError('Could not start microphone.');
    }
  };

  CoachThread.prototype.bindEvents = function () {
    var self = this;
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', function () {
        self.send();
      });
    }
    if (this.routineToggle) {
      this.routineToggle.addEventListener('change', function () {
        if (self.routineToggle.checked) self.clearModeTogglesExcept('routine');
        self.setCoachMode(self.routineToggle.checked ? 'routine' : 'chat');
      });
    }
    if (this.physiqueToggle) {
      this.physiqueToggle.addEventListener('change', function () {
        if (self.physiqueToggle.checked) self.clearModeTogglesExcept('physique');
        self.setCoachMode(self.physiqueToggle.checked ? 'physique' : 'chat');
      });
    }
    if (this.projectionToggle) {
      this.projectionToggle.addEventListener('change', function () {
        if (self.projectionToggle.checked) self.clearModeTogglesExcept('projection');
        self.setCoachMode(self.projectionToggle.checked ? 'projection' : 'chat');
      });
    }
    if (this.emptyHeroEl) {
      this.emptyHeroEl.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-coach-capability]');
        if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
        var cap = btn.getAttribute('data-coach-capability') || 'chat';
        if (cap === 'physique') {
          self.setError('Physique scanner is coming soon.');
          return;
        }
        self.setCoachView(cap);
      });
    }
    function goHub() {
      if (self.pending) return;
      self.setCoachView('hub');
    }
    if (this.modeBackBtn) this.modeBackBtn.addEventListener('click', goHub);
    if (this.chatBackBtn && this.chatBackBtn !== this.modeBackBtn) {
      this.chatBackBtn.addEventListener('click', goHub);
    }
    var physiqueGo = document.getElementById('coach-physique-go');
    if (physiqueGo) {
      physiqueGo.addEventListener('click', function () {
        self.setError('Physique scanner is coming soon.');
      });
    }
    var routineGo = document.getElementById('coach-routine-go');
    if (routineGo) {
      routineGo.addEventListener('click', function () {
        self.generateFullRoutine();
      });
    }
    var projectionGo = document.getElementById('coach-projection-go');
    if (projectionGo) {
      projectionGo.addEventListener('click', function () {
        self.runFutureProjectionFromUi();
      });
    }
    function setProjKind(kind) {
      self.projKind = kind || 'lift';
      document.querySelectorAll('[data-proj-kind], input[name="coach-proj-kind"]').forEach(function (el) {
        var k = el.getAttribute('data-proj-kind') || el.value;
        if (el.tagName === 'INPUT') el.checked = k === self.projKind;
        else el.classList.toggle('is-active', k === self.projKind);
      });
      var bw = document.getElementById('coach-proj-bw-fields');
      var lift = document.getElementById('coach-proj-lift-fields');
      if (bw) bw.hidden = self.projKind !== 'bodyweight';
      if (lift) lift.hidden = self.projKind !== 'lift';
    }
    document.querySelectorAll('[data-proj-kind], input[name="coach-proj-kind"]').forEach(function (el) {
      el.addEventListener('change', function () {
        setProjKind(el.getAttribute('data-proj-kind') || el.value);
      });
      el.addEventListener('click', function () {
        if (el.tagName === 'INPUT') return;
        setProjKind(el.getAttribute('data-proj-kind') || 'lift');
      });
    });
    document.querySelectorAll('input[name="coach-proj-bw-dir"], #coach-proj-bw-amount').forEach(function (el) {
      el.addEventListener('change', function () {
        self.syncProjectionBwDelta();
      });
      el.addEventListener('input', function () {
        self.syncProjectionBwDelta();
      });
    });
    var liftSelect = document.getElementById('coach-proj-lift-name');
    if (liftSelect) {
      liftSelect.addEventListener('change', function () {
        var liftNow = document.getElementById('coach-proj-lift-now');
        var liftTarget = document.getElementById('coach-proj-lift-target');
        if (liftNow) delete liftNow.dataset.userTouched;
        if (liftTarget) delete liftTarget.dataset.userTouched;
        self.syncLiftProjectionFields({ force: true });
      });
    }
    document.querySelectorAll('.coach-stepper [data-adj]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var host = btn.closest('.coach-stepper');
        var id = host && host.getAttribute('data-stepper-for');
        var adj = parseFloat(btn.getAttribute('data-adj'));
        if (!id || isNaN(adj)) return;
        self.adjustStepperValue(id, adj);
      });
    });
    ['coach-proj-lift-now', 'coach-proj-lift-target', 'coach-proj-bw-now', 'coach-proj-bw-amount'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
          el.dataset.userTouched = '1';
        });
      }
    );
    document.querySelectorAll('.coach-choice input[type="radio"]').forEach(function (input) {
      function syncChoice() {
        var name = input.name;
        if (!name) return;
        document.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
          var label = el.closest && el.closest('.coach-choice');
          if (label) label.classList.toggle('is-selected', !!el.checked);
        });
      }
      input.addEventListener('change', syncChoice);
      syncChoice();
    });
    if (this.attachBtn && this.imageInput) {
      this.attachBtn.addEventListener('click', function () {
        self.imageInput.click();
      });
      this.imageInput.addEventListener('change', function () {
        self.addImageFiles(self.imageInput.files);
        self.imageInput.value = '';
      });
    }
    var dropzone = document.getElementById('coach-physique-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('is-dragover');
      });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        if (e.dataTransfer && e.dataTransfer.files) self.addImageFiles(e.dataTransfer.files);
      });
    }
    if (this.micBtn) {
      this.micBtn.addEventListener('click', function () {
        self.toggleDictation();
      });
    }
    if (this.modelBtn) {
      this.modelBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.toggleModelMenu();
      });
    }
    document.addEventListener('click', function () {
      self.toggleModelMenu(false);
    });
    if (this.modelMenu) {
      this.modelMenu.addEventListener('click', function (e) {
        e.stopPropagation();
        var opt = e.target.closest('[data-coach-mode]');
        if (!opt || opt.disabled) return;
        var mode = opt.getAttribute('data-coach-mode') || 'chat';
        self.setCoachMode(mode);
        self.toggleModelMenu(false);
      });
    }
    this.clearBtns.forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (self.pending) return;
        self.messages = [];
        if (window.CoachPending) window.CoachPending.clearPending();
        self.clearAttachments();
        self.saveToStorage();
        self.setCoachView('hub');
        self.refreshBriefing();
        self.setError('');
      });
    });
    if (this.inputEl) {
      this.inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.send();
        }
      });
      this.inputEl.addEventListener('input', function () {
        self.autosizeInput();
      });
      this.autosizeInput();
    }

    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('strongman-coach-thread') !== 0) return;
      self.loadFromStorage();
      self.syncMemoryFromThread();
      self.render();
    });

    window.addEventListener('pageshow', function () {
      self.loadFromStorage();
      self.setCoachView('hub');
      if (window.CoachPending && window.CoachPending.hasPendingReply()) {
        self.resumePendingReply();
      }
    });
  };

  CoachThread.prototype.setError = function (msg) {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg || '';
    this.errorEl.hidden = !msg;
  };

  CoachThread.prototype.setQuota = function () {
    if (this.quotaEl) {
      this.quotaEl.textContent = '';
      this.quotaEl.hidden = true;
    }
  };

  CoachThread.prototype.fetchQuota = function () {
    /* Quota UI removed from coach hub. */
  };

  CoachThread.prototype.createChatRow = function (role, bubbleNode) {
    var row = document.createElement('div');
    row.className = 'coach-chat-row coach-chat-row--' + role;

    if (role === 'assistant') {
      var rockyAvatar = document.createElement('span');
      rockyAvatar.className = 'coach-chat-avatar coach-chat-avatar--rocky';
      rockyAvatar.setAttribute('aria-hidden', 'true');
      rockyAvatar.textContent = 'R';
      row.appendChild(rockyAvatar);
    }

    var body = document.createElement('div');
    body.className = 'coach-chat-row-body';

    var name = document.createElement('span');
    name.className = 'coach-chat-row-name';
    name.textContent = role === 'user' ? 'You' : COACH_NAME;
    body.appendChild(name);

    if (bubbleNode) body.appendChild(bubbleNode);
    row.appendChild(body);

    if (role === 'user') {
      var userAvatar = document.createElement('span');
      userAvatar.className = 'coach-chat-avatar coach-chat-avatar--user';
      userAvatar.setAttribute('aria-hidden', 'true');
      userAvatar.textContent = this.getUserInitial();
      row.appendChild(userAvatar);
    }

    return row;
  };

  CoachThread.prototype.renderWelcome = function () {
    var bubble = document.createElement('div');
    bubble.className = 'coach-msg coach-msg--assistant coach-msg--welcome';
    var AC = window.AthleteContext;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ctx = AC && user ? AC.loadAthleteContext(user) : null;
    var sports = AC && ctx && AC.getSports ? AC.getSports(ctx) : [];
    var sportFocused = AC && ctx && AC.isSportFocusedGoal ? AC.isSportFocusedGoal(ctx) : sports.length > 0;
    if (!sportFocused) {
      bubble.textContent =
        "Yo — Rocky here. I've got your goals and session caps from your profile. Tell me how you're feeling — beat up, short on time, or ready to move — and we'll build something that fits. Need a workout or just straight talk? Hit me, or tap something below.";
    } else if (sports.length) {
      bubble.textContent =
        "Yo — Rocky here. I already got your sport and schedule from your profile. Tell me how you're feeling — beat up, sick, short on sleep — and we'll work with it. Need a workout or just straight talk? Hit me, or tap something below.";
    } else {
      bubble.textContent =
        "Yo — Rocky here. When you get a chance, add your sport schedule in User settings — until then, tell me what you need and we'll work with it. Need a workout or just straight talk? Hit me, or tap something below.";
    }
    return this.createChatRow('assistant', bubble);
  };

  CoachThread.prototype.render = function () {
    if (!this.threadEl) return;
    this.syncLayoutState();
    if (this.coachView !== 'chat') {
      this.renderModeOutput();
      return;
    }
    this.threadEl.innerHTML = '';
    var self = this;
    if (!this.messages.length) {
      this.scrollThread(false);
      return;
    }
    this.messages.forEach(function (msg) {
      self.threadEl.appendChild(self.renderMessage(msg));
    });
    this.scrollThread(true);
  };

  CoachThread.prototype.renderModeOutput = function () {
    var mount = this.getModeOutputEl();
    if (!mount) return;
    var last = null;
    for (var i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i] && this.messages[i].role === 'assistant') {
        last = this.messages[i];
        break;
      }
    }
    if (!last) return;
    mount.hidden = false;
    mount.innerHTML = '';
    if (this.coachView === 'projection' && last.projection) {
      mount.appendChild(this.renderProjectionGraphic(last.projection));
    }
    mount.appendChild(this.renderMessage(last));
  };

  CoachThread.prototype.renderProjectionGraphic = function (proj) {
    var wrap = document.createElement('div');
    wrap.className = 'coach-proj-result';
    var weeks = proj.weeks != null ? proj.weeks : '—';
    var months = proj.months != null ? proj.months : '—';
    var rate =
      proj.weeklyRate != null
        ? (proj.weeklyRate > 0 ? '+' : '') + proj.weeklyRate + ' / week'
        : '';
    wrap.innerHTML =
      '<div class="coach-proj-result-copy">' +
      '<strong>~' +
      weeks +
      ' weeks</strong>' +
      '<p>' +
      (proj.label || 'Goal') +
      ' · ~' +
      months +
      ' months' +
      (rate ? ' · ' + rate : '') +
      '</p>' +
      '</div>';
    return wrap;
  };

  CoachThread.prototype.formatWorkoutPlain = function (workout) {
    if (!workout) return '';
    var lines = [];
    if (workout.title) lines.push(workout.title);
    if (workout.focus) lines.push(workout.focus);
    if (workout.durationMin) lines.push(workout.durationMin + ' min');
    if (workout.fyi) {
      lines.push('');
      lines.push(workout.fyi);
    }
    (workout.blocks || []).forEach(function (block) {
      lines.push('');
      lines.push((block.name || 'BLOCK').toUpperCase());
      (block.exercises || []).forEach(function (ex) {
        var row = '- ' + (ex.name || 'Exercise');
        if (ex.prescription) row += '  ' + ex.prescription;
        lines.push(row);
        if (ex.why) lines.push('    ' + ex.why);
      });
    });
    (workout.notes || []).forEach(function (n, i) {
      var t = typeof n === 'string' ? n : n && n.text;
      if (!t) return;
      if (i === 0) lines.push('', 'Notes');
      lines.push('- ' + t);
    });
    return lines.join('\n').trim();
  };

  CoachThread.prototype.renderMessage = function (msg) {
    var bubble = document.createElement('div');
    bubble.className =
      'coach-msg coach-msg--' + (msg.role === 'user' ? 'user' : 'assistant');

    if (msg.role === 'user') {
      if (msg.images && msg.images.length) {
        var thumbs = document.createElement('div');
        thumbs.className = 'coach-msg-thumbs';
        msg.images.forEach(function (img) {
          var src =
            (img && img.previewUrl) ||
            (img && img.data
              ? 'data:' + (img.mediaType || 'image/jpeg') + ';base64,' + img.data
              : '');
          if (src) {
            var el = document.createElement('img');
            el.className = 'coach-msg-thumb';
            el.alt = '';
            el.src = src;
            thumbs.appendChild(el);
          } else {
            var ph = document.createElement('span');
            ph.className = 'coach-msg-thumb coach-msg-thumb--placeholder';
            ph.textContent = 'Photo';
            thumbs.appendChild(ph);
          }
        });
        if (thumbs.childNodes.length) bubble.appendChild(thumbs);
      }
      var textNode = document.createElement('div');
      textNode.className = 'coach-msg-text';
      textNode.textContent = msg.content || '';
      bubble.appendChild(textNode);
      return this.createChatRow('user', bubble);
    }

    var bodyText = msg.content || msg.text || '';
    if (
      msg.responseType === 'workout' &&
      msg.workout &&
      (!bodyText || bodyText.length < 40) &&
      typeof this.formatWorkoutPlain === 'function'
    ) {
      bodyText = this.formatWorkoutPlain(msg.workout) || bodyText;
    }
    var textNode = document.createElement('div');
    textNode.className = 'coach-msg-text coach-msg-text--plain';
    textNode.textContent = bodyText;
    bubble.appendChild(textNode);

    if (msg.responseType === 'routine' && msg.routineParsed && window.WorkoutSplit) {
      var routineActions = document.createElement('div');
      routineActions.className = 'coach-msg-actions';
      var saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'coach-primary-btn coach-routine-save';
      saveBtn.textContent = 'Save to split';
      saveBtn.addEventListener('click', function () {
        window.WorkoutSplit.saveRoutine(msg.routineParsed, { asNew: true, source: 'ai' });
        saveBtn.textContent = 'Saved to splits ✓';
        saveBtn.disabled = true;
        try {
          window.dispatchEvent(new CustomEvent('strongman:splits-updated'));
        } catch (eSave) {}
      });
      routineActions.appendChild(saveBtn);
      var logLink = document.createElement('a');
      logLink.href = '/log#split';
      logLink.className = 'coach-routine-edit';
      logLink.textContent = 'Edit in Log → Workout split';
      routineActions.appendChild(logLink);
      bubble.appendChild(routineActions);
      return this.createChatRow('assistant', bubble);
    }

    if (msg.responseType === 'workout' && msg.workout) {
      var actions = document.createElement('div');
      actions.className = 'coach-msg-actions';
      var applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'coach-primary-btn';
      applyBtn.textContent = 'Apply to log';
      applyBtn.addEventListener('click', function () {
        if (typeof window.coachApplyWorkout === 'function') {
          window.coachApplyWorkout(bodyText, msg.workout);
        }
      });
      actions.appendChild(applyBtn);
      var archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.className = 'coach-secondary-btn';
      archiveBtn.textContent = 'Save plan';
      archiveBtn.addEventListener('click', function () {
        var WA = window.WorkoutArchive;
        if (WA && typeof WA.add === 'function') {
          WA.add({
            name: (msg.workout && msg.workout.title) || 'Coach plan',
            bodyText: bodyText,
            source: 'ai',
          });
        }
        if (
          window.WorkoutSplit &&
          typeof window.WorkoutSplit.importAiWorkout === 'function' &&
          msg.workout
        ) {
          window.WorkoutSplit.importAiWorkout(msg.workout, { activate: false });
          try {
            window.dispatchEvent(new CustomEvent('strongman:splits-updated'));
          } catch (eImp) {}
        }
        archiveBtn.textContent = 'Saved ✓';
        archiveBtn.disabled = true;
      });
      actions.appendChild(archiveBtn);
      bubble.appendChild(actions);
      return this.createChatRow('assistant', bubble);
    }

    return this.createChatRow('assistant', bubble);
  };

  CoachThread.prototype.showLoading = function () {
    this.hideLoading();
    var mount = this.getMountEl();
    if (!mount) return;
    if (mount !== this.threadEl) {
      mount.hidden = false;
      mount.innerHTML = '';
    }
    var bubble = document.createElement('div');
    bubble.className = 'coach-msg coach-msg--assistant coach-msg--loading';
    bubble.setAttribute('aria-busy', 'true');
    bubble.innerHTML =
      '<div class="coach-gen" aria-label="Rocky is generating">' +
      '<div class="coach-gen-core" aria-hidden="true">' +
      '<span class="coach-gen-ring coach-gen-ring--a"></span>' +
      '<span class="coach-gen-ring coach-gen-ring--b"></span>' +
      '<span class="coach-gen-ring coach-gen-ring--c"></span>' +
      '<span class="coach-gen-scan"></span>' +
      '<span class="coach-gen-node"></span>' +
      '</div>' +
      '<p class="coach-gen-label">Syncing corner intel<span class="coach-gen-ellipsis"></span></p>' +
      '</div>';
    this.loadingEl = this.createChatRow('assistant', bubble);
    mount.appendChild(this.loadingEl);
    this.scrollThread(true);
  };

  CoachThread.prototype.hideLoading = function () {
    if (this.loadingEl && this.loadingEl.parentNode) {
      this.loadingEl.parentNode.removeChild(this.loadingEl);
    }
    this.loadingEl = null;
  };

  CoachThread.prototype.hideStreamingBubble = function () {
    if (this.streamingEl && this.streamingEl.parentNode) {
      this.streamingEl.parentNode.removeChild(this.streamingEl);
    }
    this.streamingEl = null;
    this.streamingTextEl = null;
    this.streamedText = '';
  };

  CoachThread.prototype.showStreamingBubble = function () {
    var mount = this.getMountEl();
    if (this.streamingEl || !mount) return;
    this.hideLoading();
    if (mount !== this.threadEl) {
      mount.hidden = false;
    }
    var bubble = document.createElement('div');
    bubble.className = 'coach-msg coach-msg--assistant coach-msg--streaming';
    bubble.setAttribute('aria-busy', 'true');
    var textNode = document.createElement('div');
    textNode.className = 'coach-msg-text coach-msg-text--streaming';
    bubble.appendChild(textNode);
    this.streamingEl = this.createChatRow('assistant', bubble);
    this.streamingTextEl = textNode;
    this.streamedText = '';
    mount.appendChild(this.streamingEl);
    this.scrollThread(true);
  };

  CoachThread.prototype.appendStreamingDelta = function (text) {
    if (!text) return;
    if (!this.streamingEl) this.showStreamingBubble();
    this.streamedText += text;
    if (this.streamingTextEl) {
      this.streamingTextEl.textContent = this.extractStreamingPreview(this.streamedText);
    }
    this.scrollThread(true);
  };

  CoachThread.prototype.extractStreamingPreview = function (raw) {
    var t = String(raw || '');
    function unescapeJsonFragment(frag) {
      try {
        return JSON.parse('"' + frag + '"');
      } catch (e) {
        return frag.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }
    var textMatch = /"text"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(t);
    if (textMatch) return unescapeJsonFragment(textMatch[1]);
    var summaryMatch = /"summary"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(t);
    if (summaryMatch) return unescapeJsonFragment(summaryMatch[1]);
    var fyiMatch = /"fyi"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(t);
    if (fyiMatch) return unescapeJsonFragment(fyiMatch[1]);
    // Partial in-progress string value for typing feel before the closing quote arrives.
    var partial = /"(?:text|summary|fyi)"\s*:\s*"((?:\\.|[^"\\])*)$/.exec(t);
    if (partial) return unescapeJsonFragment(partial[1]);
    if (/^\s*\{/.test(t)) {
      return 'Rocky is typing…';
    }
    return t;
  };

  CoachThread.prototype.coachStreamHandlers = function () {
    var self = this;
    return {
      onDelta: function (text) {
        self.appendStreamingDelta(text);
      },
    };
  };

  CoachThread.prototype.stopTypewriter = function () {
    if (this.typewriterTimer) {
      window.clearTimeout(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  };

  CoachThread.prototype.typewriterUnveil = function (assistantMsg, onDone) {
    // Streaming already provides the typing feel — skip post-response typewriter delay.
    this.stopTypewriter();
    this.hideLoading();
    if (onDone) onDone();
  };

  CoachThread.prototype.finishAssistantReply = function (assistantMsg, quota, opts) {
    opts = opts || {};
    var self = this;
    var streamed = !!opts.streamed || !!this.streamedText;
    this.hideLoading();
    var last = this.messages.length ? this.messages[this.messages.length - 1] : null;
    if (!last || last.role !== 'assistant') {
      this.messages.push(assistantMsg);
    } else {
      this.messages[this.messages.length - 1] = assistantMsg;
    }
    if (quota) this.setQuota(quota);
    this.saveToStorage();
    if (window.CoachPending) window.CoachPending.clearReplyReady();

    // Keep the same bubble the user watched stream — swap in final plain text + actions.
    if (streamed && this.streamingEl && this.streamingTextEl) {
      var finalText = assistantMsg.content || assistantMsg.text || '';
      this.streamingTextEl.textContent = finalText;
      this.streamingTextEl.className = 'coach-msg-text coach-msg-text--plain';
      var bubble = this.streamingEl.querySelector('.coach-msg');
      if (bubble) {
        bubble.classList.remove('coach-msg--streaming');
        bubble.removeAttribute('aria-busy');
        // Drop any prior action row, then re-render actions via a fresh message node.
        var oldActions = bubble.querySelector('.coach-msg-actions');
        if (oldActions) oldActions.parentNode.removeChild(oldActions);
      }
      this.streamingEl = null;
      this.streamingTextEl = null;
      this.streamedText = '';
      // Rebuild from messages so workout Apply/Save actions attach consistently.
      this.render();
      this.refreshBriefing();
      return;
    }

    this.hideStreamingBubble();

    if (streamed) {
      this.render();
      this.refreshBriefing();
      return;
    }

    this.typewriterUnveil(assistantMsg, function () {
      self.render();
      self.refreshBriefing();
    });
  };

  CoachThread.prototype.resumePendingReply = function () {
    var self = this;
    if (!window.CoachPending || !window.CoachPending.hasPendingReply()) return;
    if (self.pending) return;

    self.setCoachView('chat');
    self.setError('');
    self.setPendingUi(true);
    self.showLoading();

    window.CoachPending.resume(
      Object.assign(this.coachStreamHandlers(), {
      onSuccess: function (assistantMsg, quota, _messages, meta) {
        self.finishAssistantReply(assistantMsg, quota, meta || {});
      },
      onError: function (msg, retriable) {
        self.hideLoading();
        self.hideStreamingBubble();
        if (msg && !retriable) self.setError(msg);
        else if (msg) self.setError(msg);
      },
      onAbort: function () {
        self.hideLoading();
        self.hideStreamingBubble();
      },
      onEnd: function () {
        self.setPendingUi(false);
      },
    }));
  };

  CoachThread.prototype.setCoachMode = function (mode) {
    if (mode === 'routine') this.coachMode = 'routine';
    else if (mode === 'physique') this.coachMode = 'physique';
    else if (mode === 'projection') this.coachMode = 'projection';
    else this.coachMode = 'chat';

    var currentMode = this.coachMode;
    if (this.routineToggle) this.routineToggle.checked = currentMode === 'routine';
    if (this.physiqueToggle) this.physiqueToggle.checked = currentMode === 'physique';
    if (this.projectionToggle) this.projectionToggle.checked = currentMode === 'projection';
    if (this.modelMenu) {
      this.modelMenu.querySelectorAll('[data-coach-mode]').forEach(function (opt) {
        var on = opt.getAttribute('data-coach-mode') === currentMode;
        opt.classList.toggle('is-active', on);
        opt.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    var modeLabel = document.getElementById('coach-mode-label');
    if (modeLabel) {
      modeLabel.textContent =
        currentMode === 'routine'
          ? 'Full routine'
          : currentMode === 'physique'
            ? 'Rate physique'
            : currentMode === 'projection'
              ? 'Projection'
              : 'Chat';
    }
    if (this.chipsEl) {
      this.chipsEl.hidden =
        currentMode === 'routine' || currentMode === 'physique' || currentMode === 'projection';
    }
    if (this.inputEl) {
      if (this.coachMode === 'routine') {
        this.inputEl.placeholder = 'Optional notes for your weekly split (equipment, goals)…';
      } else if (this.coachMode === 'physique') {
        this.inputEl.placeholder = 'Attach a photo, then add notes if you want…';
      } else if (this.coachMode === 'projection') {
        this.inputEl.placeholder = 'e.g. lose 45 lb, or bench 225…';
      } else {
        this.inputEl.placeholder = 'Talk to Rocky…';
      }
    }
    if (this.sendBtn) {
      var label = 'Send message';
      if (this.coachMode === 'routine') label = 'Generate full weekly routine';
      if (this.coachMode === 'physique') label = 'Rate physique';
      if (this.coachMode === 'projection') label = 'Project my goal';
      this.sendBtn.setAttribute('aria-label', label);
    }
    if (this.composerEl) {
      this.composerEl.dataset.coachMode = this.coachMode;
    }
    if (this.capabilityGrid) {
      this.capabilityGrid.querySelectorAll('[data-coach-capability]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-coach-capability') === currentMode);
      });
    }
    this.setError('');
  };

  CoachThread.prototype.parseProjectionGoal = function (text) {
    var raw = String(text || '').trim();
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var bw = user && user.weight != null ? Number(user.weight) : null;

    var lose = /(?:lose|drop|cut|down)\s*(-?\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds)?/i.exec(raw);
    var gainBw =
      /(?:gain|add)\s*(-?\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds)?\s*(?:of\s*)?(?:body\s*)?weight/i.exec(
        raw
      );
    var signed = /([+-]\d+(?:\.\d+)?)\s*(?:lb|lbs)?\s*(?:body\s*)?weight/i.exec(raw);
    if (lose || gainBw || signed) {
      var delta = lose
        ? -Math.abs(parseFloat(lose[1]))
        : gainBw
          ? Math.abs(parseFloat(gainBw[1]))
          : parseFloat(signed[1]);
      var start = bw && bw > 0 ? bw : 180;
      return {
        type: 'bodyweight',
        start: start,
        target: start + delta,
        label: (delta < 0 ? delta : '+' + delta) + ' lb bodyweight',
      };
    }

    var liftMatch =
      /(?:bench|squat|deadlift|ohp|press|row|curl)[a-z\s]*?(?:to\s+)?(\d{2,3}(?:\.\d+)?)\s*(?:lb|lbs)?/i.exec(
        raw
      ) || /(\d{2,3}(?:\.\d+)?)\s*(?:lb|lbs)?\s*(bench|squat|deadlift)/i.exec(raw);
    if (liftMatch) {
      var target = parseFloat(liftMatch[1]);
      var liftName = /bench/i.test(raw)
        ? 'Bench Press'
        : /squat/i.test(raw)
          ? 'Squat'
          : /deadlift/i.test(raw)
            ? 'Deadlift'
            : /ohp|overhead|press/i.test(raw)
              ? 'Overhead Press'
              : 'Lift';
      var start = Math.max(45, Math.round(target * 0.8));
      if (window.PRLog && typeof window.PRLog.getRecords === 'function') {
        var best = start;
        var needle = liftName.toLowerCase().split(' ')[0];
        window.PRLog.getRecords().forEach(function (r) {
          if (!r || r.discipline !== 'weightlifting') return;
          if (String(r.eventLabel || '').toLowerCase().indexOf(needle) === -1) return;
          if (r.weight != null && r.weight > best) best = Number(r.weight);
        });
        start = best;
      }
      return {
        type: 'lift',
        lift: liftName,
        start: start,
        target: target,
        label: liftName + ' → ' + target + ' lb',
      };
    }

    return null;
  };

  CoachThread.prototype.runFutureProjectionFromUi = function () {
    this.syncProjectionBwDelta();
    var kindRadio = document.querySelector('input[name="coach-proj-kind"]:checked');
    var kind =
      (kindRadio && kindRadio.value) ||
      this.projKind ||
      'lift';
    this.projKind = kind;
    var goal = null;
    if (kind === 'bodyweight') {
      var delta = parseFloat((document.getElementById('coach-proj-bw-delta') || {}).value);
      var now = parseFloat((document.getElementById('coach-proj-bw-now') || {}).value);
      if (isNaN(delta) || delta === 0 || isNaN(now) || now <= 0) {
        this.setError('Enter a bodyweight change and your current weight.');
        return;
      }
      goal = {
        type: 'bodyweight',
        start: now,
        target: now + delta,
        label: (delta < 0 ? delta : '+' + delta) + ' lb bodyweight',
      };
    } else {
      var lift = ((document.getElementById('coach-proj-lift-name') || {}).value || 'Bench Press').trim();
      var target = parseFloat((document.getElementById('coach-proj-lift-target') || {}).value);
      var start = parseFloat((document.getElementById('coach-proj-lift-now') || {}).value);
      if (!lift || isNaN(target) || target <= 0 || isNaN(start) || start < 0) {
        this.setError('Enter lift name, current best, and target.');
        return;
      }
      goal = {
        type: 'lift',
        lift: lift,
        start: start,
        target: target,
        label: lift + ' → ' + target + ' lb',
      };
    }
    this.applyProjectionGoal(goal);
  };

  CoachThread.prototype.applyProjectionGoal = function (goal) {
    if (!goal) {
      this.setError('Pick a goal first.');
      return;
    }
    if (!window.ProgressionEngine || typeof window.ProgressionEngine.projectGoal !== 'function') {
      this.setError('Projection engine is unavailable.');
      return;
    }
    var result = window.ProgressionEngine.projectGoal(goal);
    var reply =
      'Future projection — ' +
      (goal.label || 'goal') +
      '\n\n' +
      result.message +
      '\n\nAssumptions: consistent training, recovery in the ballpark, and no major interruptions. Push harder and you can beat it; miss weeks and it stretches.';

    this.messages.push({ role: 'user', content: 'Project: ' + (goal.label || 'goal') });
    this.messages.push({
      role: 'assistant',
      content: reply,
      projection: {
        weeks: result.weeks,
        months: result.months,
        label: goal.label,
        weeklyRate: result.weeklyRate,
      },
    });
    this.saveToStorage();
    this.setError('');
    this.renderModeOutput();
  };

  CoachThread.prototype.runFutureProjection = function () {
    this.runFutureProjectionFromUi();
  };

  CoachThread.prototype.runPhysiqueRate = function () {
    var self = this;
    if (this.pending) return;
    var images = this.attachmentsForApi();
    if (!images.length) {
      this.setError('Add at least one physique photo first.');
      return;
    }
    if (!window.CoachPending) {
      this.setError('Could not reach the API.');
      return;
    }

    this.coachMode = 'physique';
    this.setError('');
    this.setPendingUi(true);

    var displayText = 'Rate my physique';
    var apiMessage =
      'Rate my physique from the attached photo(s). Be honest, constructive, and specific about muscle development, proportions, posture, and training priorities. Keep it encouraging with Rocky energy.';

    var threadForApi = this.messages
      .filter(function (m) {
        return m.role === 'user' || m.role === 'assistant';
      })
      .map(function (m) {
        return { role: m.role, content: m.content || m.text || '' };
      });

    var userMsg = {
      role: 'user',
      content: displayText,
      images: this.attachmentsForThread(),
    };
    this.messages.push(userMsg);
    var imagesPayload = images.slice();
    this.clearAttachments();
    this.saveToStorage();
    this.showLoading();

    window.CoachPending.startRequest(
      {
        message: apiMessage,
        userContent: displayText,
        contextBlock: this.getContextBlock(),
        thread: threadForApi.slice(-12),
        images: imagesPayload,
        forceIntent: 'advice',
      },
      Object.assign(this.coachStreamHandlers(), {
        onSuccess: function (assistantMsg, quota, _messages, meta) {
          self.finishAssistantReply(assistantMsg, quota, meta || {});
        },
        onError: function (msg, retriable) {
          self.hideLoading();
          self.hideStreamingBubble();
          self.stopTypewriter();
          if (msg) self.setError(msg);
          if (!retriable && window.CoachPending) window.CoachPending.clearPending();
        },
        onAbort: function () {
          self.hideLoading();
          self.hideStreamingBubble();
          self.stopTypewriter();
        },
        onEnd: function () {
          self.setPendingUi(false);
        },
      })
    );
  };

  CoachThread.prototype.readRoutineForm = function () {
    function checked(name, fallback) {
      var el = document.querySelector('input[name="' + name + '"]:checked');
      return el && el.value ? el.value : fallback;
    }
    var notesEl = document.getElementById('coach-routine-notes');
    var goal = checked('coach-routine-goal', 'strength');
    var goalLabel =
      goal === 'sport_performance'
        ? 'sport performance'
        : goal === 'aesthetics'
          ? 'physique / hypertrophy'
          : goal === 'general_health'
            ? 'general health'
            : 'max strength';
    var split = checked('coach-routine-split', 'auto');
    var splitLabel =
      split === 'upper_lower'
        ? 'upper/lower'
        : split === 'ppl'
          ? 'push/pull/legs'
          : split === 'full_body'
            ? 'full body'
            : 'auto (choose the best split for this athlete)';
    return {
      days: checked('coach-routine-days', '4'),
      goal: goal,
      goalLabel: goalLabel,
      minutes: checked('coach-routine-minutes', '60'),
      split: split,
      splitLabel: splitLabel,
      notes: notesEl && notesEl.value ? notesEl.value.trim() : '',
    };
  };

  CoachThread.prototype.generateFullRoutine = function () {
    var self = this;
    if (this.pending) return;
    if (!window.CoachPending) {
      this.setError('Could not reach the API.');
      return;
    }

    this.coachMode = 'routine';
    this.setPendingUi(true);

    var form = this.readRoutineForm();
    var text =
      'Generate my full weekly training split (Monday through Sunday).' +
      '\nPreferences from the form:' +
      '\n- Lift days per week: ' +
      form.days +
      '\n- Primary focus: ' +
      form.goalLabel +
      '\n- Typical session length: ~' +
      form.minutes +
      ' minutes' +
      '\n- Split style: ' +
      form.splitLabel +
      (form.notes ? '\n- Athlete notes: ' + form.notes : '') +
      '\n\nFactor in my practice days, game days, and season — avoid stacking heavy leg work before games.' +
      '\n\nReply in this EXACT format:\n' +
      'Program: [program name]\n' +
      'Monday: [day focus]\n' +
      '- Exercise · sets×reps @ weight\n' +
      'Tuesday: ...\n' +
      '(through Sunday; use REST for rest days with no exercises)';

    this.setError('');

    var threadForApi = this.messages
      .filter(function (m) {
        return m.role === 'user' || m.role === 'assistant';
      })
      .map(function (m) {
        return { role: m.role, content: m.content || m.text || '' };
      });

    this.showLoading();

    window.CoachPending.startRequest(
      {
        message: text,
        contextBlock: this.getContextBlock(),
        thread: threadForApi.slice(-12),
      },
      Object.assign(this.coachStreamHandlers(), {
        onSuccess: function (assistantMsg, quota, _messages, meta) {
          self.hideLoading();
          var content = assistantMsg.content || assistantMsg.text || '';
          var parsed = window.RoutineImport ? window.RoutineImport.parseWeeklyRoutine(content) : null;
          if (parsed) {
            assistantMsg.responseType = 'routine';
            assistantMsg.routineParsed = parsed;
          }
          self.finishAssistantReply(assistantMsg, quota, meta || {});
        },
        onError: function (msg) {
          self.hideLoading();
          self.hideStreamingBubble();
          if (msg) self.setError(msg);
        },
        onEnd: function () {
          self.setPendingUi(false);
        },
      })
    );
  };

  CoachThread.prototype.attachmentsForApi = function () {
    return this.pendingAttachments.map(function (a) {
      return { mediaType: a.mediaType, data: a.data };
    });
  };

  CoachThread.prototype.attachmentsForThread = function () {
    return this.pendingAttachments.map(function (a) {
      return {
        mediaType: a.mediaType,
        data: a.data,
        previewUrl: a.previewUrl || null,
      };
    });
  };

  CoachThread.prototype.setPendingUi = function (on) {
    this.pending = !!on;
    if (this.sendBtn) this.sendBtn.disabled = !!on;
    if (this.attachBtn) this.attachBtn.disabled = !!on;
    if (this.micBtn) this.micBtn.disabled = !!on;
    ['coach-physique-go', 'coach-routine-go', 'coach-projection-go', 'coach-modes-back', 'coach-mode-back', 'coach-chat-back'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el) el.disabled = !!on;
      }
    );
    this.syncLayoutState();
  };

  CoachThread.prototype.send = function () {
    var self = this;
    if (this.pending) return;
    if (this.coachView !== 'chat') {
      this.setCoachView('chat');
    }

    var text = this.inputEl && this.inputEl.value ? this.inputEl.value.trim() : '';
    var images = this.attachmentsForApi();
    var isPhysique = false;

    if (isPhysique && !images.length) {
      this.setError('Attach at least one physique photo for Rocky to review.');
      return;
    }
    if (!text && !images.length) {
      this.setError('Say something to Rocky, or attach an image.');
      return;
    }
    if (!window.CoachPending) {
      this.setError('Could not reach the API.');
      return;
    }

    var displayText = text;
    var apiMessage = text;
    if (isPhysique) {
      displayText = text || 'Rate my physique';
      apiMessage =
        'Rate my physique from the attached photo(s). Be honest, constructive, and specific about muscle development, proportions, posture, and training priorities. Keep it encouraging with Rocky energy.' +
        (text ? '\n\nAthlete notes: ' + text : '');
    } else if (!apiMessage && images.length) {
      displayText = 'Check this out';
      apiMessage =
        'Review the attached image(s) in a coaching context. Give practical feedback.';
    }

    this.setError('');
    this.setPendingUi(true);

    var threadForApi = this.messages
      .filter(function (m) {
        return m.role === 'user' || m.role === 'assistant';
      })
      .map(function (m) {
        return { role: m.role, content: m.content || m.text || '' };
      });

    var userMsg = {
      role: 'user',
      content: displayText,
      images: this.attachmentsForThread(),
    };
    this.messages.push(userMsg);
    if (window.CoachMemory) window.CoachMemory.ingestUserMessage(displayText);
    if (this.inputEl) {
      this.inputEl.value = '';
      this.autosizeInput();
    }
    var imagesPayload = images.slice();
    this.clearAttachments();
    this.syncLayoutState();
    this.render();
    this.refreshBriefing();
    this.saveToStorage();
    this.showLoading();

    var threadRecent = threadForApi.slice(-12);

    window.CoachPending.startRequest(
      {
        message: apiMessage,
        userContent: displayText,
        contextBlock: this.getContextBlock(),
        thread: threadRecent,
        images: imagesPayload,
        forceIntent: isPhysique || imagesPayload.length ? 'advice' : undefined,
      },
      Object.assign(this.coachStreamHandlers(), {
        onSuccess: function (assistantMsg, quota, _messages, meta) {
          self.finishAssistantReply(assistantMsg, quota, meta || {});
        },
        onError: function (msg, retriable) {
          self.hideLoading();
          self.hideStreamingBubble();
          self.stopTypewriter();
          if (msg) self.setError(msg);
          if (!retriable && window.CoachPending) window.CoachPending.clearPending();
        },
        onAbort: function () {
          self.hideLoading();
          self.hideStreamingBubble();
          self.stopTypewriter();
        },
        onEnd: function () {
          self.setPendingUi(false);
        },
      })
    );
  };

  window.CoachThread = CoachThread;
  window.COACH_NAME = COACH_NAME;
})();
