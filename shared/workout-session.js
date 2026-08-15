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
      movement: null,
      variantId: null,
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
      loggingMode: 'live',
      workoutDate: null,
      focusPointer: { exerciseId: null, setId: null },
      pickerState: null,
      carouselIndex: 0,
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

  function normalizeExerciseName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function eachExerciseInSession(session, fn) {
    if (!session || typeof fn !== 'function') return;
    (session.exercises || []).forEach(fn);
    (session.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(fn);
    });
  }

  function sessionTimestamp(session) {
    if (session && session.createdAt) {
      var t = Date.parse(session.createdAt);
      if (!isNaN(t)) return t;
    }
    if (session && session.date) {
      var p = String(session.date).slice(0, 10).split('-');
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  }

  function parseSetWeightReps(weight, reps) {
    var w = parseNum(weight);
    var r = parseNum(reps);
    if (w == null && r == null) return null;
    return { weight: w, reps: r };
  }

  function collectExerciseSets(ex, session) {
    var sets = [];
    var target = ex && ex.name ? normalizeExerciseName(ex.name) : '';
    if (!target) return sets;

    if (session && session.trackerData && Array.isArray(session.trackerData.exercises)) {
      var tracked = session.trackerData.exercises.find(function (te) {
        return te && te.name && normalizeExerciseName(te.name) === target;
      });
      if (tracked && Array.isArray(tracked.sets)) {
        tracked.sets.forEach(function (set) {
          if (!set) return;
          if (!set.completed && set.weight == null && set.reps == null) return;
          var parsed = parseSetWeightReps(set.weight, set.reps);
          if (parsed) sets.push(Object.assign({ completed: !!set.completed }, parsed));
        });
        if (sets.length) return sets;
      }
    }

    if (ex && Array.isArray(ex.sets) && ex.sets.length) {
      ex.sets.forEach(function (set) {
        if (!set) return;
        if (!set.completed && set.weight == null && set.reps == null) return;
        var parsed = parseSetWeightReps(set.weight, set.reps);
        if (parsed) sets.push(Object.assign({ completed: !!set.completed }, parsed));
      });
      if (sets.length) return sets;
    }

    var weights = Array.isArray(ex.setWeights) ? ex.setWeights : [];
    var repsArr = Array.isArray(ex.setReps) ? ex.setReps : [];
    var count = Math.max(weights.length, repsArr.length, parseInt(ex.sets, 10) || 0, 1);
    var i;
    for (i = 0; i < count; i++) {
      var w = weights[i] != null ? weights[i] : ex.weight;
      var r = repsArr[i] != null ? repsArr[i] : ex.reps;
      var parsedLegacy = parseSetWeightReps(w, r);
      if (parsedLegacy) sets.push(Object.assign({ completed: true }, parsedLegacy));
    }
    return sets;
  }

  function getExerciseHistory(exerciseName, limit) {
    var WL = window.WorkoutLog;
    if (!WL || !exerciseName) return [];
    var target = normalizeExerciseName(exerciseName);
    if (!target) return [];
    var sessions = WL.getSessions() || [];
    var out = [];
    var i;
    for (i = 0; i < sessions.length; i++) {
      var session = sessions[i];
      if (!session) continue;
      var match = null;
      eachExerciseInSession(session, function (ex) {
        if (match || !ex || !ex.name) return;
        if (normalizeExerciseName(ex.name) !== target) return;
        var sets = collectExerciseSets(ex, session);
        if (!sets.length) return;
        match = {
          sessionDate: session.date || session.createdAt || null,
          daysSince: null,
          sets: sets,
          setCount: sets.length,
          lines: sets.map(function (s) {
            return formatSetLine(s.weight, s.reps);
          }),
        };
      });
      if (match) {
        var ts = sessionTimestamp(session);
        if (ts) {
          match.daysSince = Math.max(0, Math.floor((Date.now() - ts) / 86400000));
        }
        out.push(match);
        if (limit && out.length >= limit) break;
      }
    }
    return out;
  }

  function getExercisePerformanceDetail(exerciseName) {
    var history = getExerciseHistory(exerciseName, 4);
    if (!history.length) return null;
    var latest = history[0];
    var sets = latest.sets || [];
    var parsed = sets.filter(function (s) {
      return s.weight != null && s.reps != null;
    });
    if (!parsed.length) return null;

    var best = parsed[0];
    parsed.forEach(function (p) {
      if (p.weight > best.weight || (p.weight === best.weight && p.reps > best.reps)) best = p;
    });

    var completedCount = parsed.filter(function (s) {
      return s.completed !== false;
    }).length;
    var thirdSetDrop = false;
    if (parsed.length >= 3 && parsed[0].weight != null && parsed[2].weight != null) {
      thirdSetDrop = parsed[2].weight < parsed[0].weight * 0.92;
    }

    var momentum = 0.5;
    if (history.length >= 2) {
      var recent = history.slice(0, Math.min(4, history.length));
      var scores = recent
        .map(function (h) {
          var top = (h.sets || []).reduce(function (acc, s) {
            if (s.weight == null) return acc;
            var score = s.weight * (s.reps || 1);
            return score > acc ? score : acc;
          }, 0);
          return top;
        })
        .filter(function (n) {
          return n > 0;
        });
      if (scores.length >= 2) {
        var first = scores[scores.length - 1];
        var lastScore = scores[0];
        if (first > 0) {
          var change = (lastScore - first) / first;
          momentum = clamp(change > 0.04 ? 0.75 : change < -0.03 ? 0.25 : 0.55, 0.2, 0.85);
        }
      }
    }

    return {
      weight: best.weight,
      reps: best.reps,
      unit: 'lb',
      sets: parsed.length,
      lines: latest.lines,
      sessionDate: latest.sessionDate,
      daysSince: latest.daysSince,
      completedSets: completedCount,
      allSetsCompleted: completedCount === parsed.length,
      thirdSetDrop: thirdSetDrop,
      momentum: momentum,
      historyCount: history.length,
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function getPreviousPerformance(exerciseName) {
    var detail = getExercisePerformanceDetail(exerciseName);
    if (!detail || !detail.lines || !detail.lines.length) return null;
    return detail.lines;
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

    // Autofill from last logged performance when the template has no weights/reps
    var prev = null;
    if ((defaultWeight == null || defaultReps == null) && ex.name) {
      prev = getPreviousPerformance(ex.name);
    }
    if (prev && prev.length) {
      setsCount = Math.max(setsCount, prev.length);
    }

    for (var i = 0; i < setsCount; i++) {
      var w = defaultWeight;
      var r = defaultReps;
      if (ex.setWeights && ex.setWeights[i] !== undefined && ex.setWeights[i] !== '') {
        w = parseNum(ex.setWeights[i]);
      }
      if ((w == null || r == null) && prev && prev[i]) {
        var parts = String(prev[i]).split('×').map(function (p) {
          return p.trim();
        });
        if (w == null) w = parseNum(parts[0]);
        if (r == null) r = parseNum(parts[1]);
      } else if ((w == null || r == null) && prev && prev.length) {
        var last = String(prev[Math.min(i, prev.length - 1)]).split('×').map(function (p) {
          return p.trim();
        });
        if (w == null) w = parseNum(last[0]);
        if (r == null) r = parseNum(last[1]);
      }
      sets.push(
        createSet({
          setNumber: i + 1,
          weight: w,
          reps: r,
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
    clone: clone,
    getExerciseHistory: getExerciseHistory,
    getExercisePerformanceDetail: getExercisePerformanceDetail,
  };
})();
