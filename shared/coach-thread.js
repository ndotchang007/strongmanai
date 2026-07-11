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
    this.coachMode = 'chat';
    this.clearBtns = opts.clearBtns || (opts.clearBtn ? [opts.clearBtn] : []);
    this.quotaEl = opts.quotaEl;
    this.errorEl = opts.errorEl;
    this.chipsEl = opts.chipsEl;
    this.briefingEl = opts.briefingEl;
    this.briefingMobileEl = opts.briefingMobileEl;
    this.messages = [];
    this.pending = false;
    this.loadingEl = null;
    this.loadFromStorage();
    this.syncMemoryFromThread();
    this.bindEvents();
    this.refreshBriefing();
    this.buildChips();
    this.render();
    this.fetchQuota();
    this.resumePendingReply();
    if (window.CoachPending) window.CoachPending.clearReplyReady();
    if (this.routineToggle) {
      this.setCoachMode(this.routineToggle.checked ? 'routine' : 'chat');
    }
  }

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
      if (window.CoachPending && typeof window.CoachPending.saveThread === 'function') {
        window.CoachPending.saveThread(this.messages);
      } else {
        localStorage.setItem(getStorageKey(), JSON.stringify(this.messages.slice(-40)));
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
    window.CoachMemory.clear();
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
      parts.push(window.AthleteContext.buildCoachPromptBlock(user, extras));
    }
    if (window.CoachMemory) {
      var memBlock = window.CoachMemory.buildPromptBlock(window.CoachMemory.load());
      if (memBlock) parts.push(memBlock);
    }
    return parts.filter(Boolean).join('\n\n');
  };

  CoachThread.prototype.buildChips = function () {
    if (!this.chipsEl) return;
    var AC = window.AthleteContext;
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var hint = AC && user ? AC.getTodayTrainingHint(user) : null;
    var ctx = AC && user ? AC.loadAthleteContext(user) : null;
    var maxMin = hint ? hint.maxMinutes : 45;
    var sports = AC && ctx && AC.getSports ? AC.getSports(ctx) : [];
    var sport =
      sports.length > 0
        ? sports
            .map(function (s) {
              return s.sport;
            })
            .filter(Boolean)
            .join(' + ')
        : ctx && ctx.sport
          ? ctx.sport
          : 'my sport';
    var sportFocused = AC && ctx && AC.isSportFocusedGoal ? AC.isSportFocusedGoal(ctx) : sports.length > 0;
    var comp = AC && ctx ? AC.competitionLabel(ctx) : 'Game';
    var isBeginner = user && (!user.experience || user.experience === 'beginner');

    var prompts;
    if (isBeginner) {
      prompts = [
        { label: 'Feeling sick', text: "I'm sick today — what should I do about training?" },
        { label: 'Really sore', text: "I'm really sore from yesterday. Should I train today and how hard?" },
        {
          label: 'Beginner full body',
          text:
            "I'm new to the gym — build a " +
            maxMin +
            '-minute full-body session with machines and cables only (chest press, lat pulldown, leg press, etc.) and include form cues',
        },
        {
          label: 'Form tips',
          text:
            'Give me beginner form cues for lat pulldown and chest press — grip, posture, and common mistakes',
        },
        {
          label: 'Build habit',
          text:
            'I need a simple consistent routine I can stick to — about ' +
            maxMin +
            ' minutes today, beginner-friendly machines',
        },
        {
          label: 'Low impact',
          text:
            'Low-impact training day — joints feel tired, keep it around ' +
            Math.min(40, maxMin) +
            ' minutes with easy machines',
        },
      ];
    } else if (!sportFocused) {
      prompts = [
        { label: 'Feeling sick', text: "I'm sick today — what should I do about training?" },
        { label: 'Really sore', text: "I'm really sore from yesterday. Should I train today and how hard?" },
        {
          label: '30-min workout',
          text:
            'Put together a ' +
            maxMin +
            '-minute full-body session for general fitness — nothing crazy, just move well',
        },
        {
          label: 'Build habit',
          text:
            'I need a simple consistent routine I can stick to — about ' +
            maxMin +
            ' minutes today',
        },
        {
          label: 'Low impact',
          text:
            'Low-impact training day — joints feel tired, keep it around ' +
            Math.min(40, maxMin) +
            ' minutes',
        },
        {
          label: 'Recovery / mobility',
          text:
            'Recovery and mobility focus today (~' +
            Math.min(35, maxMin) +
            ' min) — help me stay active without overdoing it',
        },
      ];
    } else {
      prompts = [
        { label: 'Feeling sick', text: "I'm sick today — what should I do about training?" },
        { label: 'Really sore', text: "I'm really sore from yesterday. Should I train today and how hard?" },
        {
          label: hint && hint.kind === 'game' ? comp + ' day' : comp + ' tomorrow',
          text:
            hint && hint.kind === 'game'
              ? 'Light recovery session for ' + comp.toLowerCase() + ' day (~' + Math.min(30, maxMin) + ' min)'
              : comp + ' tomorrow — program a short complementary lift (~' + maxMin + ' min), nothing that will hurt performance',
        },
        {
          label: 'Practice day',
          text:
            'Practice day — ' +
            maxMin +
            ' min gym session for ' +
            sport +
            ' that complements practice, not duplicates it',
        },
        {
          label: 'Build session',
          text:
            'Put together a ' +
            maxMin +
            '-minute session for ' +
            sport +
            ' — hit my main goal',
        },
        {
          label: 'Off-season',
          text:
            'Off-season hypertrophy session (~' +
            (ctx && ctx.weekendMaxMinutes ? ctx.weekendMaxMinutes : 90) +
            ' min) for ' +
            sport,
        },
      ];
    }

    this.chipsEl.innerHTML = '';
    var self = this;
    prompts.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'coach-chip';
      b.textContent = p.label;
      b.addEventListener('click', function () {
        if (self.inputEl) {
          self.inputEl.value = p.text;
          self.inputEl.focus();
        }
      });
      self.chipsEl.appendChild(b);
    });
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
        self.setCoachMode(self.routineToggle.checked ? 'routine' : 'chat');
      });
    }
    this.clearBtns.forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (self.pending) return;
        self.messages = [];
        if (window.CoachMemory) window.CoachMemory.clear();
        if (window.CoachPending) window.CoachPending.clearPending();
        self.saveToStorage();
        self.render();
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
        self.inputEl.style.height = 'auto';
        self.inputEl.style.height = Math.min(self.inputEl.scrollHeight, 104) + 'px';
      });
    }

    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('strongman-coach-thread') !== 0) return;
      self.loadFromStorage();
      self.syncMemoryFromThread();
      self.render();
    });

    window.addEventListener('pageshow', function () {
      self.loadFromStorage();
      self.render();
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

  CoachThread.prototype.setQuota = function (q) {
    if (!this.quotaEl) return;
    if (!q || typeof q.used !== 'number') {
      this.quotaEl.textContent = '';
      return;
    }
    var IT = window.InfoTip;
    var tip = IT ? IT.iconHtml('coach_quota') : '';
    this.quotaEl.innerHTML =
      'Messages today: ' + q.used + ' / ' + q.limit + ' · ' + q.remaining + ' left' + tip;
  };

  CoachThread.prototype.fetchQuota = function () {
    var self = this;
    if (typeof apiGet !== 'function') return;
    apiGet('/coach/quota')
      .then(function (res) {
        return res.json();
      })
      .then(function (body) {
        if (body && body.quota) self.setQuota(body.quota);
      })
      .catch(function () {});
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
    this.threadEl.innerHTML = '';
    var self = this;
    if (!this.messages.length) {
      this.threadEl.appendChild(this.renderWelcome());
      this.scrollThread(false);
      return;
    }
    this.messages.forEach(function (msg) {
      self.threadEl.appendChild(self.renderMessage(msg));
    });
    this.scrollThread(true);
  };

  CoachThread.prototype.renderMessage = function (msg) {
    var bubble = document.createElement('div');
    bubble.className =
      'coach-msg coach-msg--' + (msg.role === 'user' ? 'user' : 'assistant');

    if (msg.role === 'user') {
      bubble.textContent = msg.content;
      return this.createChatRow('user', bubble);
    }

    if (msg.responseType === 'advice' && window.CoachAdviceCard) {
      bubble.classList.add('coach-msg--rich');
      if (msg.advice) {
        bubble.appendChild(window.CoachAdviceCard.renderAdviceCard(msg.advice));
      } else {
        bubble.appendChild(
          window.CoachAdviceCard.renderPlainMessage(msg.content || msg.text || '')
        );
      }
      return this.createChatRow('assistant', bubble);
    }

    if (msg.responseType === 'routine' && msg.routineParsed && window.WorkoutSplit) {
      bubble.classList.add('coach-msg--rich');
      var card = document.createElement('div');
      card.className = 'coach-routine-card';
      var title = document.createElement('p');
      title.className = 'coach-routine-card-title';
      title.textContent = (msg.routineParsed.programName || 'Weekly routine') + ' ready';
      card.appendChild(title);
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
      card.appendChild(saveBtn);
      var logLink = document.createElement('a');
      logLink.href = '/create#split';
      logLink.className = 'coach-routine-edit';
      logLink.textContent = 'Edit in Log → Workout split';
      card.appendChild(logLink);
      bubble.appendChild(card);
      return this.createChatRow('assistant', bubble);
    }

    if (msg.responseType === 'workout' && msg.workout && window.WorkoutPlanPreview) {
      bubble.classList.add('coach-msg--rich');
      var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var ctx = window.AthleteContext && user ? window.AthleteContext.loadAthleteContext(user) : null;
      var sp = window.AthleteContext && ctx ? window.AthleteContext.getSportRecord(ctx) : null;
      var meta =
        ctx && window.AthleteContext
          ? window.AthleteContext.GOAL_LABELS[ctx.primaryGoal]
          : '';
      bubble.appendChild(
        window.WorkoutPlanPreview.renderWorkoutPreview(msg.workout, {
          metaLine: meta,
          rockyFyi: msg.workout.fyi || msg.text || msg.content || '',
          athleteContext: ctx,
          sportRecord: sp,
          showActions: true,
          onApply: function (plain) {
            if (typeof window.coachApplyWorkout === 'function') {
              window.coachApplyWorkout(plain);
            }
          },
          onSave: function (plain, workout) {
            var WA = window.WorkoutArchive;
            if (WA && typeof WA.add === 'function') {
              WA.add({
                name: (workout && workout.title) || 'Coach plan',
                bodyText: plain,
                source: 'ai',
              });
            }
            if (window.WorkoutSplit && typeof window.WorkoutSplit.importAiWorkout === 'function' && workout) {
              window.WorkoutSplit.importAiWorkout(workout, { activate: false });
              try {
                window.dispatchEvent(new CustomEvent('strongman:splits-updated'));
              } catch (eImp) {}
            }
          },
        })
      );
      return this.createChatRow('assistant', bubble);
    }

    bubble.textContent = msg.content || msg.text || '';
    return this.createChatRow('assistant', bubble);
  };

  CoachThread.prototype.showLoading = function () {
    var bubble = document.createElement('div');
    bubble.className = 'coach-msg coach-msg--assistant coach-msg--loading';
    bubble.setAttribute('aria-busy', 'true');
    bubble.innerHTML =
      '<span class="coach-typing" aria-label="Rocky is typing">' +
      '<span class="coach-typing-dot"></span>' +
      '<span class="coach-typing-dot"></span>' +
      '<span class="coach-typing-dot"></span>' +
      '</span>';
    this.loadingEl = this.createChatRow('assistant', bubble);
    if (this.threadEl) {
      this.threadEl.appendChild(this.loadingEl);
      this.scrollThread(true);
    }
  };

  CoachThread.prototype.hideLoading = function () {
    if (this.loadingEl && this.loadingEl.parentNode) {
      this.loadingEl.parentNode.removeChild(this.loadingEl);
    }
    this.loadingEl = null;
  };

  CoachThread.prototype.finishAssistantReply = function (assistantMsg, quota) {
    this.hideLoading();
    this.messages = window.CoachPending
      ? window.CoachPending.loadThread()
      : this.messages.concat([assistantMsg]);
    if (quota) this.setQuota(quota);
    this.render();
    this.refreshBriefing();
    this.saveToStorage();
    if (window.CoachPending) window.CoachPending.clearReplyReady();
  };

  CoachThread.prototype.resumePendingReply = function () {
    var self = this;
    if (!window.CoachPending || !window.CoachPending.hasPendingReply()) return;
    if (self.pending) return;

    self.setError('');
    self.pending = true;
    if (self.sendBtn) self.sendBtn.disabled = true;
    self.showLoading();

    window.CoachPending.resume({
      onSuccess: function (assistantMsg, quota) {
        self.finishAssistantReply(assistantMsg, quota);
      },
      onError: function (msg, retriable) {
        self.hideLoading();
        if (msg && !retriable) self.setError(msg);
        else if (msg) self.setError(msg);
      },
      onAbort: function () {
        self.hideLoading();
      },
      onEnd: function () {
        self.pending = false;
        if (self.sendBtn) self.sendBtn.disabled = false;
      },
    });
  };

  CoachThread.prototype.setCoachMode = function (mode) {
    this.coachMode = mode === 'routine' ? 'routine' : 'chat';
    if (this.routineToggle) {
      this.routineToggle.checked = this.coachMode === 'routine';
    }
    if (this.chipsEl) this.chipsEl.hidden = this.coachMode === 'routine';
    if (this.inputEl) {
      this.inputEl.placeholder =
        this.coachMode === 'routine'
          ? 'Optional notes for your weekly split (equipment, goals)…'
          : 'Talk to Rocky…';
    }
    if (this.sendBtn) {
      this.sendBtn.setAttribute(
        'aria-label',
        this.coachMode === 'routine' ? 'Generate full weekly routine' : 'Send message'
      );
    }
    this.setError('');
  };

  CoachThread.prototype.generateFullRoutine = function () {
    var self = this;
    if (this.pending) return;
    if (!window.CoachPending) {
      this.setError('Could not reach the API.');
      return;
    }

    this.pending = true;
    if (this.sendBtn) this.sendBtn.disabled = true;
    if (this.routineToggle) this.routineToggle.disabled = true;

    var userNotes = this.inputEl && this.inputEl.value ? this.inputEl.value.trim() : '';
    var text =
      'Generate my full weekly training split (Monday through Sunday). Factor in my practice days, game days, and season — avoid stacking heavy leg work before games.' +
      (userNotes ? '\n\nAthlete notes: ' + userNotes : '') +
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

    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.style.height = 'auto';
    }
    this.showLoading();

    window.CoachPending.startRequest(
      {
        message: text,
        contextBlock: this.getContextBlock(),
        thread: threadForApi,
      },
      {
        onSuccess: function (assistantMsg, quota) {
          self.hideLoading();
          var content = assistantMsg.content || assistantMsg.text || '';
          var parsed = window.RoutineImport ? window.RoutineImport.parseWeeklyRoutine(content) : null;
          if (parsed) {
            assistantMsg.responseType = 'routine';
            assistantMsg.routineParsed = parsed;
          }
          self.finishAssistantReply(assistantMsg, quota);
        },
        onError: function (msg) {
          self.hideLoading();
          if (msg) self.setError(msg);
        },
        onEnd: function () {
          self.pending = false;
          if (self.sendBtn) self.sendBtn.disabled = false;
          if (self.routineToggle) self.routineToggle.disabled = false;
        },
      }
    );
  };

  CoachThread.prototype.send = function () {
    var self = this;
    if (this.pending) return;
    if (this.routineToggle && this.routineToggle.checked) {
      this.generateFullRoutine();
      return;
    }
    var text = this.inputEl && this.inputEl.value ? this.inputEl.value.trim() : '';
    if (!text) {
      this.setError('Say something to Rocky.');
      return;
    }
    if (!window.CoachPending) {
      this.setError('Could not reach the API.');
      return;
    }

    this.setError('');
    this.pending = true;
    if (this.sendBtn) this.sendBtn.disabled = true;
    if (this.routineToggle) this.routineToggle.disabled = true;

    var threadForApi = this.messages
      .filter(function (m) {
        return m.role === 'user' || m.role === 'assistant';
      })
      .map(function (m) {
        return { role: m.role, content: m.content || m.text || '' };
      });

    this.messages.push({ role: 'user', content: text });
    if (window.CoachMemory) window.CoachMemory.ingestUserMessage(text);
    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.style.height = 'auto';
    }
    this.render();
    this.refreshBriefing();
    this.saveToStorage();
    this.showLoading();

    window.CoachPending.startRequest(
      {
        message: text,
        contextBlock: this.getContextBlock(),
        thread: threadForApi,
      },
      {
        onSuccess: function (assistantMsg, quota) {
          self.finishAssistantReply(assistantMsg, quota);
        },
        onError: function (msg, retriable) {
          self.hideLoading();
          if (msg) self.setError(msg);
          if (!retriable && window.CoachPending) window.CoachPending.clearPending();
        },
        onAbort: function () {
          self.hideLoading();
        },
        onEnd: function () {
          self.pending = false;
          if (self.sendBtn) self.sendBtn.disabled = false;
          if (self.routineToggle) self.routineToggle.disabled = false;
        },
      }
    );
  };

  window.CoachThread = CoachThread;
  window.COACH_NAME = COACH_NAME;
})();
