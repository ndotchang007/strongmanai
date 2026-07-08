(function () {
  'use strict';

  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function normalizeLine(t) {
    return (t || '').trim();
  }

  function parseExerciseLine(line) {
    var t = normalizeLine(line);
    if (!t || /^[-*•]?\s*$/.test(t)) return null;
    t = t.replace(/^[-*•]\s*/, '');
    var m = t.match(/^(.+?)\s*[·|]\s*(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+)\s*(?:lb|lbs)?)?/i);
    if (m) {
      return {
        name: m[1].trim(),
        sets: m[2],
        reps: m[3],
        weight: m[4] || ''
      };
    }
    m = t.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+))?/i);
    if (m) {
      return {
        name: m[1].trim(),
        sets: m[2],
        reps: m[3],
        weight: m[4] || ''
      };
    }
    return { name: t.slice(0, 120), sets: '', reps: '', weight: '' };
  }

  function dayIndexFromHeading(text) {
    var t = normalizeLine(text).toLowerCase();
    for (var i = 0; i < DAY_NAMES.length; i++) {
      if (t.indexOf(DAY_NAMES[i].toLowerCase()) === 0 || t.indexOf(DAY_SHORT[i].toLowerCase()) === 0) {
        return i;
      }
    }
    if (/^mon\b/.test(t)) return 0;
    if (/^tue/.test(t)) return 1;
    if (/^wed/.test(t)) return 2;
    if (/^thu/.test(t)) return 3;
    if (/^fri/.test(t)) return 4;
    if (/^sat/.test(t)) return 5;
    if (/^sun/.test(t)) return 6;
    return -1;
  }

  /**
   * Parse a Rocky / paste block into { programName, days[], dayPlans[] }.
   */
  function parseWeeklyRoutine(text) {
    var lines = (text || '').split(/\n/);
    var programName = '';
    var days = [];
    var dayPlans = [];
    var i;
    for (i = 0; i < 7; i++) {
      days.push('');
      dayPlans.push(null);
    }

    var currentDay = -1;
    var currentTitle = '';
    var currentExercises = [];

    function flushDay() {
      if (currentDay < 0 || currentDay > 6) return;
      var label = currentTitle || (currentExercises.length ? 'Workout' : 'REST');
      if (/^rest$/i.test(label)) label = 'REST';
      days[currentDay] = label;
      if (currentExercises.length) {
        dayPlans[currentDay] = {
          title: currentTitle || label,
          exercises: currentExercises.slice()
        };
      } else if (/rest/i.test(label)) {
        dayPlans[currentDay] = { title: 'Rest', exercises: [] };
      }
      currentExercises = [];
    }

    for (i = 0; i < lines.length; i++) {
      var trimmed = normalizeLine(lines[i]);
      if (!trimmed) continue;

      var progMatch = trimmed.match(/^program\s*:\s*(.+)$/i);
      if (progMatch) {
        programName = progMatch[1].trim();
        continue;
      }

      var dayMatch = trimmed.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*:\s*(.*)$/i);
      if (dayMatch) {
        flushDay();
        currentDay = dayIndexFromHeading(dayMatch[1]);
        currentTitle = (dayMatch[2] || '').trim();
        if (!currentTitle && currentDay >= 0) currentTitle = days[currentDay] || '';
        continue;
      }

      var headingIdx = dayIndexFromHeading(trimmed.replace(/:\s*$/, ''));
      if (headingIdx >= 0 && /:\s*$/.test(trimmed)) {
        flushDay();
        currentDay = headingIdx;
        currentTitle = trimmed.replace(/:\s*$/, '').replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*/i, '').trim();
        continue;
      }

      if (currentDay >= 0) {
        var ex = parseExerciseLine(trimmed);
        if (ex) currentExercises.push(ex);
      }
    }
    flushDay();

    var hasAny = days.some(function (d) {
      return d && d !== '—';
    });
    if (!hasAny) return null;

    return {
      programName: programName,
      days: days,
      dayPlans: dayPlans
    };
  }

  window.RoutineImport = {
    parseWeeklyRoutine: parseWeeklyRoutine,
    parseExerciseLine: parseExerciseLine
  };
})();
