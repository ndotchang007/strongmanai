(function () {
  'use strict';

  var STORAGE_BASE = 'strongman_workout_session_v1';

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function userSuffix() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '_guest';
      var u = window.getCurrentUser();
      return u && u.id != null ? '_u' + u.id : '_guest';
    } catch (e) {
      return '_guest';
    }
  }

  function storageKey() {
    return STORAGE_BASE + userSuffix();
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function createSet(overrides) {
    var s = {
      id: uid('set'),
      setNumber: 1,
      weight: null,
      reps: null,
      notes: '',
      completed: false,
      completedAt: null,
      restSeconds: null
    };
    if (overrides) {
      for (var k in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, k)) s[k] = overrides[k];
      }
    }
    return s;
  }

  function createExercise(name, overrides) {
    var ex = {
      id: uid('ex'),
      name: name || '',
      order: 0,
      supersetGroupId: null,
      collapsed: false,
      sets: [createSet({ setNumber: 1 })]
    };
    if (overrides) {
      for (var k in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, k)) ex[k] = overrides[k];
      }
    }
    return ex;
  }

  function createSession(overrides) {
    var now = new Date().toISOString();
    var session = {
      id: uid('session'),
      status: 'active',
      startedAt: now,
      completedAt: null,
      splitName: '',
      title: '',
      notes: '',
      viewMode: 'card',
      workoutDate: null,
      focusPointer: { exerciseId: null, setId: null },
      exercises: []
    };
    if (overrides) {
      for (var k in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, k)) session[k] = overrides[k];
      }
    }
    return session;
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.id) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(session));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(storageKey());
    } catch (e) {}
  }

  function renumberSets(exercise) {
    exercise.sets.forEach(function (set, i) {
      set.setNumber = i + 1;
    });
  }

  function nextSupersetGroupId(exercises) {
    var used = {};
    (exercises || []).forEach(function (ex) {
      if (ex.supersetGroupId) used[ex.supersetGroupId] = true;
    });
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = 0; i < letters.length; i++) {
      if (!used[letters[i]]) return letters[i];
    }
    return 'Z' + Date.now();
  }

  function parseNum(val) {
    if (val === null || val === undefined || val === '') return null;
    var n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function formatSetLine(weight, reps) {
    var w = weight != null && weight !== '' ? weight : '—';
    var r = reps != null && reps !== '' ? reps : '—';
    return w + ' × ' + r;
  }

  function getPreviousPerformance(exerciseName) {
    var WL = window.WorkoutLog;
    if (!WL || !exerciseName) return null;
    var sessions = WL.getSessions() || [];
    var target = exerciseName.trim().toLowerCase();
    if (!target) return null;

    for (var i = 0; i < sessions.length; i++) {
      var session = sessions[i];
      if (!session || !Array.isArray(session.exercises)) continue;
      for (var j = 0; j < session.exercises.length; j++) {
        var ex = session.exercises[j];
        if (!ex || !ex.name) continue;
        if (ex.name.trim().toLowerCase() !== target) continue;

        var lines = [];
        if (ex.setWeights && ex.setWeights.length) {
          var setCount = parseInt(ex.sets, 10) || ex.setWeights.length;
          var repsVal = ex.reps || '';
          for (var s = 0; s < setCount; s++) {
            var w = ex.setWeights[s] != null ? ex.setWeights[s] : ex.weight;
            lines.push(formatSetLine(w, repsVal));
          }
        } else if (session.trackerData && session.trackerData.exercises) {
          var tracked = session.trackerData.exercises.find(function (te) {
            return te.name && te.name.trim().toLowerCase() === target;
          });
          if (tracked && tracked.sets) {
            tracked.sets.forEach(function (set) {
              if (set.completed || set.weight || set.reps) {
                lines.push(formatSetLine(set.weight, set.reps));
              }
            });
          }
        }
        if (!lines.length && (ex.weight || ex.reps || ex.sets)) {
          var count = parseInt(ex.sets, 10) || 1;
          for (var c = 0; c < count; c++) {
            lines.push(formatSetLine(ex.weight, ex.reps));
          }
        }
        if (lines.length) return lines;
      }
    }
    return null;
  }

  function representativeReps(sets) {
    var vals = sets
      .map(function (s) {
        return s.reps;
      })
      .filter(function (v) {
        return v != null;
      });
    if (!vals.length) return '';
    var allSame = vals.every(function (v) {
      return v === vals[0];
    });
    return allSame ? String(vals[0]) : String(vals[vals.length - 1]);
  }

  function representativeWeight(sets) {
    var vals = sets
      .map(function (s) {
        return s.weight;
      })
      .filter(function (v) {
        return v != null;
      });
    if (!vals.length) return '';
    if (vals.length === 1) return String(vals[0]);
    var avg = vals.reduce(function (a, b) {
      return a + b;
    }, 0) / vals.length;
    return String(Math.round(avg * 20) / 20);
  }

  function exerciseHasContent(ex) {
    if (ex.name && ex.name.trim()) return true;
    return (ex.sets || []).some(function (s) {
      return s.weight != null || s.reps != null || s.completed || (s.notes && s.notes.trim());
    });
  }

  function toLegacyExercises(exercises) {
    var groups = {};
    (exercises || []).forEach(function (ex) {
      if (ex.supersetGroupId) {
        if (!groups[ex.supersetGroupId]) groups[ex.supersetGroupId] = [];
        groups[ex.supersetGroupId].push(ex);
      }
    });

    var usedAsSuperset = {};

    return (exercises || [])
      .filter(exerciseHasContent)
      .map(function (ex) {
        var setWeights = ex.sets.map(function (s) {
          return s.weight != null ? String(s.weight) : '';
        });
        var hasPerSetWeights = setWeights.some(function (w) {
          return w !== '';
        });
        var allWeightsSame =
          !hasPerSetWeights ||
          setWeights.every(function (w) {
            return w === setWeights[0];
          });

        var legacy = {
          name: ex.name || '',
          sets: String(ex.sets.length || 0),
          reps: representativeReps(ex.sets),
          weight: representativeWeight(ex.sets)
        };

        if (hasPerSetWeights && !allWeightsSame) {
          legacy.setWeights = setWeights;
        } else if (hasPerSetWeights && setWeights[0]) {
          legacy.weight = setWeights[0];
        }

        if (ex.supersetGroupId && groups[ex.supersetGroupId]) {
          var group = groups[ex.supersetGroupId];
          var partner = group.find(function (p) {
            return p.id !== ex.id && !usedAsSuperset[p.id];
          });
          if (partner && !usedAsSuperset[ex.id]) {
            legacy.superset = {
              name: partner.name || '',
              sets: String(partner.sets.length || 0),
              reps: representativeReps(partner.sets),
              weight: representativeWeight(partner.sets)
            };
            usedAsSuperset[partner.id] = true;
          }
        }

        return legacy;
      });
  }

  function fromLegacyExercise(ex, order) {
    var setsCount = Math.max(1, parseInt(ex.sets, 10) || 1);
    var defaultReps = parseNum(ex.reps);
    var defaultWeight = parseNum(ex.weight);
    var sets = [];

    for (var i = 0; i < setsCount; i++) {
      var w = defaultWeight;
      if (ex.setWeights && ex.setWeights[i] !== undefined && ex.setWeights[i] !== '') {
        w = parseNum(ex.setWeights[i]);
      }
      sets.push(
        createSet({
          setNumber: i + 1,
          weight: w,
          reps: defaultReps,
          completed: false
        })
      );
    }

    return createExercise(ex.name || '', {
      order: order || 0,
      sets: sets
    });
  }

  function fromLegacyExercises(exercises) {
    var result = [];
    var groupMap = {};
    (exercises || []).forEach(function (ex, idx) {
      var exercise = fromLegacyExercise(ex, idx);
      if (ex.superset && ex.superset.name) {
        var gid = nextSupersetGroupId(result.concat([exercise]));
        exercise.supersetGroupId = gid;
        groupMap[gid] = ex.superset;
        result.push(exercise);
        var partner = fromLegacyExercise(
          {
            name: ex.superset.name,
            sets: ex.superset.sets,
            reps: ex.superset.reps,
            weight: ex.superset.weight
          },
          idx + 0.5
        );
        partner.supersetGroupId = gid;
        result.push(partner);
      } else {
        result.push(exercise);
      }
    });
    result.sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    result.forEach(function (ex, i) {
      ex.order = i;
    });
    return result;
  }

  function toLegacyPayload(session, meta) {
    meta = meta || {};
    var started = session.startedAt ? new Date(session.startedAt) : new Date();
    var datePart = meta.date || started.toISOString().slice(0, 10);
    var timePart = meta.time || started.toISOString().slice(11, 16);

    return {
      date: datePart,
      time: timePart,
      splitName: meta.splitName != null ? meta.splitName : session.splitName || '',
      title: meta.title != null ? meta.title : session.title || '',
      notes: meta.notes != null ? meta.notes : session.notes || '',
      exercises: toLegacyExercises(session.exercises),
      sessionType: meta.sessionType || 'strength',
      totalIntensity: meta.totalIntensity != null ? meta.totalIntensity : null,
      cardio: meta.cardio || null,
      source: 'create',
      trackerVersion: 2,
      trackerData: {
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        exercises: clone(session.exercises)
      }
    };
  }

  function completedSetsTimeline(exercises) {
    var events = [];
    (exercises || []).forEach(function (ex) {
      (ex.sets || []).forEach(function (set) {
        if (set.completed && set.completedAt) {
          events.push({
            completedAt: set.completedAt,
            exerciseName: ex.name,
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            supersetGroupId: ex.supersetGroupId
          });
        }
      });
    });
    events.sort(function (a, b) {
      return Date.parse(a.completedAt) - Date.parse(b.completedAt);
    });
    return events;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '—';
    }
  }

  function formatRest(seconds) {
    if (seconds == null || isNaN(seconds)) return '';
    if (seconds < 60) return seconds + 's rest';
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return s ? m + 'm ' + s + 's rest' : m + 'm rest';
  }

  window.WorkoutSession = {
    uid: uid,
    createSet: createSet,
    createExercise: createExercise,
    createSession: createSession,
    loadSession: loadSession,
    saveSession: saveSession,
    clearSession: clearSession,
    renumberSets: renumberSets,
    nextSupersetGroupId: nextSupersetGroupId,
    parseNum: parseNum,
    formatSetLine: formatSetLine,
    getPreviousPerformance: getPreviousPerformance,
    toLegacyExercises: toLegacyExercises,
    fromLegacyExercises: fromLegacyExercises,
    toLegacyPayload: toLegacyPayload,
    completedSetsTimeline: completedSetsTimeline,
    formatTime: formatTime,
    formatRest: formatRest,
    exerciseHasContent: exerciseHasContent,
    clone: clone
  };
})();
