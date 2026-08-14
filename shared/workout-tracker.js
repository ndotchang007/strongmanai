(function () {
  'use strict';

  var WS = function () {
    return window.WorkoutSession;
  };

  var VIEW_MODES = ['focus', 'card', 'carousel', 'spreadsheet', 'timeline', 'map'];

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
    if (
      !this.isQuickLog() &&
      isMobileViewport() &&
      this.session.viewMode === 'card' &&
      !existing
    ) {
      this.session.viewMode = 'focus';
      S.saveSession(this.session);
    }
    this._syncLastCompleted();
    this._ensureFocusPointer();
  };

  Tracker.prototype.isQuickLog = function () {
    return !!(this.session && this.session.loggingMode === 'quick');
  };

  Tracker.prototype.setLoggingMode = function (mode) {
    var next = mode === 'quick' ? 'quick' : 'live';
    this._flushDomToSession();
    this.session.loggingMode = next;
    if (next === 'quick') {
      this.session.viewMode = 'card';
      // Quick log is post-hoc — clear live rest/completion UI state.
      (this.session.exercises || []).forEach(function (ex) {
        (ex.sets || []).forEach(function (set) {
          set.completed = false;
          set.completedAt = null;
          set.restSeconds = null;
        });
      });
      this.lastCompletedAt = null;
    }
    this._persist();
    this.render();
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
    var currentExId = fp.exerciseId;
    for (var i = idx + 1; i < refs.length; i++) {
      if (refs[i].exercise.id === currentExId && !refs[i].set.completed) {
        this.session.focusPointer = { exerciseId: refs[i].exercise.id, setId: refs[i].set.id };
        return;
      }
    }
    for (var j = idx + 1; j < refs.length; j++) {
      if (!refs[j].set.completed) {
        this.session.focusPointer = { exerciseId: refs[j].exercise.id, setId: refs[j].set.id };
        return;
      }
    }
    for (var k = 0; k < refs.length; k++) {
      if (!refs[k].set.completed) {
        this.session.focusPointer = { exerciseId: refs[k].exercise.id, setId: refs[k].set.id };
        return;
      }
    }
    if (refs.length) {
      this.session.focusPointer = { exerciseId: refs[refs.length - 1].exercise.id, setId: refs[refs.length - 1].set.id };
    }
  };

  Tracker.prototype._advanceToNextExercise = function () {
    var exercises = this._sortedExercises();
    var fp = this.session.focusPointer || {};
    var idx = exercises.findIndex(function (ex) {
      return ex.id === fp.exerciseId;
    });
    for (var i = idx + 1; i < exercises.length; i++) {
      var incomplete = (exercises[i].sets || []).find(function (s) {
        return !s.completed;
      });
      var targetSet = incomplete || (exercises[i].sets && exercises[i].sets[0]);
      if (targetSet) {
        this.session.focusPointer = { exerciseId: exercises[i].id, setId: targetSet.id };
        this._persist();
        this.render();
        return;
      }
    }
    this.openExercisePicker();
  };

  Tracker.prototype._currentExerciseSetRefs = function (exerciseId) {
    var refs = [];
    var ex = this._findExercise(exerciseId);
    if (!ex) return refs;
    (ex.sets || []).forEach(function (set) {
      refs.push({ exercise: ex, set: set });
    });
    return refs;
  };

  Tracker.prototype.setCarouselIndex = function (idx, opts) {
    opts = opts || {};
    var exercises = this._sortedExercises();
    if (!exercises.length) {
      this.session.carouselIndex = 0;
      return;
    }
    var next = Math.max(0, Math.min(exercises.length - 1, idx | 0));
    var prev = this.getCarouselIndex();
    if (next === prev) return;

    var self = this;
    var apply = function () {
      self.session.carouselIndex = next;
      self._persist();
      self.render();
    };

    if (opts.animate === false || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }
    if (this._carouselAnimating) return;

    var dir = opts.dir || (next > prev ? 'left' : 'right');
    this._swipeCarousel(dir, apply);
  };

  Tracker.prototype._swipeCarousel = function (dir, mutate) {
    var self = this;
    var view = this.root && this.root.querySelector('.wt-view--carousel');
    var track = view && view.querySelector('.wt-carousel-track');
    var run = function () {
      mutate(self);
      requestAnimationFrame(function () {
        var nextTrack = self.root && self.root.querySelector('.wt-carousel-track');
        if (!nextTrack) {
          self._carouselAnimating = false;
          return;
        }
        nextTrack.classList.add(
          dir === 'left' ? 'wt-carousel-in-from-right' : 'wt-carousel-in-from-left'
        );
        window.setTimeout(function () {
          nextTrack.classList.remove('wt-carousel-in-from-right', 'wt-carousel-in-from-left');
          self._carouselAnimating = false;
        }, 300);
      });
    };
    if (!track) {
      run();
      return;
    }
    this._carouselAnimating = true;
    track.classList.add(dir === 'left' ? 'wt-carousel-out-left' : 'wt-carousel-out-right');
    window.setTimeout(run, 180);
  };

  Tracker.prototype.getCarouselIndex = function () {
    var exercises = this._sortedExercises();
    var idx = this.session.carouselIndex | 0;
    if (!exercises.length) return 0;
    return Math.max(0, Math.min(exercises.length - 1, idx));
  };

  Tracker.prototype.setViewMode = function (mode) {
    if (VIEW_MODES.indexOf(mode) === -1) return;
    this._flushDomToSession();
    this.session.viewMode = mode;
    if (mode === 'focus') this._ensureFocusPointer();
    if (mode === 'carousel') this.session.carouselIndex = this.getCarouselIndex();
    this._persist();
    this.render();
  };

  Tracker.prototype.setWorkoutDate = function (dateStr) {
    this.session.workoutDate = dateStr || null;
    this._persist();
  };

  Tracker.prototype.addExercise = function (name, overrides) {
    var S = WS();
    var order = this.session.exercises.length;
    var displayName = name || '';
    var prev = displayName ? S.getPreviousPerformance(displayName) : null;
    var sets = [S.createSet({ setNumber: 1 })];
    var pred = null;
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
    } else if (displayName && window.WorkoutPredict) {
      pred = window.WorkoutPredict.predictLoad(displayName);
      var setCount = Math.max(1, pred.sets || 3);
      sets = [];
      for (var i = 0; i < setCount; i++) {
        sets.push(
          S.createSet({
            setNumber: i + 1,
            weight: pred.weight,
            reps: pred.reps,
          })
        );
      }
    }
    var opts = { order: order, sets: sets };
    if (overrides) {
      for (var k in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, k)) opts[k] = overrides[k];
      }
    }
    var exercise = S.createExercise(displayName, opts);
    if (pred) exercise._prediction = pred;
    if (!exercise.targetMuscles) {
      exercise.targetMuscles =
        (window.ExerciseDatabase &&
          typeof window.ExerciseDatabase.inferPrimaryMuscles === 'function' &&
          window.ExerciseDatabase.inferPrimaryMuscles(displayName)) ||
        '';
    }
    this.session.exercises.push(exercise);
    this.session.pickerState = null;
    this.session.focusPointer = {
      exerciseId: exercise.id,
      setId: exercise.sets[0] ? exercise.sets[0].id : null
    };
    this.session.carouselIndex = this.session.exercises.length - 1;
    this._persist();
    this.render();
    return exercise;
  };

  Tracker.prototype.openExercisePicker = function () {
    this._flushDomToSession();
    this.session.pickerState = { step: 'movement', movement: null, query: '' };
    this._persist();
    this.render();
  };

  Tracker.prototype.cancelExercisePicker = function () {
    this.session.pickerState = null;
    this._persist();
    this.render();
  };

  Tracker.prototype.selectPickerMovement = function (movementName) {
    if (!movementName) return;
    this.session.pickerState = {
      step: 'variant',
      movement: movementName,
      query: (this.session.pickerState && this.session.pickerState.query) || ''
    };
    this._persist();
    this.render();
  };

  Tracker.prototype.selectPickerVariant = function (variantId) {
    var state = this.session.pickerState;
    if (!state || !state.movement) return;
    var ED = window.ExerciseDatabase;
    var name =
      ED && typeof ED.formatExerciseName === 'function'
        ? ED.formatExerciseName(state.movement, variantId)
        : state.movement;
    this.addExercise(name, {
      movement: state.movement,
      variantId: variantId || null
    });
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
    if (this.isQuickLog()) return false;
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
    if (this.isQuickLog()) return;
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
    if (window.WorkoutPredict && window.WorkoutPredict.predictLoad) {
      this.session.exercises.forEach(function (ex) {
        if (!ex || !ex.name) return;
        var needsFill = !(ex.sets || []).some(function (s) {
          return s && s.weight != null;
        });
        if (!needsFill) return;
        var pred = window.WorkoutPredict.predictLoad(ex.name);
        ex._prediction = pred;
        (ex.sets || []).forEach(function (set) {
          if (set.weight == null) set.weight = pred.weight;
          if (set.reps == null) set.reps = pred.reps;
        });
      });
    }
    this._persist();
    this.render();
  };

  Tracker.prototype.loadFromTrackerExercises = function (exercises) {
    this.session.exercises = WS().clone(exercises || []);
    this._syncLastCompleted();
    this._ensureFocusPointer();
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

    var sideCard = t.closest('.wt-carousel-card--prev, .wt-carousel-card--next');
    if (sideCard && !t.closest('[data-wt-action]')) {
      var role = sideCard.getAttribute('data-carousel-role');
      this._flushDomToSession();
      var idx = this.getCarouselIndex();
      if (role === 'prev') this.setCarouselIndex(idx - 1, { dir: 'right' });
      else if (role === 'next') this.setCarouselIndex(idx + 1, { dir: 'left' });
      return;
    }

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
      if (
        this.session.viewMode === 'focus' ||
        this.session.viewMode === 'carousel' ||
        isWorkoutDashboardOpen()
      ) {
        this.openExercisePicker();
      } else {
        this.openExercisePicker();
      }
      return;
    }
    if (action === 'pick-suggested-exercise') {
      var suggested = btn.getAttribute('data-exercise-name');
      if (suggested) this.addExercise(suggested);
      return;
    }
    if (action === 'bump-weight-up' && exId && setId) {
      var exUp = this._findExercise(exId);
      var stepUp = this._weightStep(exUp);
      if (stepUp <= 0) return;
      this._bumpSetValue(exId, setId, 'weight', stepUp);
      return;
    }
    if (action === 'bump-weight-down' && exId && setId) {
      var exDown = this._findExercise(exId);
      var stepDown = this._weightStep(exDown);
      if (stepDown <= 0) return;
      this._bumpSetValue(exId, setId, 'weight', -stepDown);
      return;
    }
    if (action === 'bump-reps-up' && exId && setId) {
      this._bumpSetValue(exId, setId, 'reps', 1);
      return;
    }
    if (action === 'bump-reps-down' && exId && setId) {
      this._bumpSetValue(exId, setId, 'reps', -1);
      return;
    }
    if (action === 'toggle-muscle-edit' && exId) {
      var muscleEx = this._findExercise(exId);
      if (muscleEx) {
        if (muscleEx._editingMuscles) {
          var muscleInp = this.root.querySelector(
            '[data-wt-field="target-muscles"][data-exercise-id="' + exId + '"]'
          );
          if (muscleInp) muscleEx.targetMuscles = muscleInp.value.trim();
          muscleEx._editingMuscles = false;
        } else {
          muscleEx._editingMuscles = true;
        }
        this._persist();
        this.render();
      }
      return;
    }
    if (action === 'picker-cancel') {
      this.cancelExercisePicker();
      return;
    }
    if (action === 'picker-back') {
      if (this.session.pickerState) {
        this.session.pickerState.step = 'movement';
        this.session.pickerState.movement = null;
        this._persist();
        this.render();
      }
      return;
    }
    if (action === 'picker-pick-movement') {
      var moveName = btn.getAttribute('data-movement');
      this.selectPickerMovement(moveName);
      return;
    }
    if (action === 'picker-form-tip') {
      var tipName = btn.getAttribute('data-movement');
      this._showFormTip(tipName);
      return;
    }
    if (action === 'picker-pick-variant') {
      var variantId = btn.getAttribute('data-variant');
      this.selectPickerVariant(variantId);
      return;
    }
    if (action === 'focus-next-exercise') {
      this._flushDomToSession();
      this._swipeFocus('left', function (self) {
        self._advanceToNextExercise();
      });
      return;
    }
    if (action === 'focus-next-set' || action === 'focus-complete') {
      this._goNextSet();
      return;
    }
    if (action === 'carousel-prev') {
      this._flushDomToSession();
      this.setCarouselIndex(this.getCarouselIndex() - 1, { dir: 'right' });
      return;
    }
    if (action === 'carousel-next') {
      this._flushDomToSession();
      this.setCarouselIndex(this.getCarouselIndex() + 1, { dir: 'left' });
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
      var fp = this.session.focusPointer || {};
      var refs = this._currentExerciseSetRefs(fp.exerciseId);
      var cur = refs.findIndex(function (r) {
        return r.set.id === fp.setId;
      });
      if (cur > 0) {
        this._swipeFocus('right', function (self) {
          self.session.focusPointer = {
            exerciseId: refs[cur - 1].exercise.id,
            setId: refs[cur - 1].set.id,
          };
          self._persist();
          self.render();
        });
      }
      return;
    }
    if (action === 'focus-next' || action === 'focus-next-set') {
      this._goNextSet();
      return;
    }
  };

  Tracker.prototype._swipeFocus = function (dir, mutate) {
    var self = this;
    var view = this.root && this.root.querySelector('.wt-view--focus');
    var run = function () {
      mutate(self);
      requestAnimationFrame(function () {
        var next = self.root && self.root.querySelector('.wt-view--focus');
        if (!next) return;
        next.classList.add(dir === 'left' ? 'wt-swipe-in-from-right' : 'wt-swipe-in-from-left');
        window.setTimeout(function () {
          next.classList.remove('wt-swipe-in-from-right', 'wt-swipe-in-from-left');
        }, 280);
      });
    };
    if (!view || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      run();
      return;
    }
    view.classList.add(dir === 'left' ? 'wt-swipe-out-left' : 'wt-swipe-out-right');
    window.setTimeout(run, 180);
  };

  Tracker.prototype._ensureExtraSet = function (exerciseId) {
    var S = WS();
    var ex = this._findExercise(exerciseId);
    if (!ex) return null;
    var n = (ex.sets || []).length + 1;
    var last = ex.sets && ex.sets.length ? ex.sets[ex.sets.length - 1] : null;
    var set = S.createSet({
      setNumber: n,
      weight: last && last.weight != null ? last.weight : null,
      reps: last && last.reps != null ? last.reps : null,
    });
    ex.sets.push(set);
    return set;
  };

  Tracker.prototype._goNextSet = function () {
    var self = this;
    this._flushDomToSession();
    var fp = this.session.focusPointer || {};
    var found = this._findSet(fp.exerciseId, fp.setId);
    if (!found) return;
    var set = found.set;

    this._swipeFocus('left', function () {
      if (!set.completed && set.weight != null && set.reps != null) {
        var now = new Date().toISOString();
        set.completed = true;
        set.completedAt = now;
        self.lastCompletedAt = now;
        if (typeof self.onSetCompleted === 'function') {
          self.onSetCompleted(found.exercise.id, set.id);
        }
      }

      // Re-read refs after possible mutation
      var liveRefs = self._currentExerciseSetRefs(found.exercise.id);
      var liveIdx = liveRefs.findIndex(function (r) {
        return r.set.id === set.id;
      });
      if (liveIdx >= 0 && liveIdx < liveRefs.length - 1) {
        self.session.focusPointer = {
          exerciseId: liveRefs[liveIdx + 1].exercise.id,
          setId: liveRefs[liveIdx + 1].set.id,
        };
      } else {
        var extra = self._ensureExtraSet(found.exercise.id);
        if (extra) {
          self.session.focusPointer = {
            exerciseId: found.exercise.id,
            setId: extra.id,
          };
        }
      }
      self._persist();
      self.render();
    });
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
    if (field === 'target-muscles' && exId) {
      var muscleEx = this._findExercise(exId);
      if (muscleEx) muscleEx.targetMuscles = t.value;
      this._persist();
      return;
    }
    if (field === 'picker-query') {
      if (!this.session.pickerState) this.session.pickerState = { step: 'movement', movement: null, query: '' };
      this.session.pickerState.query = t.value || '';
      this._persist();
      this.render();
      var q = this.root.querySelector('[data-wt-field="picker-query"]');
      if (q) {
        q.focus();
        try {
          q.setSelectionRange(q.value.length, q.value.length);
        } catch (err) {}
      }
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
    // Focus view uses always-on Next set / Next exercise — nothing to gate.
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
    var meta = el('div', 'wt-toolbar-meta');
    var count = this.getExerciseCount();
    meta.appendChild(el('span', 'wt-exercise-count', { text: count + (count === 1 ? ' lift' : ' lifts') }));
    if (this.isQuickLog()) {
      meta.appendChild(el('span', 'wt-quick-badge', { text: 'Quick log' }));
    }

    // Workout mode: one-exercise focus only — hide view switcher clutter
    if (isWorkoutDashboardOpen() || this.isQuickLog()) {
      wrap.appendChild(meta);
      return wrap;
    }

    var views = el('nav', 'wt-view-tabs', { role: 'tablist', 'aria-label': 'Workout view' });
    var labels = { focus: 'Focus', card: 'Cards', spreadsheet: 'Sheet', timeline: 'Timeline', map: 'Map' };
    var modes = VIEW_MODES.slice();
    if (!isMobileViewport()) {
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
    wrap.appendChild(meta);
    return wrap;
  };

  Tracker.prototype._renderPreviousLine = function (name) {
    var prev = WS().getPreviousPerformance(name);
    if (!prev || !prev.length) return null;
    var line = el('p', 'wt-previous', { text: 'Previous: ' + prev.join(', ') });
    return line;
  };

  Tracker.prototype._weightStep = function (exercise) {
    var name = exercise && exercise.name ? exercise.name : '';
    var variantId = exercise && exercise.variantId ? exercise.variantId : null;
    if (window.ExerciseDatabase && typeof window.ExerciseDatabase.getMinIncrement === 'function') {
      var step = window.ExerciseDatabase.getMinIncrement({ name: name, variantId: variantId });
      if (step > 0) return step;
    }
    if (window.Units && typeof window.Units.getUnits === 'function') {
      return window.Units.getUnits() === 'metric' ? 2.5 : 5;
    }
    return 5;
  };

  Tracker.prototype._renderStepper = function (opts) {
    var wrap = el('div', 'wt-stepper');
    wrap.appendChild(
      el('button', 'wt-stepper-btn', {
        type: 'button',
        'data-wt-action': opts.downAction,
        'data-exercise-id': opts.exerciseId,
        'data-set-id': opts.setId,
        'aria-label': opts.downLabel,
        text: '−',
      })
    );
    wrap.appendChild(
      el('span', 'wt-stepper-value', {
        'data-wt-display': opts.display,
        'data-exercise-id': opts.exerciseId,
        'data-set-id': opts.setId,
        text: opts.valueText,
      })
    );
    wrap.appendChild(
      el('button', 'wt-stepper-btn', {
        type: 'button',
        'data-wt-action': opts.upAction,
        'data-exercise-id': opts.exerciseId,
        'data-set-id': opts.setId,
        'aria-label': opts.upLabel,
        text: '+',
      })
    );
    return wrap;
  };

  Tracker.prototype._renderSetRow = function (exercise, set, compact) {
    var quick = this.isQuickLog();
    var unit = weightPlaceholder();
    var row = el(
      'div',
      'wt-set-row' + (!quick && set.completed ? ' wt-set-row--done' : '') + (quick ? ' wt-set-row--quick' : '')
    );

    if (!quick && set.setNumber > 3 && !set.completed) {
      row.appendChild(
        el('p', 'wt-volume-warning', {
          text:
            "Woah there champ, you're doing too much. Ideally, you'll hit failure to 2 reps in reserve in 3 sets — skip the volume of sets, maximize the quality of sets.",
        })
      );
    }

    row.appendChild(el('span', 'wt-set-label', { text: 'Set ' + set.setNumber }));

    var fields = el('div', 'wt-set-fields wt-set-fields--steppers');
    fields.appendChild(
      this._renderStepper({
        exerciseId: exercise.id,
        setId: set.id,
        downAction: 'bump-weight-down',
        upAction: 'bump-weight-up',
        downLabel: 'Decrease weight',
        upLabel: 'Increase weight',
        display: 'weight',
        valueText: set.weight != null ? String(set.weight) + ' ' + unit : '— ' + unit,
      })
    );
    fields.appendChild(el('span', 'wt-set-times', { text: '×' }));
    fields.appendChild(
      this._renderStepper({
        exerciseId: exercise.id,
        setId: set.id,
        downAction: 'bump-reps-down',
        upAction: 'bump-reps-up',
        downLabel: 'Decrease reps',
        upLabel: 'Increase reps',
        display: 'reps',
        valueText: set.reps != null ? String(set.reps) : '—',
      })
    );
    row.appendChild(fields);

    if (!quick) {
      var checkBtn = el('button', 'wt-set-check' + (set.completed ? ' wt-set-check--done' : ''), {
        type: 'button',
        'data-wt-action': 'toggle-set',
        'data-exercise-id': exercise.id,
        'data-set-id': set.id,
        'aria-label': set.completed ? 'Mark set incomplete' : 'Complete set',
        'aria-pressed': set.completed ? 'true' : 'false',
      });
      checkBtn.innerHTML = set.completed ? '&#10003;' : '&#9633;';
      row.appendChild(checkBtn);
    }

    if (!compact) {
      var delBtn = el('button', 'wt-set-delete', {
        type: 'button',
        'data-wt-action': 'remove-set',
        'data-exercise-id': exercise.id,
        'data-set-id': set.id,
        'aria-label': 'Delete set',
      });
      delBtn.textContent = '×';
      row.appendChild(delBtn);
    }

    return row;
  };

  Tracker.prototype._bumpSetValue = function (exId, setId, field, delta) {
    var found = this._findSet(exId, setId);
    if (!found) return;
    var cur = found.set[field];
    if (cur == null || cur === '') cur = field === 'weight' ? 0 : 0;
    var next = Number(cur) + delta;
    if (field === 'reps') next = Math.max(0, Math.round(next));
    if (field === 'weight') {
      next = Math.max(0, next);
      var step = Math.abs(Number(delta)) || this._weightStep(found.exercise);
      if (window.WorkoutPredict && typeof window.WorkoutPredict.roundToGymWeight === 'function') {
        var metric =
          window.Units && window.Units.getUnits && window.Units.getUnits() === 'metric';
        next = window.WorkoutPredict.roundToGymWeight(next, metric, step);
      } else {
        next = Math.round(next / step) * step;
      }
    }
    found.set[field] = next;
    this._persist();
    this.render();
  };

  Tracker.prototype._renderExerciseSuggestions = function () {
    var wrap = el('div', 'wt-suggest');
    wrap.appendChild(el('p', 'wt-suggest-label', { text: 'Add next exercise' }));
    var list = el('div', 'wt-suggest-list', { role: 'group', 'aria-label': 'Suggested exercises' });
    var existing = {};
    (this.session.exercises || []).forEach(function (ex) {
      existing[String(ex.name || '')
        .trim()
        .toLowerCase()] = true;
    });
    var suggestions =
      window.WorkoutPredict && window.WorkoutPredict.predictExercises
        ? window.WorkoutPredict.predictExercises()
        : [];
    suggestions.forEach(function (s) {
      var key = String(s.name || '')
        .trim()
        .toLowerCase();
      if (existing[key]) return;
      list.appendChild(
        el('button', 'wt-suggest-btn', {
          type: 'button',
          'data-wt-action': 'pick-suggested-exercise',
          'data-exercise-name': s.name,
          text: s.name,
        })
      );
    });
    wrap.appendChild(list);
    wrap.appendChild(
      el('button', 'wt-suggest-other', {
        type: 'button',
        'data-wt-action': 'add-exercise',
        text: 'Something different…',
      })
    );
    return wrap;
  };

  Tracker.prototype._renderMuscleLine = function (ex) {
    var row = el('div', 'wt-muscle-row');
    var editing = !!ex._editingMuscles;
    if (editing) {
      var inp = el('input', 'wt-muscle-input create-input', {
        type: 'text',
        'data-wt-field': 'target-muscles',
        'data-exercise-id': ex.id,
        'aria-label': 'Target muscles',
        placeholder: 'e.g. chest, triceps',
      });
      inp.value = ex.targetMuscles || '';
      row.appendChild(inp);
      row.appendChild(
        el('button', 'wt-muscle-done', {
          type: 'button',
          'data-wt-action': 'toggle-muscle-edit',
          'data-exercise-id': ex.id,
          text: 'Done',
        })
      );
    } else {
      var label = el('span', 'wt-muscle-text', {
        text: ex.targetMuscles ? ex.targetMuscles : 'Muscles',
      });
      row.appendChild(label);
      row.appendChild(
        el('button', 'wt-muscle-edit', {
          type: 'button',
          'data-wt-action': 'toggle-muscle-edit',
          'data-exercise-id': ex.id,
          'aria-label': 'Edit target muscles',
          html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>',
        })
      );
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

  Tracker.prototype._prescriptionForExercise = function (ex) {
    if (!ex || !ex.sets || !ex.sets.length) return '';
    var weights = [];
    var reps = [];
    ex.sets.forEach(function (s) {
      if (s.weight != null) weights.push(s.weight);
      if (s.reps != null) reps.push(s.reps);
    });
    var setCount = ex.sets.length;
    var repVal = reps.length ? (reps.every(function (r) { return r === reps[0]; }) ? reps[0] : reps[0]) : null;
    var weightVal = weights.length
      ? weights.every(function (w) { return w === weights[0]; })
        ? weights[0]
        : weights[0]
      : null;
    var unit = weightPlaceholder();
    if (repVal != null && weightVal != null) {
      return 'Do ' + setCount + '×' + repVal + ' @ ' + weightVal + ' ' + unit;
    }
    if (repVal != null) return 'Do ' + setCount + '×' + repVal;
    if (weightVal != null) return 'Suggested load: ' + weightVal + ' ' + unit;
    return 'Log weight & reps, then complete each set';
  };

  Tracker.prototype._renderCarouselCard = function (ex, role) {
    var self = this;
    var card = el(
      'article',
      'wt-carousel-card wt-carousel-card--' + role + (role === 'current' ? ' wt-exercise-card' : '')
    );
    card.setAttribute('data-exercise-id', ex.id);
    card.setAttribute('data-carousel-role', role);

    var head = el('header', 'wt-carousel-card-head');
    head.appendChild(el('h3', 'wt-carousel-card-title', { text: ex.name || 'Untitled' }));
    if (role === 'current') {
      var rx = self._prescriptionForExercise(ex);
      if (rx) head.appendChild(el('p', 'wt-carousel-rx', { text: rx }));
    }
    card.appendChild(head);

    if (role === 'current') {
      card.appendChild(self._renderMuscleLine(ex));
      var prevLine = self._renderPreviousLine(ex.name);
      if (prevLine) card.appendChild(prevLine);
      if (ex._prediction && ex._prediction.note) {
        card.appendChild(
          el('p', 'wt-prediction-note', { text: ex._prediction.note })
        );
      }

      var setsWrap = el('div', 'wt-sets-list');
      ex.sets.forEach(function (set) {
        setsWrap.appendChild(self._renderSetRow(ex, set, false));
      });
      card.appendChild(setsWrap);

      var tools = el('div', 'wt-carousel-card-tools');
      tools.appendChild(
        el('button', 'logbook-text-btn wt-add-set-btn', {
          type: 'button',
          'data-wt-action': 'add-set',
          'data-exercise-id': ex.id,
          text: '+ Add set',
        })
      );
      var allDone = (ex.sets || []).length && (ex.sets || []).every(function (s) {
        return s.completed;
      });
      if (allDone) {
        card.appendChild(self._renderExerciseSuggestions());
      }
      card.appendChild(tools);
    } else {
      var done = (ex.sets || []).filter(function (s) { return s.completed; }).length;
      var total = (ex.sets || []).length;
      card.appendChild(
        el('p', 'wt-carousel-card-meta', {
          text: done + ' / ' + total + ' sets'
        })
      );
    }

    return card;
  };

  Tracker.prototype._bindCarouselGestures = function (track) {
    var self = this;
    var startX = 0;
    var startY = 0;
    var tracking = false;
    var animating = false;

    track.addEventListener(
      'touchstart',
      function (e) {
        if (!e.touches || !e.touches.length || animating) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
      },
      { passive: true }
    );

    track.addEventListener(
      'touchend',
      function (e) {
        if (!tracking || animating) return;
        tracking = false;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - startX;
        var dy = Math.abs(t.clientY - startY);
        if (Math.abs(dx) < 50 || dy > Math.abs(dx)) return;
        self._flushDomToSession();
        var idx = self.getCarouselIndex();
        animating = true;
        if (dx < 0) self.setCarouselIndex(idx + 1, { dir: 'left' });
        else self.setCarouselIndex(idx - 1, { dir: 'right' });
        window.setTimeout(function () {
          animating = false;
        }, 360);
      },
      { passive: true }
    );
  };

  Tracker.prototype._renderCarouselView = function () {
    var self = this;
    var wrap = el('div', 'wt-view wt-view--carousel');
    var exercises = this._sortedExercises();

    if (!exercises.length) {
      if (this.session.pickerState && this.session.pickerState.step) {
        return this._renderFocusPicker();
      }
      wrap.appendChild(el('p', 'wt-empty', { text: 'Pick a lift to start logging.' }));
      wrap.appendChild(this._renderExerciseSuggestions());
      return wrap;
    }

    var idx = this.getCarouselIndex();
    wrap.appendChild(
      el('p', 'wt-focus-progress', {
        text: 'Exercise ' + (idx + 1) + ' of ' + exercises.length
      })
    );

    var stage = el('div', 'wt-carousel-stage');
    var track = el('div', 'wt-carousel-track');

    if (idx > 0) {
      track.appendChild(this._renderCarouselCard(exercises[idx - 1], 'prev'));
    } else {
      track.appendChild(el('div', 'wt-carousel-card wt-carousel-card--spacer'));
    }
    track.appendChild(this._renderCarouselCard(exercises[idx], 'current'));
    if (idx < exercises.length - 1) {
      track.appendChild(this._renderCarouselCard(exercises[idx + 1], 'next'));
    } else {
      track.appendChild(el('div', 'wt-carousel-card wt-carousel-card--spacer'));
    }

    stage.appendChild(track);
    wrap.appendChild(stage);

    var nav = el('div', 'wt-carousel-nav');
    nav.appendChild(
      el('button', 'wt-focus-nav-btn', {
        type: 'button',
        'data-wt-action': 'carousel-prev',
        disabled: idx <= 0 ? 'disabled' : null
      })
    ).textContent = '← Prev';
    nav.appendChild(
      el('button', 'wt-focus-nav-btn', {
        type: 'button',
        'data-wt-action': 'carousel-next',
        disabled: idx >= exercises.length - 1 ? 'disabled' : null
      })
    ).textContent = 'Next →';
    wrap.appendChild(nav);

    wrap.appendChild(this._renderExerciseSuggestions());

    // Bind swipe after next paint so the node is live
    window.setTimeout(function () {
      if (!track.isConnected) return;
      if (track.dataset.gesturesBound === '1') return;
      track.dataset.gesturesBound = '1';
      self._bindCarouselGestures(track);
    }, 0);

    return wrap;
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
          step: window.Units && window.Units.getWeightStep ? String(window.Units.getWeightStep()) : '0.5',
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

        if (!self.isQuickLog()) {
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
        }

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

  Tracker.prototype._renderFocusPicker = function () {
    var ED = window.ExerciseDatabase;
    var state = this.session.pickerState || { step: 'movement', movement: null, query: '' };
    if (!this.session.pickerState) {
      // Persist so subsequent interactions stay on the picker
      this.session.pickerState = state;
    }
    var wrap = el('div', 'wt-view wt-view--focus wt-view--picker');
    var hasExercises = this._sortedExercises().length > 0;

    var head = el('header', 'wt-picker-head');
    head.appendChild(
      el('p', 'wt-focus-progress', {
        text: state.step === 'variant' ? 'Choose equipment' : 'Choose exercise'
      })
    );
    if (state.step === 'variant' && state.movement) {
      head.appendChild(el('h2', 'wt-picker-title', { text: state.movement }));
      head.appendChild(el('p', 'wt-picker-sub', { text: 'Barbell, dumbbell, single arm, and more' }));
    } else {
      head.appendChild(el('h2', 'wt-picker-title', { text: 'What are you training?' }));
      head.appendChild(el('p', 'wt-picker-sub', { text: 'Pick a movement, then choose how you load it' }));
    }
    wrap.appendChild(head);

    if (state.step === 'movement') {
      var search = el('input', 'wt-focus-input create-input wt-picker-search', {
        type: 'search',
        placeholder: 'Search exercises…',
        value: state.query || '',
        'data-wt-field': 'picker-query',
        'aria-label': 'Search exercises'
      });
      wrap.appendChild(search);

      var list = el('div', 'wt-picker-list', { role: 'listbox', 'aria-label': 'Exercises' });
      var movements =
        ED && typeof ED.listMovements === 'function'
          ? ED.listMovements({ q: state.query, limit: 24 })
          : [];
      if (!movements.length && ED && ED.quickPicks) {
        movements = (ED.quickPicks || []).map(function (name) {
          return { name: name };
        });
      }
      if (window.WorkoutPredict && window.WorkoutPredict.exerciseAllowedForEquipment) {
        movements = movements.filter(function (m) {
          return window.WorkoutPredict.exerciseAllowedForEquipment(m.name);
        });
      }
      if (!movements.length) {
        list.appendChild(
          el('p', 'wt-empty', {
            text: 'No matches for your equipment — try another search or update gear.',
          })
        );
      } else {
        movements.forEach(function (m) {
          var row = el('div', 'wt-picker-row');
          var btn = el('button', 'wt-picker-option', {
            type: 'button',
            role: 'option',
            'data-wt-action': 'picker-pick-movement',
            'data-movement': m.name,
            text: m.name,
          });
          var tipBtn = el('button', 'wt-picker-tip-btn', {
            type: 'button',
            'data-wt-action': 'picker-form-tip',
            'data-movement': m.name,
            'aria-label': 'Form tips for ' + m.name,
            title: 'Form tips',
          });
          tipBtn.textContent = '?';
          row.appendChild(btn);
          row.appendChild(tipBtn);
          list.appendChild(row);
        });
      }
      wrap.appendChild(list);
    } else {
      var variants =
        ED && typeof ED.variantsForMovement === 'function'
          ? ED.variantsForMovement(state.movement)
          : [];
      var vList = el('div', 'wt-picker-list wt-picker-list--variants', { role: 'listbox', 'aria-label': 'Equipment variants' });
      variants.forEach(function (v) {
        var btn = el('button', 'wt-picker-option wt-picker-option--variant', {
          type: 'button',
          role: 'option',
          'data-wt-action': 'picker-pick-variant',
          'data-variant': v.id
        });
        btn.textContent = v.label;
        vList.appendChild(btn);
      });
      wrap.appendChild(vList);
    }

    var tools = el('div', 'wt-focus-tools');
    if (state.step === 'variant') {
      tools.appendChild(
        el('button', 'logbook-text-btn wt-focus-tool-btn', {
          type: 'button',
          'data-wt-action': 'picker-back'
        })
      ).textContent = '← Back';
    }
    if (hasExercises) {
      tools.appendChild(
        el('button', 'logbook-text-btn wt-focus-tool-btn', {
          type: 'button',
          'data-wt-action': 'picker-cancel'
        })
      ).textContent = 'Cancel';
    }
    wrap.appendChild(tools);
    return wrap;
  };

  Tracker.prototype._showFormTip = function (movementName) {
    var ED = window.ExerciseDatabase;
    var tip =
      ED && typeof ED.getFormTips === 'function'
        ? ED.getFormTips(movementName)
        : 'Brace, control the eccentric, and keep tension on the target muscles.';
    var existing = document.getElementById('wt-form-tip-dialog');
    if (existing) existing.remove();

    var backdrop = el('div', 'wt-form-tip-backdrop', { id: 'wt-form-tip-dialog' });
    var dialog = el('div', 'wt-form-tip-dialog', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'wt-form-tip-title',
    });
    dialog.appendChild(
      el('h3', 'wt-form-tip-title', { id: 'wt-form-tip-title', text: (movementName || 'Exercise') + ' — form tips' })
    );
    dialog.appendChild(el('p', 'wt-form-tip-body', { text: tip }));
    var close = el('button', 'wt-form-tip-close', { type: 'button', text: 'Got it' });
    dialog.appendChild(close);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function dismiss() {
      backdrop.remove();
    }
    close.addEventListener('click', dismiss);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) dismiss();
    });
  };

  Tracker.prototype._renderFocusView = function () {
    var self = this;
    var S = WS();

    if (this.session.pickerState && this.session.pickerState.step) {
      return this._renderFocusPicker();
    }

    var wrap = el('div', 'wt-view wt-view--focus');
    var exercises = this._sortedExercises();

    if (!exercises.length) {
      return this._renderFocusPicker();
    }

    this._ensureFocusPointer();
    var fp = this.session.focusPointer;
    var ex = this._findExercise(fp.exerciseId) || exercises[0];
    var exSets = this._currentExerciseSetRefs(ex.id);
    if (!exSets.length) {
      return this._renderFocusPicker();
    }
    var currentRef =
      exSets.find(function (r) {
        return r.set.id === fp.setId;
      }) ||
      exSets.find(function (r) {
        return !r.set.completed;
      }) ||
      exSets[0];
    var set = currentRef.set;

    var exIndex = exercises.findIndex(function (e) {
      return e.id === ex.id;
    });
    var setIndex = exSets.findIndex(function (r) {
      return r.set.id === set.id;
    });
    var allSetsDone = exSets.every(function (r) {
      return r.set.completed;
    });

    wrap.appendChild(
      el('p', 'wt-focus-progress', {
        text:
          'Exercise ' +
          (exIndex + 1) +
          ' of ' +
          exercises.length +
          ' · Set ' +
          (setIndex + 1) +
          ' of ' +
          exSets.length
      })
    );

    var head = el('header', 'wt-focus-head');
    if (ex.supersetGroupId) {
      head.appendChild(el('span', 'wt-exercise-group-tag', { text: '[' + ex.supersetGroupId + ']' }));
    }
    head.appendChild(
      el('h2', 'wt-focus-exercise', {
        text: ex.name || 'Untitled exercise'
      })
    );
    if (ex.variantId && window.ExerciseDatabase && window.ExerciseDatabase.variantById) {
      var vMeta = window.ExerciseDatabase.variantById(ex.variantId);
      if (vMeta) {
        head.appendChild(el('span', 'wt-focus-variant-chip', { text: vMeta.label }));
      }
    }
    wrap.appendChild(head);
    wrap.appendChild(
      el('p', 'wt-focus-set-hero', {
        text: 'Set ' + (set.setNumber || setIndex + 1),
      })
    );

    var prevLine = self._renderPreviousLine(ex.name);
    if (prevLine) wrap.appendChild(prevLine);

    var wStep = self._weightStep(ex);
    var unit = weightPlaceholder();
    var repsText = set.reps != null ? String(set.reps) : '—';
    var weightText = set.weight != null ? String(set.weight) : '—';
    var statement = el('div', 'wt-focus-rx');
    var repsCluster = el('div', 'wt-focus-rx-cluster');
    repsCluster.appendChild(
      el('button', 'wt-focus-rx-btn', {
        type: 'button',
        'data-wt-action': 'bump-reps-down',
        'data-exercise-id': ex.id,
        'data-set-id': set.id,
        'aria-label': 'Decrease reps',
        text: '−',
      })
    );
    repsCluster.appendChild(
      el('button', 'wt-focus-rx-btn', {
        type: 'button',
        'data-wt-action': 'bump-reps-up',
        'data-exercise-id': ex.id,
        'data-set-id': set.id,
        'aria-label': 'Increase reps',
        text: '+',
      })
    );
    repsCluster.appendChild(el('span', 'wt-focus-rx-inc', { text: '±1' }));
    statement.appendChild(repsCluster);

    var mid = el('div', 'wt-focus-rx-value');
    mid.appendChild(el('span', 'wt-focus-rx-reps', { text: repsText }));
    mid.appendChild(el('span', 'wt-focus-rx-times', { text: '×' }));
    mid.appendChild(el('span', 'wt-focus-rx-weight', { text: weightText }));
    mid.appendChild(el('span', 'wt-focus-rx-unit', { text: unit }));
    statement.appendChild(mid);

    var weightCluster = el('div', 'wt-focus-rx-cluster');
    weightCluster.appendChild(
      el('button', 'wt-focus-rx-btn' + (wStep <= 0 ? ' is-disabled' : ''), {
        type: 'button',
        'data-wt-action': 'bump-weight-down',
        'data-exercise-id': ex.id,
        'data-set-id': set.id,
        'aria-label': 'Decrease weight',
        text: '−',
      })
    );
    weightCluster.appendChild(
      el('button', 'wt-focus-rx-btn' + (wStep <= 0 ? ' is-disabled' : ''), {
        type: 'button',
        'data-wt-action': 'bump-weight-up',
        'data-exercise-id': ex.id,
        'data-set-id': set.id,
        'aria-label': 'Increase weight',
        text: '+',
      })
    );
    weightCluster.appendChild(
      el('span', 'wt-focus-rx-inc', {
        text: wStep > 0 ? '±' + wStep + ' ' + unit : 'BW',
      })
    );
    statement.appendChild(weightCluster);
    wrap.appendChild(statement);

    var reasonLines = [];
    if (ex._prediction && Array.isArray(ex._prediction.reasons) && ex._prediction.reasons.length) {
      reasonLines = ex._prediction.reasons;
    } else if (ex._prediction && ex._prediction.note) {
      reasonLines = String(ex._prediction.note).split('\n').filter(Boolean);
    } else if (
      window.ProgressionEngine &&
      typeof window.ProgressionEngine.recommend === 'function' &&
      ex.name
    ) {
      var live = window.ProgressionEngine.recommend(ex.name, {
        metric: unit === 'kg',
      });
      if (live && live.reasons) reasonLines = live.reasons;
    }
    if (reasonLines.length) {
      var why = el('div', 'wt-focus-why');
      why.appendChild(el('p', 'wt-focus-why-label', { text: 'Why this weight' }));
      var list = el('ul', 'wt-focus-why-list');
      reasonLines.forEach(function (line) {
        list.appendChild(el('li', 'wt-focus-why-item', { text: line }));
      });
      why.appendChild(list);
      wrap.appendChild(why);
    }

    if (set.setNumber > 3 && !set.completed) {
      wrap.appendChild(
        el('p', 'wt-volume-warning', {
          text:
            "Woah there champ, you're doing too much. Ideally, you'll hit failure to 2 reps in reserve in 3 sets — skip the volume of sets, maximize the quality of sets.",
        })
      );
    }

    var actions = el('div', 'wt-focus-actions');
    actions.appendChild(
      el('button', 'wt-focus-next-set', {
        type: 'button',
        'data-wt-action': 'focus-next-set',
        'data-exercise-id': ex.id,
        'data-set-id': set.id,
        text: 'Next set',
      })
    );
    actions.appendChild(
      el('button', 'wt-focus-next-ex', {
        type: 'button',
        'data-wt-action': 'focus-next-exercise',
        text: 'Next exercise',
      })
    );
    wrap.appendChild(actions);

    if (allSetsDone) {
      wrap.appendChild(self._renderExerciseSuggestions());
    }

    return wrap;
  };

  Tracker.prototype._renderBody = function () {
    var body = el('div', 'wt-body');
    var mode = this.session.viewMode;
    if (this.isQuickLog()) {
      // Quick log is always a simple set list — no focus / carousel / rest timeline.
      mode = mode === 'spreadsheet' ? 'spreadsheet' : 'card';
    }
    if (mode === 'focus') body.appendChild(this._renderFocusView());
    else if (mode === 'carousel') body.appendChild(this._renderCarouselView());
    else if (mode === 'spreadsheet') body.appendChild(this._renderSpreadsheetView());
    else if (mode === 'timeline') body.appendChild(this._renderTimelineView());
    else if (mode === 'map') body.appendChild(this._renderMapView());
    else body.appendChild(this._renderCardView());
    return body;
  };

  Tracker.prototype.render = function () {
    if (!this.root) return;
    this._flushDomToSession();
    this.root.innerHTML = '';
    this.root.className = 'workout-tracker' + (this.isQuickLog() ? ' workout-tracker--quick' : '');
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
