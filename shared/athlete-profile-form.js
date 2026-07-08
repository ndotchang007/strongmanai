(function () {
  var ANYTHING_ELSE_KEY = 'strongman-coach-anything-else';
  var FAVORITES_KEY = 'strongman-favorite-movements';

  function el(id) {
    return document.getElementById(id);
  }

  function tip(key) {
    return window.InfoTip ? window.InfoTip.iconHtml(key) : '';
  }

  function buddyPills(fieldId, options) {
    var btns = options
      .map(function (o) {
        return (
          '<button type="button" class="buddy-pill" data-value="' +
          o.value +
          '">' +
          o.label +
          '</button>'
        );
      })
      .join('');
    return (
      '<div class="buddy-pills" data-buddy-for="' +
      fieldId +
      '" role="group">' +
      btns +
      '</div>'
    );
  }

  function buddyDayChip(cls, wd, label) {
    return (
      '<label class="buddy-day"><input type="checkbox" class="' +
      cls +
      '" data-weekday="' +
      wd +
      '"><span>' +
      label +
      '</span></label>'
    );
  }

  function syncBuddyPillGroup(wrap, value) {
    if (!wrap) return;
    wrap.querySelectorAll('.buddy-pill').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-value') === value);
    });
  }

  function initBuddyPills(root, opts) {
    opts = opts || {};
    var rootEl = root || document;
    rootEl.querySelectorAll('.buddy-pills[data-buddy-for]').forEach(function (wrap) {
      var id = wrap.getAttribute('data-buddy-for');
      var sel = document.getElementById(id);
      if (!sel) return;
      wrap.querySelectorAll('.buddy-pill').forEach(function (btn) {
        btn.addEventListener('click', function () {
          sel.value = btn.getAttribute('data-value');
          syncBuddyPillGroup(wrap, sel.value);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
      syncBuddyPillGroup(wrap, sel.value);
    });
  }

  function formHtml(opts) {
    opts = opts || {};
    var p = opts.prefix || 'customize-';
    var practiceCls = opts.practiceClass || 'customize-practice-day';
    var gameCls = opts.gameClass || 'customize-game-day';
    var includeNotes = opts.includeNotes !== false;
    var includeHint = !!opts.includeHint;

    var html =
      (includeHint
        ? '<div class="customize-hint-card buddy-today-card" id="' +
          p +
          'today-hint" hidden role="status" aria-live="polite"></div>'
        : '') +
      '<div class="buddy-form">' +
      '<section class="buddy-block">' +
      '<p class="buddy-prompt">About you</p>' +
      '<p class="buddy-subprompt">Grade</p>' +
      '<select id="' +
      p +
      'grade" class="buddy-select-hidden customize-input" aria-hidden="true" tabindex="-1">' +
      '<option value="">—</option><option value="9">9th</option><option value="10">10th</option>' +
      '<option value="11">11th</option><option value="12">12th</option></select>' +
      buddyPills(p + 'grade', [
        { value: '9', label: '9th' },
        { value: '10', label: '10th' },
        { value: '11', label: '11th' },
        { value: '12', label: '12th' },
      ]) +
      '<p class="buddy-subprompt">What should I optimize for?' +
      tip('main_goal') +
      '</p>' +
      '<select id="' +
      p +
      'goal" class="buddy-select-hidden customize-input" aria-hidden="true" tabindex="-1">' +
      '<option value="sport_performance">Sport performance</option>' +
      '<option value="aesthetics">Physique</option>' +
      '<option value="strength">Max strength</option>' +
      '<option value="general_health">General health</option></select>' +
      buddyPills(p + 'goal', [
        { value: 'sport_performance', label: 'Sport' },
        { value: 'aesthetics', label: 'Physique' },
        { value: 'strength', label: 'Strength' },
        { value: 'general_health', label: 'Health' },
      ]) +
      '</section>' +
      '<section class="buddy-block buddy-block--compact">' +
      '<p class="buddy-prompt">How long can you realistically lift?' +
      tip('weeknight_cap') +
      '</p>' +
      '<p class="buddy-subprompt">School nights</p>' +
      '<select id="' +
      p +
      'school-night" class="buddy-select-hidden customize-input" aria-hidden="true" tabindex="-1">' +
      '<option value="30">30</option><option value="45">45</option>' +
      '<option value="60">60</option><option value="90">90</option></select>' +
      buddyPills(p + 'school-night', [
        { value: '30', label: '30 min' },
        { value: '45', label: '45 min' },
        { value: '60', label: '60 min' },
        { value: '90', label: '90 min' },
      ]) +
      '<p class="buddy-subprompt">Weekends' +
      tip('weekend_max') +
      '</p>' +
      '<select id="' +
      p +
      'weekend" class="buddy-select-hidden customize-input" aria-hidden="true" tabindex="-1">' +
      '<option value="45">45</option><option value="60">60</option>' +
      '<option value="90">90</option><option value="120">120</option></select>' +
      buddyPills(p + 'weekend', [
        { value: '45', label: '45 min' },
        { value: '60', label: '60 min' },
        { value: '90', label: '90 min' },
        { value: '120', label: '2 hr' },
      ]) +
      '</section>' +
      '<section class="buddy-block buddy-block--compact">' +
      '<p class="buddy-prompt">Training background</p>' +
      '<p class="buddy-subprompt">Experience</p>' +
      '<select id="' +
      p +
      'experience" class="buddy-select-hidden customize-input" aria-hidden="true" tabindex="-1">' +
      '<option value="beginner">Beginner</option>' +
      '<option value="intermediate">Intermediate</option>' +
      '<option value="advanced">Advanced</option></select>' +
      buddyPills(p + 'experience', [
        { value: 'beginner', label: 'Beginner' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'advanced', label: 'Advanced' },
      ]) +
      '<p class="buddy-subprompt">Where you train</p>' +
      '<select id="' +
      p +
      'equipment" class="buddy-select-hidden customize-input" aria-hidden="true" tabindex="-1">' +
      '<option value="local">Gym</option>' +
      '<option value="home">Home gym</option>' +
      '<option value="none">Minimal</option></select>' +
      buddyPills(p + 'equipment', [
        { value: 'local', label: 'Gym' },
        { value: 'home', label: 'Home gym' },
        { value: 'none', label: 'Minimal' },
      ]) +
      '<p class="buddy-subprompt">Lifts you care about most</p>' +
      '<p class="buddy-notes-hint">One per line or comma-separated — Rocky uses these on Log and for overload suggestions.</p>' +
      '<textarea id="' +
      p +
      'favorites" class="buddy-notes customize-favorites" rows="3" maxlength="2000" ' +
      'placeholder="e.g. bench, squat, RDL, axle clean &amp; press" spellcheck="true"></textarea>' +
      '</section>' +
      '</div>';

    if (includeNotes) {
      html +=
        '<section class="buddy-block buddy-block--notes">' +
        '<div class="buddy-known-header">' +
        '<p class="buddy-subprompt buddy-subprompt--inline">Things I already know about you</p>' +
        '<a href="/init?refine=1" class="buddy-known-customize-btn">Customize</a>' +
        '</div>' +
        '<div id="' +
        p +
        'known-notes" class="buddy-known-notes customize-known-notes" role="region">Nothing saved from setup yet.</div>' +
        '<p class="buddy-subprompt">Anything else you want me to know</p>' +
        '<textarea id="' +
        p +
        'notes" class="buddy-notes customize-notes" rows="3" maxlength="4000" spellcheck="true" aria-label="Anything else you want me to know"></textarea>' +
        '</section>';
    }

    html +=
      '<p class="customize-status" id="' +
      p +
      'status" role="status" aria-live="polite" hidden></p>';

    return html;
  }

  function resolveCoachNotesFields(ctx) {
    ctx = ctx || {};
    var known = ctx.knownNotes ? String(ctx.knownNotes).trim() : '';
    var userNotes = ctx.notes ? String(ctx.notes).trim() : '';
    if (!known && userNotes) {
      known = userNotes;
      userNotes = '';
    }
    return { known: known, userNotes: userNotes };
  }

  function readUserNotesOnly(ctx) {
    if (!ctx) return '';
    var known = ctx.knownNotes ? String(ctx.knownNotes).trim() : '';
    if (window.KnownNotes && window.KnownNotes.sanitizeForAnythingElseTextarea) {
      return window.KnownNotes.sanitizeForAnythingElseTextarea(ctx.notes, known);
    }
    if (ctx.notes == null) return '';
    var notes = String(ctx.notes).trim();
    if (known && notes === known) return '';
    return notes;
  }

  function clearStaleAnythingElseStorage(knownText) {
    try {
      var stored = localStorage.getItem(ANYTHING_ELSE_KEY);
      if (!stored) return;
      var known = knownText ? String(knownText).trim() : '';
      if (window.KnownNotes && window.KnownNotes.sanitizeForAnythingElseTextarea) {
        if (!window.KnownNotes.sanitizeForAnythingElseTextarea(stored, known)) {
          localStorage.removeItem(ANYTHING_ELSE_KEY);
        }
        return;
      }
      if (known && stored.trim() === known) {
        localStorage.removeItem(ANYTHING_ELSE_KEY);
      }
    } catch (e) {}
  }

  function loadContext(user) {
    if (window.AthleteContext && user) {
      return window.AthleteContext.loadAthleteContext(user);
    }
    if (window.AthleteContext) return window.AthleteContext.defaultContext();
    return {};
  }

  function readForm(opts) {
    opts = opts || {};
    var p = opts.prefix || 'customize-';
    var goalEl = el(p + 'goal');
    var primaryGoal = goalEl ? goalEl.value : 'sport_performance';
    var notesEl = el(p + 'notes');
    var notes =
      notesEl && notesEl.value ? notesEl.value.trim().slice(0, 4000) : null;
    var sports =
      window.AthleteSportsEditor && typeof window.AthleteSportsEditor.getSports === 'function'
        ? window.AthleteSportsEditor.getSports()
        : [];
    var primary =
      sports.find(function (s) {
        return s.isPrimary;
      }) || sports[0] || null;
    return {
      sports: sports,
      sport: primary ? primary.sport : null,
      sportId: primary ? primary.sportId : null,
      position: primary ? primary.position : null,
      seasonPhase: primary && primary.seasonPhase ? primary.seasonPhase : null,
      practiceDays: primary ? primary.practiceDays || [] : [],
      gameDays: primary ? primary.gameDays || [] : [],
      gradeLevel: (el(p + 'grade') || {}).value || null,
      primaryGoal: primaryGoal,
      schoolDays: [1, 2, 3, 4, 5],
      schoolNightMaxMinutes: parseInt((el(p + 'school-night') || {}).value || '45', 10),
      weekendMaxMinutes: parseInt((el(p + 'weekend') || {}).value || '90', 10),
      notes: notes,
      experience: (el(p + 'experience') || {}).value || 'beginner',
      equipment: (el(p + 'equipment') || {}).value || 'home',
      favoriteMovements:
        el(p + 'favorites') && el(p + 'favorites').value
          ? el(p + 'favorites').value.trim().slice(0, 2000)
          : '',
      reason:
        window.AthleteContext && window.AthleteContext.primaryGoalToReason
          ? window.AthleteContext.primaryGoalToReason(primaryGoal)
          : 'sports',
    };
  }

  function loadIntoForm(user, opts) {
    opts = opts || {};
    var p = opts.prefix || 'customize-';
    if (!el(p + 'grade')) return;
    var ctx = loadContext(user);
    if (window.AthleteSportsEditor && typeof window.AthleteSportsEditor.setSports === 'function') {
      window.AthleteSportsEditor.setSports(
        window.AthleteContext ? window.AthleteContext.getSports(ctx) : ctx.sports || []
      );
    }
    if (el(p + 'grade')) el(p + 'grade').value = ctx.gradeLevel || '';
    if (el(p + 'goal')) el(p + 'goal').value = ctx.primaryGoal || 'sport_performance';
    if (el(p + 'school-night')) el(p + 'school-night').value = String(ctx.schoolNightMaxMinutes || 45);
    if (el(p + 'weekend')) el(p + 'weekend').value = String(ctx.weekendMaxMinutes || 90);
    if (el(p + 'experience')) el(p + 'experience').value = (user && user.experience) || 'beginner';
    if (el(p + 'equipment')) el(p + 'equipment').value = (user && user.equipment) || 'home';
    var favEl = el(p + 'favorites');
    if (favEl) {
      try {
        favEl.value = localStorage.getItem(FAVORITES_KEY) || '';
      } catch (eFav) {}
    }
    var notesEl = el(p + 'notes');
    var knownEl = el(p + 'known-notes');
    var fields = resolveCoachNotesFields(ctx);
    if (knownEl) {
      if (window.KnownNotes && window.KnownNotes.renderInto) {
        window.KnownNotes.renderInto(knownEl, fields.known, 'Nothing saved from setup yet.');
        knownEl.classList.toggle('buddy-known-notes--empty', !fields.known);
      } else {
        knownEl.textContent = fields.known || 'Nothing saved from setup yet.';
        knownEl.classList.toggle('buddy-known-notes--empty', !fields.known);
      }
    }
    if (notesEl) {
      var userNotesClean = readUserNotesOnly(ctx);
      notesEl.value = userNotesClean || '';
      notesEl.placeholder = '';
      notesEl.removeAttribute('placeholder');
      clearStaleAnythingElseStorage(fields.known);
      try {
        if (userNotesClean) localStorage.setItem(ANYTHING_ELSE_KEY, userNotesClean);
        else localStorage.removeItem(ANYTHING_ELSE_KEY);
      } catch (eLs) {}
    }
    initBuddyPills(document, opts);
  }

  function setStatus(statusEl, message, isError) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.classList.remove('customize-status--error');
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('customize-status--error', !!isError);
  }

  function persist(user, opts) {
    opts = opts || {};
    var p = opts.prefix || 'customize-';
    if (!el(p + 'grade')) return Promise.resolve();
    var u = user || (typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null);
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') {
      return Promise.resolve();
    }
    var form = readForm(opts);
    var statusEl = el(p + 'status');
    var sportFocused =
      window.AthleteContext &&
      typeof window.AthleteContext.isSportFocusedGoal === 'function' &&
      window.AthleteContext.isSportFocusedGoal({ primaryGoal: form.primaryGoal });
    if (sportFocused && (!form.sports || !form.sports.length)) {
      setStatus(statusEl, 'Add at least one sport.', true);
      return Promise.resolve(false);
    }
    if (sportFocused) {
      var missingSeason = form.sports.filter(function (s) {
        return s && s.sport && !s.seasonPhase;
      });
      if (missingSeason.length) {
        setStatus(statusEl, 'Pick a season phase for each sport (edit the sport card).', true);
        return Promise.resolve(false);
      }
      var incompleteSchedule = form.sports.filter(function (s) {
        return (
          s &&
          s.sport &&
          !(s.practiceDays && s.practiceDays.length) &&
          !(s.gameDays && s.gameDays.length)
        );
      });
      if (incompleteSchedule.length) {
        setStatus(statusEl, 'Add practice or game days for each sport (edit the sport card).', true);
        return Promise.resolve(false);
      }
    }
    var ctx = loadContext(u);
    var fields = resolveCoachNotesFields(ctx);
    var knownNotes = ctx.knownNotes != null ? ctx.knownNotes : fields.known || null;
    var notesToSave = form.notes;
    if (window.KnownNotes) {
      if (
        !knownNotes &&
        form.notes &&
        window.KnownNotes.looksLikeKnownSetupNotes(form.notes)
      ) {
        knownNotes = String(form.notes).trim();
        notesToSave = null;
      } else if (
        !knownNotes &&
        !form.notes &&
        ctx.notes &&
        window.KnownNotes.looksLikeKnownSetupNotes(ctx.notes)
      ) {
        knownNotes = String(ctx.notes).trim();
        notesToSave = null;
      } else if (window.KnownNotes.sanitizeNotesForSave) {
        notesToSave = window.KnownNotes.sanitizeNotesForSave(form.notes, knownNotes);
      }
    }
    var athleteContext = {
      sports: form.sports,
      sport: form.sport,
      sportId: form.sportId,
      position: form.position,
      gradeLevel: form.gradeLevel,
      seasonPhase: form.seasonPhase,
      primaryGoal: form.primaryGoal,
      schoolDays: form.schoolDays,
      practiceDays: form.practiceDays,
      gameDays: form.gameDays,
      schoolNightMaxMinutes: form.schoolNightMaxMinutes,
      weekendMaxMinutes: form.weekendMaxMinutes,
      knownNotes: knownNotes,
      notes: notesToSave,
    };
    try {
      if (notesToSave) localStorage.setItem(ANYTHING_ELSE_KEY, notesToSave);
      else localStorage.removeItem(ANYTHING_ELSE_KEY);
    } catch (e) {}
    if (form.favoriteMovements !== undefined) {
      try {
        localStorage.setItem(FAVORITES_KEY, form.favoriteMovements || '');
      } catch (eFav2) {}
    }
    if (window.NamePolicy) {
      var policyHit = null;
      form.sports.forEach(function (s) {
        if (policyHit) return;
        policyHit = window.NamePolicy.checkAccountNameFields({
          sport: s.sport,
          position: s.position,
        });
      });
      if (!policyHit) {
        policyHit = window.NamePolicy.checkAccountNameFields({
          notes: athleteContext.notes,
        });
      }
      if (policyHit) {
        if (statusEl) window.NamePolicy.showPolicyError(statusEl, policyHit);
        return Promise.resolve(false);
      }
    }
    return window
      .apiPut('/users/' + u.id, {
        reason: form.reason,
        athleteContext: athleteContext,
        experience: form.experience,
        equipment: form.equipment,
      })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var apiPolicy =
              window.NamePolicy && window.NamePolicy.responseToViolation(body);
            if (apiPolicy && statusEl) {
              window.NamePolicy.showPolicyError(statusEl, apiPolicy);
            } else {
              setStatus(statusEl, (body && body.error) || 'Could not save athlete profile.', true);
            }
            return false;
          }
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
          var successMsg = opts.successMessage || "Got it — I'll remember that.";
          if (incompleteSchedule.length) {
            successMsg +=
              ' Some sports are missing practice or game days — add them when you can.';
          }
          setStatus(statusEl, successMsg);
          if (!opts.quiet) {
            setTimeout(function () {
              setStatus(statusEl, '');
            }, 2200);
          }
          if (typeof opts.onSaved === 'function') opts.onSaved(body);
          return true;
        });
      })
      .catch(function () {
        setStatus(statusEl, 'Network error saving athlete profile.', true);
        return false;
      });
  }

  function bindAutoSave(root, opts) {
    opts = opts || {};
    var p = opts.prefix || 'customize-';
    var rootEl = root || document;
    var save = function () {
      persist(null, opts);
    };
    rootEl.querySelectorAll('.customize-input, .customize-notes').forEach(function (node) {
      if (!node.id || node.id.indexOf(p) !== 0) return;
      node.addEventListener('change', save);
      if (node.tagName === 'INPUT' && node.type === 'text') {
        node.addEventListener('blur', save);
      }
    });
    var notesEl = el(p + 'notes');
    if (notesEl) {
      notesEl.addEventListener('change', save);
      notesEl.addEventListener('blur', save);
    }
    var favEl = el(p + 'favorites');
    if (favEl) {
      favEl.addEventListener('change', function () {
        try {
          localStorage.setItem(FAVORITES_KEY, favEl.value.trim().slice(0, 2000));
        } catch (e) {}
        save();
      });
      favEl.addEventListener('blur', function () {
        try {
          localStorage.setItem(FAVORITES_KEY, favEl.value.trim().slice(0, 2000));
        } catch (e) {}
      });
    }
  }

  function persistNotesOnly(notes) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') {
      return Promise.resolve();
    }
    var ctx = loadContext(u);
    var trimmed = notes ? String(notes).trim().slice(0, 4000) : null;
    var fields = resolveCoachNotesFields(ctx);
    var knownNotes = ctx.knownNotes != null ? ctx.knownNotes : fields.known || null;
    var notesToSave = trimmed;
    if (window.KnownNotes && window.KnownNotes.sanitizeNotesForSave) {
      notesToSave = window.KnownNotes.sanitizeNotesForSave(trimmed, knownNotes);
    }
    var athleteContext = Object.assign({}, ctx, {
      knownNotes: knownNotes,
      notes: notesToSave,
    });
    var reason =
      window.AthleteContext && window.AthleteContext.primaryGoalToReason
        ? window.AthleteContext.primaryGoalToReason(ctx.primaryGoal || 'sport_performance')
        : u.reason || 'sports';
    return window.apiPut('/users/' + u.id, { reason: reason, athleteContext: athleteContext });
  }

  function initSportPicker(opts) {
    opts = opts || {};
    var p = opts.prefix || 'customize-';
    if (!window.bindSportPicker) return null;
    return window.bindSportPicker({
      inputId: p + 'sport',
      hiddenId: p + 'sport-id',
      datalistId: 'sport-datalist',
      positionLabelId: p + 'position-label',
      tipElId: p + 'sport-tip',
      onChange: opts.onSportChange,
    });
  }

  window.AthleteProfileForm = {
    ANYTHING_ELSE_KEY: ANYTHING_ELSE_KEY,
    FAVORITES_KEY: FAVORITES_KEY,
    formHtml: formHtml,
    loadIntoForm: loadIntoForm,
    readForm: readForm,
    persist: persist,
    bindAutoSave: bindAutoSave,
    persistNotesOnly: persistNotesOnly,
    loadContext: loadContext,
    initSportPicker: initSportPicker,
    initBuddyPills: initBuddyPills,
  };
})();
