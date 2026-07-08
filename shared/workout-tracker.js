(function () {
  'use strict';

  var WS = function () {
    return window.WorkoutSession;
  };

  var VIEW_MODES = ['focus', 'card', 'spreadsheet', 'timeline', 'map'];

  function isMobileViewport() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
  }

  function isWorkoutDashboardOpen() {
    return document.body.classList.contains('workout-dashboard-open');
  }

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  function Tracker(root) {
    this.root = root;
    this.session = null;
    this.onChange = null;
    this.lastCompletedAt = null;
    this._datalistId = 'wt-exercise-datalist';
    this._ensureDatalist();
    this._bindGlobal();
    this._loadOrCreate();
    this.render();
  }

  Tracker.prototype._ensureDatalist = function () {
    if (document.getElementById(this._datalistId)) return;
    var dl = el('datalist', '', { id: this._datalistId });
    var ED = window.ExerciseDatabase;
    if (ED && typeof ED.search === 'function') {
      ED.search({ limit: 200 }).forEach(function (item) {
        var opt = el('option');
        opt.value = item.name || item;
        dl.appendChild(opt);
      });
    }
    document.body.appendChild(dl);
  };

  function weightPlaceholder() {
    return window.Units && window.Units.weightLabel ? window.Units.weightLabel() : 'lb';
  }

  Tracker.prototype._bindGlobal = function () {
    var self = this;
    this.root.addEventListener('click', function (e) {
      self._handleClick(e);
    });
    this.root.addEventListener('input', function (e) {
      self._handleInput(e);
    });
    this.root.addEventListener('change', function (e) {
      self._handleChange(e);
    });
  };

  Tracker.prototype._loadOrCreate = function () {
    var S = WS();
    var existing = S.loadSession();
    if (existing && existing.status === 'active') {
      this.session = existing;
      if (!this.session.focusPointer) {
        this.session.focusPointer = { exerciseId: null, setId: null };
      }
    } else {
      this.session = S.createSession();
      S.saveSession(this.session);
    }
    if (isMobileViewport() && this.session.viewMode === 'card' && !existing) {
      this.session.viewMode = 'focus';
      S.saveSession(this.session);
    }
    this._syncLastCompleted();
    this._ensureFocusPointer();
  };

  Tracker.prototype._syncLastCompleted = function () {
    var events = WS().completedSetsTimeline(this.session.exercises);
    if (events.length) {
      this.lastCompletedAt = events[events.length - 1].completedAt;
    }
  };

  Tracker.prototype._persist = function () {
    WS().saveSession(this.session);
    if (typeof this.onChange === 'function') this.onChange(this.session);
  };

  Tracker.prototype._sortedExercises = function () {
    return this.session.exercises.slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
  };

  Tracker.prototype._findExercise = function (id) {
    return this.session.exercises.find(function (ex) {
      return ex.id === id;
    });
  };

  Tracker.prototype._findSet = function (exerciseId, setId) {
    var ex = this._findExercise(exerciseId);
    if (!ex) return null;
    var set = ex.sets.find(function (s) {
      return s.id === setId;
    });
    return set ? { exercise: ex, set: set } : null;
  };

  Tracker.prototype._flushDomToSession = function () {
    if (!this.root) return;
    var self = this;
    this.root.querySelectorAll('[data-wt-field]').forEach(function (inp) {
      var field = inp.getAttribute('data-wt-field');
      var exId = inp.getAttribute('data-exercise-id');
      var setId = inp.getAttribute('data-set-id');
      if (!field || !exId) return;
      if (field === 'exercise-name') {
        var ex = self._findExercise(exId);
        if (ex) ex.name = inp.value;
        return;
      }
      var found = self._findSet(exId, setId);
      if (!found) return;
      var S = WS();
      if (field === 'set-weight') found.set.weight = S.parseNum(inp.value);
      if (field === 'set-reps') found.set.reps = S.parseNum(inp.value);
      if (field === 'set-notes') found.set.notes = inp.value;
    });
  };

  Tracker.prototype._allSetRefs = function () {
    var refs = [];
    this._sortedExercises().forEach(function (ex) {
      (ex.sets || []).forEach(function (set) {
        refs.push({ exercise: ex, set: set });
      });
    });
    return refs;
  };

  Tracker.prototype._ensureFocusPointer = function () {
    var refs = this._allSetRefs();
    if (!refs.length) {
      this.session.focusPointer = { exerciseId: null, setId: null };
      return;
    }
    var fp = this.session.focusPointer || {};
    var valid = refs.some(function (r) {
      return r.exercise.id === fp.exerciseId && r.set.id === fp.setId;
    });
    if (valid) return;
    var next = refs.find(function (r) {
      return !r.set.completed;
    });
    this.session.focusPointer = next
      ? { exerciseId: next.exercise.id, setId: next.set.id }
      : { exerciseId: refs[0].exercise.id, setId: refs[0].set.id };
  };

  Tracker.prototype._advanceFocusPointer = function () {
    var refs = this._allSetRefs();
    var fp = this.session.focusPointer || {};
    var idx = refs.findIndex(function (r) {
      return r.exercise.id === fp.exerciseId && r.set.id === fp.setId;
    });
    for (var i = idx + 1; i < refs.length; i++) {
      if (!refs[i].set.completed) {
        this.session.focusPointer = { exerciseId: refs[i].exercise.id, setId: refs[i].set.id };
        return;
      }
    }
    for (var j = 0; j < refs.length; j++) {
      if (!refs[j].set.completed) {
        this.session.focusPointer = { exerciseId: refs[j].exercise.id, setId: refs[j].set.id };
        return;
      }
    }
    if (refs.length) {
      this.session.focusPointer = { exerciseId: refs[refs.length - 1].exercise.id, setId: refs[refs.length - 1].set.id };
    }
  };

  Tracker.prototype.setViewMode = function (mode) {
    if (VIEW_MODES.indexOf(mode) === -1) return;
    this._flushDomToSession();
    this.session.viewMode = mode;
    if (mode === 'focus') this._ensureFocusPointer();
    this._persist();
    this.render();
  };

  Tracker.prototype.setWorkoutDate = function (dateStr) {
    this.session.workoutDate = dateStr || null;
    this._persist();
  };

  Tracker.prototype.addExercise = function (name) {
    var S = WS();
    var order = this.session.exercises.length;
    var prev = S.getPreviousPerformance(name || '');
    var sets = [S.createSet({ setNumber: 1 })];
    if (prev && prev.length) {
      sets = prev.map(function (line, i) {
        var parts = line.split('×').map(function (p) {
          return p.trim();
        });
        return S.createSet({
          setNumber: i + 1,
          weight: S.parseNum(parts[0]),
          reps: S.parseNum(parts[1])
        });
      });
    }
    var exercise = S.createExercise(name || '', { order: order, sets: sets });
    this.session.exercises.push(exercise);
    this._ensureFocusPointer();
    this._persist();
    this.render();
    return exercise;
  };

  Tracker.prototype.removeExercise = function (exerciseId) {
    this.session.exercises = this.session.exercises.filter(function (ex) {
      return ex.id !== exerciseId;
    });
    this.session.exercises.forEach(function (ex, i) {
      ex.order = i;
    });
    this._persist();
    this.render();
  };

  Tracker.prototype.addSet = function (exerciseId) {
    var ex = this._findExercise(exerciseId);
    if (!ex) return;
    var last = ex.sets[ex.sets.length - 1];
    var S = WS();
    ex.sets.push(
      S.createSet({
        setNumber: ex.sets.length + 1,
        weight: last ? last.weight : null,
        reps: last ? last.reps : null
      })
    );
    this._persist();
    this.render();
  };

  Tracker.prototype.removeSet = function (exerciseId, setId) {
    var ex = this._findExercise(exerciseId);
    if (!ex || ex.sets.length <= 1) return;
    ex.sets = ex.sets.filter(function (s) {
      return s.id !== setId;
    });
    WS().renumberSets(ex);
    this._persist();
    this.render();
  };

  Tracker.prototype.setRestSeconds = function (exerciseId, setId, seconds) {
    var found = this._findSet(exerciseId, setId);
    if (!found) return;
    found.set.restSeconds = Math.max(0, Math.round(seconds));
    this._persist();
    this.render();
  };

  Tracker.prototype.findSet = function (exerciseId, setId) {
    return this._findSet(exerciseId, setId);
  };

  Tracker.prototype.completeSet = function (exerciseId, setId) {
    var found = this._findSet(exerciseId, setId);
    if (!found || found.set.completed) return false;
    var set = found.set;
    var now = new Date().toISOString();
    var skipAutoRest =
      window.WorkoutDashboard &&
      typeof window.WorkoutDashboard.isActive === 'function' &&
      window.WorkoutDashboard.isActive();
    if (!skipAutoRest && this.lastCompletedAt) {
      var restMs = Date.now() - Date.parse(this.lastCompletedAt);
      set.restSeconds = Math.max(0, Math.round(restMs / 1000));
    }
    set.completed = true;
    set.completedAt = now;
    this.lastCompletedAt = now;
    if (this.session.viewMode === 'focus') this._advanceFocusPointer();
    this._ensureFocusPointer();
    this._persist();
    if (typeof this.onSetCompleted === 'function') {
      this.onSetCompleted(exerciseId, setId);
    }
    this.render();
    return true;
  };

  Tracker.prototype.toggleSetComplete = function (exerciseId, setId) {
    var found = this._findSet(exerciseId, setId);
    if (!found) return;
    var set = found.set;
    var now = new Date().toISOString();
    if (set.completed) {
      set.completed = false;
      set.completedAt = null;
      set.restSeconds = null;
    } else {
      if (this.lastCompletedAt) {
        var restMs = Date.now() - Date.parse(this.lastCompletedAt);
        set.restSeconds = Math.max(0, Math.round(restMs / 1000));
      }
      set.completed = true;
      set.completedAt = now;
      this.lastCompletedAt = now;
      if (this.session.viewMode === 'focus') this._advanceFocusPointer();
    }
    this._ensureFocusPointer();
    this._persist();
    this.render();
  };

  Tracker.prototype.toggleSupersetGroup = function (exerciseId) {
    var ex = this._findExercise(exerciseId);
    if (!ex) return;
    if (ex.supersetGroupId) {
      var gid = ex.supersetGroupId;
      this.session.exercises.forEach(function (item) {
        if (item.supersetGroupId === gid) item.supersetGroupId = null;
      });
    } else {
      var prev = this._sortedExercises();
      var idx = prev.findIndex(function (p) {
        return p.id === exerciseId;
      });
      if (idx > 0) {
        var prevEx = prev[idx - 1];
        var gid2 = prevEx.supersetGroupId || WS().nextSupersetGroupId(this.session.exercises);
        prevEx.supersetGroupId = gid2;
        ex.supersetGroupId = gid2;
      } else {
        ex.supersetGroupId = WS().nextSupersetGroupId(this.session.exercises);
      }
    }
    this._persist();
    this.render();
  };

  Tracker.prototype.toggleExerciseCollapsed = function (exerciseId) {
    var ex = this._findExercise(exerciseId);
    if (!ex) return;
    ex.collapsed = !ex.collapsed;
    this._persist();
    this.render();
  };

  Tracker.prototype.loadFromLegacyExercises = function (exercises) {
    this.session.exercises = WS().fromLegacyExercises(exercises);
    this._persist();
    this.render();
  };

  Tracker.prototype.getLegacyExercises = function () {
    return WS().toLegacyExercises(this.session.exercises);
  };

  Tracker.prototype.hasExercises = function () {
    return this.session.exercises.some(WS().exerciseHasContent);
  };

  Tracker.prototype.getExerciseCount = function () {
    return this.session.exercises.filter(WS().exerciseHasContent).length;
  };

  Tracker.prototype.reset = function () {
    WS().clearSession();
    this.session = WS().createSession();
    this.lastCompletedAt = null;
    WS().saveSession(this.session);
    this.render();
  };

  Tracker.prototype.getSession = function () {
    return WS().clone(this.session);
  };

  Tracker.prototype._handleClick = function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-wt-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-wt-action');
    var exId = btn.getAttribute('data-exercise-id');
    var setId = btn.getAttribute('data-set-id');
    var mode = btn.getAttribute('data-view-mode');

    if (action === 'set-view' && mode) {
      this.setViewMode(mode);
      return;
    }
    if (action === 'add-exercise') {
      this.addExercise('');
      return;
    }
    if (action === 'remove-exercise' && exId) {
      this.removeExercise(exId);
      return;
    }
    if (action === 'add-set' && exId) {
      this.addSet(exId);
      return;
    }
    if (action === 'remove-set' && exId && setId) {
      this.removeSet(exId, setId);
      return;
    }
    if (action === 'toggle-set' && exId && setId) {
      this.toggleSetComplete(exId, setId);
      return;
    }
    if (action === 'toggle-superset' && exId) {
      this.toggleSupersetGroup(exId);
      return;
    }
    if (action === 'toggle-collapse' && exId) {
      this.toggleExerciseCollapsed(exId);
      return;
    }
    if (action === 'focus-prev') {
      this._flushDomToSession();
      var refs = this._allSetRefs();
      var fp = this.session.focusPointer || {};
      var cur = refs.findIndex(function (r) {
        return r.exercise.id === fp.exerciseId && r.set.id === fp.setId;
      });
      if (cur > 0) {
        this.session.focusPointer = { exerciseId: refs[cur - 1].exercise.id, setId: refs[cur - 1].set.id };
        this._persist();
        this.render();
      }
      return;
    }
    if (action === 'focus-next') {
      this._flushDomToSession();
      var refs2 = this._allSetRefs();
      var fp2 = this.session.focusPointer || {};
      var cur2 = refs2.findIndex(function (r) {
        return r.exercise.id === fp2.exerciseId && r.set.id === fp2.setId;
      });
      if (cur2 >= 0 && cur2 < refs2.length - 1) {
        this.session.focusPointer = { exerciseId: refs2[cur2 + 1].exercise.id, setId: refs2[cur2 + 1].set.id };
        this._persist();
        this.render();
      }
      return;
    }
    if (action === 'focus-complete' && exId && setId) {
      this._flushDomToSession();
      var foundComplete = this._findSet(exId, setId);
      if (!foundComplete) return;
      var weightInp = this.root.querySelector(
        '[data-wt-field="set-weight"][data-exercise-id="' + exId + '"][data-set-id="' + setId + '"]'
      );
      var repsInp = this.root.querySelector(
        '[data-wt-field="set-reps"][data-exercise-id="' + exId + '"][data-set-id="' + setId + '"]'
      );
      var S = WS();
      if (weightInp) foundComplete.set.weight = S.parseNum(weightInp.value);
      if (repsInp) foundComplete.set.reps = S.parseNum(repsInp.value);
      if (foundComplete.set.weight == null || foundComplete.set.reps == null) return;
      if (!foundComplete.set.completed) this.completeSet(exId, setId);
      return;
    }
  };

  Tracker.prototype._handleInput = function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;
    var field = t.dataset.wtField;
    if (!field) return;
    var exId = t.getAttribute('data-exercise-id');
    var setId = t.getAttribute('data-set-id');
    var S = WS();

    if (field === 'exercise-name' && exId) {
      var ex = this._findExercise(exId);
      if (ex) ex.name = t.value;
      this._persist();
      return;
    }
    if (field === 'set-weight' || field === 'set-reps' || field === 'set-notes') {
      var found = this._findSet(exId, setId);
      if (!found) return;
      if (field === 'set-weight') found.set.weight = S.parseNum(t.value);
      if (field === 'set-reps') found.set.reps = S.parseNum(t.value);
      if (field === 'set-notes') found.set.notes = t.value;
      this._persist();
      if (this.session.viewMode === 'focus') this._updateFocusSaveBtn();
    }
  };

  Tracker.prototype._updateFocusSaveBtn = function () {
    var btn = this.root && this.root.querySelector('.wt-focus-save');
    if (!btn) return;
    var fp = this.session.focusPointer || {};
    var found = this._findSet(fp.exerciseId, fp.setId);
    if (!found) return;
    var set = found.set;
    var canComplete =
      focusCanComplete(set) && !set.completed;
    btn.disabled = !canComplete;
    btn.setAttribute('aria-disabled', canComplete ? 'false' : 'true');
    btn.classList.toggle('logbook-save-btn--blocked', !canComplete);
    btn.textContent = set.completed ? 'Set complete ✓' : 'Complete set';
  };

  function focusCanComplete(set) {
    return set.weight != null && set.reps != null && !isNaN(set.weight) && !isNaN(set.reps);
  }

  Tracker.prototype._handleChange = function (e) {
    this._handleInput(e);
  };

  Tracker.prototype._renderToolbar = function () {
    var self = this;
    var wrap = el('div', 'wt-toolbar');
    var views = el('nav', 'wt-view-tabs', { role: 'tablist', 'aria-label': 'Workout view' });
    var labels = { focus: 'Focus', card: 'Cards', spreadsheet: 'Sheet', timeline: 'Timeline', map: 'Map' };
    var modes = VIEW_MODES.slice();
    if (!isMobileViewport() && !isWorkoutDashboardOpen()) {
      modes = modes.filter(function (m) {
        return m !== 'focus';
      });
    }
    modes.forEach(function (mode) {
      var btn = el('button', 'wt-view-tab' + (self.session.viewMode === mode ? ' wt-view-tab--active' : ''), {
        type: 'button',
        role: 'tab',
        'aria-selected': self.session.viewMode === mode ? 'true' : 'false',
        'data-wt-action': 'set-view',
        'data-view-mode': mode
      });
      btn.textContent = labels[mode];
      views.appendChild(btn);
    });
    wrap.appendChild(views);

    var meta = el('div', 'wt-toolbar-meta');
    var count = this.getExerciseCount();
    meta.appendChild(el('span', 'wt-exercise-count', { text: count + (count === 1 ? ' lift' : ' lifts') }));
    wrap.appendChild(meta);
    return wrap;
  };

  Tracker.prototype._renderPreviousLine = function (name) {
    var prev = WS().getPreviousPerformance(name);
    if (!prev || !prev.length) return null;
    var line = el('p', 'wt-previous', { text: 'Previous: ' + prev.join(', ') });
    return line;
  };

  Tracker.prototype._renderSetRow = function (exercise, set, compact) {
    var S = WS();
    var row = el('div', 'wt-set-row' + (set.completed ? ' wt-set-row--done' : ''));
    row.appendChild(el('span', 'wt-set-label', { text: 'Set ' + set.setNumber }));

    var fields = el('div', 'wt-set-fields');
    var weightInp = el('input', 'wt-set-input wt-set-input--weight create-input', {
      type: 'number',
      inputmode: 'decimal',
      placeholder: weightPlaceholder(),
      'data-wt-field': 'set-weight',
      'data-exercise-id': exercise.id,
      'data-set-id': set.id,
      'aria-label': 'Weight for set ' + set.setNumber
    });
    if (set.weight != null) weightInp.value = String(set.weight);

    var times = el('span', 'wt-set-times', { text: '×' });

    var repsInp = el('input', 'wt-set-input wt-set-input--reps create-input', {
      type: 'number',
      inputmode: 'numeric',
      placeholder: 'reps',
      'data-wt-field': 'set-reps',
      'data-exercise-id': exercise.id,
      'data-set-id': set.id,
      'aria-label': 'Reps for set ' + set.setNumber
    });
    if (set.reps != null) repsInp.value = String(set.reps);

    fields.appendChild(weightInp);
    fields.appendChild(times);
    fields.appendChild(repsInp);
    row.appendChild(fields);

    var checkBtn = el('button', 'wt-set-check' + (set.completed ? ' wt-set-check--done' : ''), {
      type: 'button',
      'data-wt-action': 'toggle-set',
      'data-exercise-id': exercise.id,
      'data-set-id': set.id,
      'aria-label': set.completed ? 'Mark set incomplete' : 'Complete set',
      'aria-pressed': set.completed ? 'true' : 'false'
    });
    checkBtn.innerHTML = set.completed ? '&#10003;' : '&#9633;';
    row.appendChild(checkBtn);

    if (!compact) {
      var delBtn = el('button', 'wt-set-delete', {
        type: 'button',
        'data-wt-action': 'remove-set',
        'data-exercise-id': exercise.id,
        'data-set-id': set.id,
        'aria-label': 'Delete set'
      });
      delBtn.textContent = '×';
      row.appendChild(delBtn);
    }

    if (set.restSeconds != null && set.completed) {
      row.appendChild(el('span', 'wt-set-rest', { text: S.formatRest(set.restSeconds) }));
    }

    return row;
  };

  Tracker.prototype._renderCardView = function () {
    var self = this;
    var S = WS();
    var container = el('div', 'wt-view wt-view--card');
    var exercises = this._sortedExercises();

    if (!exercises.length) {
      container.appendChild(
        el('p', 'wt-empty', { text: 'No exercises yet — add a lift or load a plan from Rocky above.' })
      );
    }

    var currentGroupWrap = null;
    var currentGroupId = null;

    exercises.forEach(function (ex) {
      if (ex.supersetGroupId) {
        if (ex.supersetGroupId !== currentGroupId) {
          currentGroupWrap = el('div', 'wt-superset-block');
          currentGroupWrap.appendChild(
            el('span', 'wt-superset-badge', { text: 'Superset ' + ex.supersetGroupId })
          );
          container.appendChild(currentGroupWrap);
          currentGroupId = ex.supersetGroupId;
        }
      } else {
        currentGroupWrap = null;
        currentGroupId = null;
      }

      var card = el('article', 'wt-exercise-card logbook-card');
      card.setAttribute('data-exercise-id', ex.id);
      if (ex.supersetGroupId) card.classList.add('wt-exercise-card--superset');

      var head = el('header', 'wt-exercise-head');
      if (ex.supersetGroupId) {
        head.appendChild(el('span', 'wt-exercise-group-tag', { text: '[' + ex.supersetGroupId + ']' }));
      }
      var nameInp = el('input', 'wt-exercise-name create-input', {
        type: 'text',
        list: self._datalistId,
        placeholder: 'Exercise name',
        value: ex.name || '',
        'data-wt-field': 'exercise-name',
        'data-exercise-id': ex.id,
        'aria-label': 'Exercise name'
      });
      head.appendChild(nameInp);

      var actions = el('div', 'wt-exercise-actions');
      actions.appendChild(
        el('button', 'wt-icon-btn', {
          type: 'button',
          'data-wt-action': 'toggle-superset',
          'data-exercise-id': ex.id,
          title: 'Toggle superset group',
          'aria-label': 'Toggle superset group'
        })
      ).textContent = '⛓';
      actions.appendChild(
        el('button', 'wt-icon-btn wt-icon-btn--danger', {
          type: 'button',
          'data-wt-action': 'remove-exercise',
          'data-exercise-id': ex.id,
          'aria-label': 'Remove exercise'
        })
      ).textContent = '×';
      head.appendChild(actions);
      card.appendChild(head);

      var prevLine = self._renderPreviousLine(ex.name);
      if (prevLine) card.appendChild(prevLine);

      var setsWrap = el('div', 'wt-sets-list');
      ex.sets.forEach(function (set) {
        setsWrap.appendChild(self._renderSetRow(ex, set, false));
      });
      card.appendChild(setsWrap);

      card.appendChild(
        el('button', 'logbook-text-btn wt-add-set-btn', {
          type: 'button',
          'data-wt-action': 'add-set',
          'data-exercise-id': ex.id
        })
      ).textContent = '+ Add set';

      if (currentGroupWrap) currentGroupWrap.appendChild(card);
      else container.appendChild(card);
    });

    container.appendChild(
      el('button', 'logbook-text-btn wt-add-exercise-btn', {
        type: 'button',
        'data-wt-action': 'add-exercise'
      })
    ).textContent = '+ Add exercise';

    return container;
  };

  Tracker.prototype._renderSpreadsheetView = function () {
    var self = this;
    var table = el('div', 'wt-view wt-view--sheet');
    var head = el('div', 'wt-sheet-head');
    ['Exercise', 'Set #', 'Weight', 'Reps', 'Notes', ''].forEach(function (label) {
      head.appendChild(el('span', 'wt-sheet-cell wt-sheet-cell--head', { text: label }));
    });
    table.appendChild(head);

    var exercises = this._sortedExercises();
    if (!exercises.length) {
      table.appendChild(el('p', 'wt-empty wt-empty--sheet', { text: 'Add exercises in Card view or tap + Add exercise.' }));
    }

    exercises.forEach(function (ex) {
      ex.sets.forEach(function (set) {
        var row = el('div', 'wt-sheet-row' + (set.completed ? ' wt-sheet-row--done' : ''));
        if (ex.supersetGroupId) row.classList.add('wt-sheet-row--superset');

        var nameCell = el('div', 'wt-sheet-cell wt-sheet-cell--name');
        if (ex.supersetGroupId) {
          nameCell.appendChild(el('span', 'wt-exercise-group-tag', { text: '[' + ex.supersetGroupId + ']' }));
        }
        var nameInp = el('input', 'wt-sheet-input create-input', {
          type: 'text',
          list: self._datalistId,
          value: ex.name || '',
          'data-wt-field': 'exercise-name',
          'data-exercise-id': ex.id
        });
        nameCell.appendChild(nameInp);
        row.appendChild(nameCell);

        row.appendChild(el('span', 'wt-sheet-cell wt-sheet-cell--num', { text: String(set.setNumber) }));

        var wInp = el('input', 'wt-sheet-input create-input', {
          type: 'number',
          inputmode: 'decimal',
          'data-wt-field': 'set-weight',
          'data-exercise-id': ex.id,
          'data-set-id': set.id
        });
        if (set.weight != null) wInp.value = String(set.weight);
        var wCell = el('div', 'wt-sheet-cell');
        wCell.appendChild(wInp);
        row.appendChild(wCell);

        var rInp = el('input', 'wt-sheet-input create-input', {
          type: 'number',
          inputmode: 'numeric',
          'data-wt-field': 'set-reps',
          'data-exercise-id': ex.id,
          'data-set-id': set.id
        });
        if (set.reps != null) rInp.value = String(set.reps);
        var rCell = el('div', 'wt-sheet-cell');
        rCell.appendChild(rInp);
        row.appendChild(rCell);

        var nInp = el('input', 'wt-sheet-input create-input', {
          type: 'text',
          placeholder: 'Notes',
          'data-wt-field': 'set-notes',
          'data-exercise-id': ex.id,
          'data-set-id': set.id,
          value: set.notes || ''
        });
        var nCell = el('div', 'wt-sheet-cell');
        nCell.appendChild(nInp);
        row.appendChild(nCell);

        var actionCell = el('div', 'wt-sheet-cell wt-sheet-cell--action');
        var checkBtn = el('button', 'wt-set-check' + (set.completed ? ' wt-set-check--done' : ''), {
          type: 'button',
          'data-wt-action': 'toggle-set',
          'data-exercise-id': ex.id,
          'data-set-id': set.id
        });
        checkBtn.innerHTML = set.completed ? '&#10003;' : '&#9633;';
        actionCell.appendChild(checkBtn);
        row.appendChild(actionCell);

        table.appendChild(row);
      });
    });

    table.appendChild(
      el('button', 'logbook-text-btn wt-add-exercise-btn', {
        type: 'button',
        'data-wt-action': 'add-exercise'
      })
    ).textContent = '+ Add exercise';

    return table;
  };

  Tracker.prototype._renderTimelineView = function () {
    var S = WS();
    var wrap = el('div', 'wt-view wt-view--timeline');
    var events = S.completedSetsTimeline(this.session.exercises);

    if (!events.length) {
      wrap.appendChild(el('p', 'wt-empty', { text: 'Complete sets to see your workout timeline.' }));
      return wrap;
    }

    var lastTime = null;
    events.forEach(function (ev) {
      var item = el('article', 'wt-timeline-item');
      var timeStr = S.formatTime(ev.completedAt);
      item.appendChild(el('time', 'wt-timeline-time', { datetime: ev.completedAt, text: timeStr }));

      var body = el('div', 'wt-timeline-body');
      var title = ev.exerciseName || 'Exercise';
      if (ev.supersetGroupId) title = '[' + ev.supersetGroupId + '] ' + title;
      body.appendChild(el('h4', 'wt-timeline-exercise', { text: title }));
      body.appendChild(el('p', 'wt-timeline-set', { text: S.formatSetLine(ev.weight, ev.reps) }));

      if (lastTime) {
        var gapSec = Math.round((Date.parse(ev.completedAt) - Date.parse(lastTime)) / 1000);
        if (gapSec > 0) {
          body.appendChild(el('span', 'wt-timeline-gap', { text: S.formatRest(gapSec) + ' since last set' }));
        }
      }
      lastTime = ev.completedAt;

      item.appendChild(body);
      wrap.appendChild(item);
    });

    return wrap;
  };

  Tracker.prototype._renderMapView = function () {
    var self = this;
    var S = WS();
    var wrap = el('div', 'wt-view wt-view--map');
    var splitName =
      (document.getElementById('create-split') && document.getElementById('create-split').value.trim()) ||
      this.session.splitName ||
      'Workout';

    var root = el('div', 'wt-map-root');
    var rootLabel = el('button', 'wt-map-node wt-map-node--root', {
      type: 'button',
      'data-wt-action': 'noop'
    });
    rootLabel.textContent = splitName;
    root.appendChild(rootLabel);

    var tree = el('div', 'wt-map-tree');
    var exercises = this._sortedExercises();

    if (!exercises.length) {
      wrap.appendChild(el('p', 'wt-empty', { text: 'Add exercises to see the workout map.' }));
      return wrap;
    }

    exercises.forEach(function (ex) {
      var branch = el('div', 'wt-map-branch');
      var connector = el('div', 'wt-map-connector', { 'aria-hidden': 'true' });
      branch.appendChild(connector);

      var exNode = el('div', 'wt-map-exercise');
      var exBtn = el('button', 'wt-map-node wt-map-node--exercise' + (ex.collapsed ? ' wt-map-node--collapsed' : ''), {
        type: 'button',
        'data-wt-action': 'toggle-collapse',
        'data-exercise-id': ex.id,
        'aria-expanded': ex.collapsed ? 'false' : 'true'
      });
      var label = ex.name || 'Untitled exercise';
      if (ex.supersetGroupId) label = '[' + ex.supersetGroupId + '] ' + label;
      exBtn.textContent = label;
      exNode.appendChild(exBtn);

      if (!ex.collapsed) {
        var setsList = el('ul', 'wt-map-sets');
        ex.sets.forEach(function (set) {
          var li = el('li', 'wt-map-set' + (set.completed ? ' wt-map-set--done' : ''));
          var setBtn = el('button', 'wt-map-node wt-map-node--set', {
            type: 'button',
            'data-wt-action': 'toggle-set',
            'data-exercise-id': ex.id,
            'data-set-id': set.id
          });
          setBtn.textContent = 'Set ' + set.setNumber + ' · ' + S.formatSetLine(set.weight, set.reps);
          if (set.completed) setBtn.innerHTML += ' <span class="wt-map-check">✓</span>';
          li.appendChild(setBtn);
          setsList.appendChild(li);
        });
        exNode.appendChild(setsList);
      }

      branch.appendChild(exNode);
      tree.appendChild(branch);
    });

    root.appendChild(tree);
    wrap.appendChild(root);
    return wrap;
  };

  Tracker.prototype._renderFocusView = function () {
    var self = this;
    var S = WS();
    var wrap = el('div', 'wt-view wt-view--focus');
    var refs = this._allSetRefs();

    if (!refs.length) {
      wrap.appendChild(el('p', 'wt-empty', { text: 'Add exercises or load today\'s routine to start.' }));
      wrap.appendChild(
        el('button', 'logbook-text-btn wt-add-exercise-btn', {
          type: 'button',
          'data-wt-action': 'add-exercise'
        })
      ).textContent = '+ Add exercise';
      return wrap;
    }

    this._ensureFocusPointer();
    var fp = this.session.focusPointer;
    var current = refs.find(function (r) {
      return r.exercise.id === fp.exerciseId && r.set.id === fp.setId;
    });
    if (!current) current = refs[0];

    var ex = current.exercise;
    var set = current.set;
    var totalSets = refs.length;
    var currentIndex = refs.findIndex(function (r) {
      return r.exercise.id === ex.id && r.set.id === set.id;
    });

    var progress = el('p', 'wt-focus-progress', {
      text: 'Set ' + (currentIndex + 1) + ' of ' + totalSets
    });
    wrap.appendChild(progress);

    var head = el('header', 'wt-focus-head');
    if (ex.supersetGroupId) {
      head.appendChild(el('span', 'wt-exercise-group-tag', { text: '[' + ex.supersetGroupId + ']' }));
    }
    var nameInp = el('input', 'wt-focus-exercise-name create-input', {
      type: 'text',
      list: self._datalistId,
      placeholder: 'Exercise name',
      value: ex.name || '',
      'data-wt-field': 'exercise-name',
      'data-exercise-id': ex.id,
      'aria-label': 'Exercise name'
    });
    head.appendChild(nameInp);
    wrap.appendChild(head);

    var prevLine = self._renderPreviousLine(ex.name);
    if (prevLine) wrap.appendChild(prevLine);

    var fields = el('div', 'wt-focus-fields');
    var weightInp = el('input', 'wt-focus-input create-input', {
      type: 'number',
      inputmode: 'decimal',
      placeholder: 'Weight (' + weightPlaceholder() + ')',
      'data-wt-field': 'set-weight',
      'data-exercise-id': ex.id,
      'data-set-id': set.id,
      'aria-label': 'Weight'
    });
    if (set.weight != null) weightInp.value = String(set.weight);

    var repsInp = el('input', 'wt-focus-input create-input', {
      type: 'number',
      inputmode: 'numeric',
      placeholder: 'Reps',
      'data-wt-field': 'set-reps',
      'data-exercise-id': ex.id,
      'data-set-id': set.id,
      'aria-label': 'Reps'
    });
    if (set.reps != null) repsInp.value = String(set.reps);

    fields.appendChild(weightInp);
    fields.appendChild(repsInp);
    wrap.appendChild(fields);

    var canComplete = focusCanComplete(set);
    var completeBtn = el('button', 'wt-focus-save logbook-save-btn' + (canComplete ? '' : ' logbook-save-btn--blocked'), {
      type: 'button',
      'data-wt-action': 'focus-complete',
      'data-exercise-id': ex.id,
      'data-set-id': set.id,
      disabled: canComplete && !set.completed ? null : 'disabled',
      'aria-disabled': canComplete && !set.completed ? 'false' : 'true'
    });
    completeBtn.textContent = set.completed ? 'Set complete ✓' : 'Complete set';
    wrap.appendChild(completeBtn);

    var nav = el('div', 'wt-focus-nav');
    nav.appendChild(
      el('button', 'wt-focus-nav-btn', {
        type: 'button',
        'data-wt-action': 'focus-prev',
        disabled: currentIndex <= 0 ? 'disabled' : null
      })
    ).textContent = '← Prev';
    nav.appendChild(
      el('button', 'wt-focus-nav-btn', {
        type: 'button',
        'data-wt-action': 'focus-next',
        disabled: currentIndex >= refs.length - 1 ? 'disabled' : null
      })
    ).textContent = 'Next →';
    wrap.appendChild(nav);

    var tools = el('div', 'wt-focus-tools');
    tools.appendChild(
      el('button', 'logbook-text-btn wt-focus-tool-btn', {
        type: 'button',
        'data-wt-action': 'add-set',
        'data-exercise-id': ex.id
      })
    ).textContent = '+ Add set';
    tools.appendChild(
      el('button', 'logbook-text-btn wt-focus-tool-btn', {
        type: 'button',
        'data-wt-action': 'add-exercise'
      })
    ).textContent = '+ Add exercise';
    wrap.appendChild(tools);

    if (set.completed && set.restSeconds != null) {
      wrap.appendChild(el('p', 'wt-focus-rest', { text: S.formatRest(set.restSeconds) + ' since last set' }));
    }

    return wrap;
  };

  Tracker.prototype._renderBody = function () {
    var body = el('div', 'wt-body');
    if (this.session.viewMode === 'focus') body.appendChild(this._renderFocusView());
    else if (this.session.viewMode === 'spreadsheet') body.appendChild(this._renderSpreadsheetView());
    else if (this.session.viewMode === 'timeline') body.appendChild(this._renderTimelineView());
    else if (this.session.viewMode === 'map') body.appendChild(this._renderMapView());
    else body.appendChild(this._renderCardView());
    return body;
  };

  Tracker.prototype.render = function () {
    if (!this.root) return;
    this._flushDomToSession();
    this.root.innerHTML = '';
    this.root.className = 'workout-tracker';
    this.root.appendChild(this._renderToolbar());
    this.root.appendChild(this._renderBody());
  };

  var instance = null;

  function init(container, opts) {
    opts = opts || {};
    var root = typeof container === 'string' ? document.getElementById(container) : container;
    if (!root) return null;
    instance = new Tracker(root);
    if (typeof opts.onChange === 'function') instance.onChange = opts.onChange;
    if (typeof opts.onSetCompleted === 'function') instance.onSetCompleted = opts.onSetCompleted;
    return instance;
  }

  function getInstance() {
    return instance;
  }

  window.addEventListener('strongman:units-changed', function () {
    if (instance) instance.render();
  });

  window.WorkoutTracker = {
    init: init,
    getInstance: getInstance,
    VIEW_MODES: VIEW_MODES
  };
})();
