(function () {
  'use strict';

  var FAVORITES_LS_KEY = 'strongman-favorite-movements';

  function parseSuggested(suggested) {
    var t = String(suggested || '').trim();
    if (!t || t === '—') return null;
    var m = t.match(/(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+))?/i);
    if (!m) return { raw: t };
    return {
      sets: m[1],
      reps: m[2],
      weight: m[3] || '',
      raw: t,
    };
  }

  function mergeRecommendationIntoExercise(exercise, rec) {
    var base = Object.assign({}, exercise || {});
    if (!rec || !rec.suggested || rec.suggested === '—') {
      base._rockyNote = rec && rec.note ? rec.note : '';
      base._rockySuggested = '';
      return base;
    }
    var parsed = parseSuggested(rec.suggested);
    if (parsed && parsed.sets) base.sets = parsed.sets;
    if (parsed && parsed.reps) base.reps = parsed.reps;
    if (parsed && parsed.weight) base.weight = parsed.weight;
    base._rockySuggested = rec.suggested;
    base._rockyNote = rec.note || '';
    return base;
  }

  function buildHistorySummary(limitSessions, maxChars) {
    var WL = window.WorkoutLog;
    if (!WL || typeof WL.getSessions !== 'function') return '';
    var sessions = WL.getSessions();
    var lines = [];
    var used = 0;
    for (var i = 0; i < sessions.length && lines.length < (limitSessions || 18); i++) {
      var s = sessions[i];
      if (!s || s.sessionType === 'cardio') continue;
      if (!Array.isArray(s.exercises) || !s.exercises.length) continue;
      var exParts = [];
      for (var j = 0; j < s.exercises.length; j++) {
        var ex = s.exercises[j];
        if (!ex || !ex.name) continue;
        var w = ex.weight != null ? String(ex.weight) : '';
        var line = ex.name;
        if (ex.sets || ex.reps || w) {
          line += ' ' + String(ex.sets || '?') + '×' + String(ex.reps || '?') + ' @ ' + (w || '?');
        }
        exParts.push(line);
      }
      if (!exParts.length) continue;
      var head = s.date ? '[' + s.date + '] ' : '';
      var row = head + exParts.join('; ');
      if (used + row.length + 1 > (maxChars || 15000)) break;
      lines.push(row);
      used += row.length + 1;
    }
    return lines.join('\n');
  }

  function buildAthleteSummary() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!user || !window.AthleteContext) return '';
    var block = window.AthleteContext.buildCoachPromptBlock(user, {});
    return block ? block.slice(0, 4000) : '';
  }

  function countHistorySessions() {
    var WL = window.WorkoutLog;
    if (!WL || typeof WL.getSessions !== 'function') return 0;
    var sessions = WL.getSessions();
    var n = 0;
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s || s.sessionType === 'cardio') continue;
      if (Array.isArray(s.exercises) && s.exercises.length) n++;
    }
    return n;
  }

  function fetchForExercises(exercises) {
    if (typeof window.apiPost !== 'function') {
      return Promise.reject(new Error('Offline'));
    }
    var planned = (exercises || []).map(function (ex) {
      return {
        blockName: '',
        name: ex.name || '',
        sets: ex.sets || '',
        reps: ex.reps || '',
        weight: ex.weight || '',
      };
    });
    if (!planned.length) {
      return Promise.resolve({ recommendations: [], insufficientHistory: false });
    }
    var hist = buildHistorySummary(18, 15000);
    if (!hist || countHistorySessions() < 1) {
      return Promise.resolve({
        recommendations: planned.map(function () {
          return { suggested: '—', note: 'Log a few sessions first so Rocky can suggest weights.' };
        }),
        insufficientHistory: true,
      });
    }
    var fav = '';
    try {
      fav = localStorage.getItem(FAVORITES_LS_KEY) || '';
    } catch (e) {}
    return window
      .apiPost('/recommend-progress', {
        historySummary: hist,
        favoriteMovements: fav,
        athleteSummary: buildAthleteSummary(),
        plannedExercises: planned,
      })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var err = new Error((body && body.error) || 'Could not load recommendations.');
            throw err;
          }
          return {
            recommendations: body && body.recommendations ? body.recommendations : [],
            quota: body && body.quota ? body.quota : null,
            insufficientHistory: false,
          };
        });
      });
  }

  function applyToExercises(exercises, recommendations) {
    return (exercises || []).map(function (ex, i) {
      return mergeRecommendationIntoExercise(ex, recommendations && recommendations[i]);
    });
  }

  function formatBannerMessage(result, exercises) {
    if (!exercises || !exercises.length) {
      return { title: 'No exercises on today\'s split', body: 'Edit your split to add exercises for this day.' };
    }
    if (result.insufficientHistory) {
      return {
        title: 'Split loaded — sets & reps only',
        body: 'Rocky needs a few logged sessions before suggesting weights. Your exercises are in the logbook — add loads as you go.',
      };
    }
    var recs = result.recommendations || [];
    var withSug = recs.filter(function (r) {
      return r && r.suggested && r.suggested !== '—';
    }).length;
    if (!withSug) {
      return {
        title: 'Split loaded',
        body: 'Rocky could not suggest loads for every exercise yet. Check your log history or adjust manually.',
      };
    }
    var lines = [];
    for (var i = 0; i < exercises.length; i++) {
      var name = exercises[i].name || 'Exercise';
      var r = recs[i];
      if (r && r.suggested && r.suggested !== '—') {
        lines.push(name + ': ' + r.suggested + (r.note ? ' — ' + r.note : ''));
      }
    }
    return {
      title: 'Rocky\'s picks for today',
      body: lines.length ? lines.join('\n') : 'Your split is loaded with Rocky\'s suggested loads.',
    };
  }

  window.SplitRecommendations = {
    fetchForExercises: fetchForExercises,
    applyToExercises: applyToExercises,
    mergeRecommendationIntoExercise: mergeRecommendationIntoExercise,
    formatBannerMessage: formatBannerMessage,
    countHistorySessions: countHistorySessions,
    parseSuggested: parseSuggested,
  };
})();
