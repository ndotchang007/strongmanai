/**
 * Strength analytics for Progress → Stats charts.
 */
(function () {
  'use strict';

  function parseNum(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(/[^\d.]/g, ''));
    return isNaN(n) || n <= 0 ? null : n;
  }

  function sessionDateKey(s) {
    if (s && s.date) return String(s.date).slice(0, 10);
    if (s && s.createdAt) {
      var d = new Date(s.createdAt);
      if (!isNaN(d.getTime())) {
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
        );
      }
    }
    return '';
  }

  function sessionTs(s) {
    if (s && s.createdAt) {
      var t = Date.parse(s.createdAt);
      if (!isNaN(t)) return t;
    }
    var key = sessionDateKey(s);
    if (!key) return 0;
    var p = key.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getTime();
  }

  function eachExercise(session, fn) {
    (session.exercises || []).forEach(fn);
    (session.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(fn);
    });
  }

  function normalizeName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function epleyE1rm(weight, reps) {
    if (!weight || weight <= 0) return null;
    var r = reps && reps > 0 ? Math.min(reps, 12) : 1;
    if (r === 1) return weight;
    return weight * (1 + r / 30);
  }

  function exerciseSets(ex) {
    var out = [];
    if (!ex) return out;
    if (Array.isArray(ex.sets) && ex.sets.length) {
      ex.sets.forEach(function (s) {
        if (!s) return;
        out.push({
          weight: parseNum(s.weight != null ? s.weight : s.lbs),
          reps: parseNum(s.reps),
        });
      });
      if (out.length) return out;
    }
    var weights = Array.isArray(ex.setWeights) ? ex.setWeights : [];
    var reps = Array.isArray(ex.setReps) ? ex.setReps : [];
    var n = Math.max(weights.length, reps.length);
    var i;
    if (n) {
      for (i = 0; i < n; i++) {
        out.push({
          weight: parseNum(weights[i] != null ? weights[i] : ex.weight),
          reps: parseNum(reps[i] != null ? reps[i] : ex.reps),
        });
      }
    } else {
      out.push({ weight: parseNum(ex.weight), reps: parseNum(ex.reps) });
    }
    return out;
  }

  function sessionVolume(session) {
    var vol = 0;
    eachExercise(session, function (ex) {
      if (!ex) return;
      exerciseSets(ex).forEach(function (set) {
        if (set.weight != null && set.reps != null) vol += set.weight * set.reps;
        else if (set.weight != null) vol += set.weight;
      });
    });
    return vol;
  }

  function sessionPeakForName(session, nameKey) {
    var peak = 0;
    eachExercise(session, function (ex) {
      if (!ex || normalizeName(ex.name) !== nameKey) return;
      exerciseSets(ex).forEach(function (set) {
        if (set.weight != null && set.weight > peak) peak = set.weight;
      });
    });
    return peak;
  }

  function sessionBestE1rmForName(session, nameKey) {
    var best = 0;
    eachExercise(session, function (ex) {
      if (!ex || normalizeName(ex.name) !== nameKey) return;
      exerciseSets(ex).forEach(function (set) {
        if (set.weight == null) return;
        var e = epleyE1rm(set.weight, set.reps || 1);
        if (e != null && e > best) best = e;
      });
    });
    return best;
  }

  function listExerciseOptions(sessions) {
    var map = {};
    (sessions || []).forEach(function (s) {
      eachExercise(s, function (ex) {
        if (!ex || !ex.name) return;
        var key = normalizeName(ex.name);
        if (!key || key.length < 2) return;
        if (!map[key]) map[key] = { key: key, name: String(ex.name), count: 0 };
        map[key].count += 1;
        if (String(ex.name).length > map[key].name.length) map[key].name = String(ex.name);
      });
    });
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  function bucketIndexForSession(s, range, labelsLen) {
    if (!s || !s.date) return -1;
    var p = String(s.date).split('T')[0].split('-');
    if (p.length !== 3) return -1;
    var yi = parseInt(p[0], 10);
    var mi = parseInt(p[1], 10) - 1;
    var di = parseInt(p[2], 10);
    var now = new Date();
    if (range === 'month') {
      if (yi === now.getFullYear() && mi === now.getMonth() && di >= 1 && di <= labelsLen) {
        return di - 1;
      }
      return -1;
    }
    if (range === 'year') {
      if (yi === now.getFullYear() && mi >= 0 && mi < 12) return mi;
      return -1;
    }
    // all — year buckets; labels are year strings elsewhere
    return -2;
  }

  function buildVolumeSeries(sessions, labels, range) {
    var vols = new Array(labels.length).fill(0);
    if (range === 'all') {
      var yearMap = {};
      labels.forEach(function (y, i) {
        yearMap[String(y)] = i;
      });
      (sessions || []).forEach(function (s) {
        var key = sessionDateKey(s);
        if (!key) return;
        var y = key.slice(0, 4);
        if (yearMap[y] == null) return;
        vols[yearMap[y]] += sessionVolume(s);
      });
      return vols;
    }
    (sessions || []).forEach(function (s) {
      var idx = bucketIndexForSession(s, range, labels.length);
      if (idx < 0) return;
      vols[idx] += sessionVolume(s);
    });
    return vols;
  }

  function buildPeakSeries(sessions, labels, range, nameKey) {
    var peaks = new Array(labels.length).fill(null);
    function consider(idx, val) {
      if (idx < 0 || !val) return;
      if (peaks[idx] == null || val > peaks[idx]) peaks[idx] = val;
    }
    if (range === 'all') {
      var yearMap = {};
      labels.forEach(function (y, i) {
        yearMap[String(y)] = i;
      });
      (sessions || []).forEach(function (s) {
        var key = sessionDateKey(s);
        if (!key) return;
        var y = key.slice(0, 4);
        if (yearMap[y] == null) return;
        consider(yearMap[y], sessionPeakForName(s, nameKey));
      });
      return peaks;
    }
    (sessions || []).forEach(function (s) {
      consider(bucketIndexForSession(s, range, labels.length), sessionPeakForName(s, nameKey));
    });
    return peaks;
  }

  function buildE1rmSeries(sessions, labels, range, nameKey) {
    var peaks = new Array(labels.length).fill(null);
    function consider(idx, val) {
      if (idx < 0 || !val) return;
      if (peaks[idx] == null || val > peaks[idx]) peaks[idx] = Math.round(val);
    }
    if (range === 'all') {
      var yearMap = {};
      labels.forEach(function (y, i) {
        yearMap[String(y)] = i;
      });
      (sessions || []).forEach(function (s) {
        var key = sessionDateKey(s);
        if (!key) return;
        var y = key.slice(0, 4);
        if (yearMap[y] == null) return;
        consider(yearMap[y], sessionBestE1rmForName(s, nameKey));
      });
      return peaks;
    }
    (sessions || []).forEach(function (s) {
      consider(bucketIndexForSession(s, range, labels.length), sessionBestE1rmForName(s, nameKey));
    });
    return peaks;
  }

  function slope(values) {
    var pts = [];
    (values || []).forEach(function (v, i) {
      if (v != null && v > 0) pts.push({ x: i, y: v });
    });
    if (pts.length < 2) return 0;
    var n = pts.length;
    var sumX = 0;
    var sumY = 0;
    var sumXY = 0;
    var sumXX = 0;
    pts.forEach(function (p) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    });
    var den = n * sumXX - sumX * sumX;
    if (!den) return 0;
    return (n * sumXY - sumX * sumY) / den;
  }

  function compareLiftPeaks(sessions) {
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTs(a) - sessionTs(b);
      });
    if (sorted.length < 2) return { labels: [], early: [], late: [] };
    var mid = Math.floor(sorted.length / 2);
    var earlyS = sorted.slice(0, mid);
    var lateS = sorted.slice(mid);
    var opts = listExerciseOptions(sorted).slice(0, 6);
    var labels = [];
    var early = [];
    var late = [];
    opts.forEach(function (opt) {
      var eMax = 0;
      var lMax = 0;
      earlyS.forEach(function (s) {
        eMax = Math.max(eMax, sessionPeakForName(s, opt.key));
      });
      lateS.forEach(function (s) {
        lMax = Math.max(lMax, sessionPeakForName(s, opt.key));
      });
      if (eMax > 0 || lMax > 0) {
        var fullName = opt.name;
        var shortName = fullName.length > 28 ? fullName.slice(0, 26) + '…' : fullName;
        labels.push(shortName);
        early.push(eMax || 0);
        late.push(lMax || 0);
      }
    });
    return { labels: labels, early: early, late: late };
  }

  function buildInsight(sessions, volumeSeries, peakSeries, exerciseName) {
    var volSlope = slope(volumeSeries);
    var peakSlope = slope(peakSeries);
    var n = (sessions || []).length;
    var totalVol = 0;
    (sessions || []).forEach(function (s) {
      totalVol += sessionVolume(s);
    });
    var verdict;
    var tone = 'neutral';
    if (n < 3) {
      verdict = 'Log a few more sessions with weight — then we’ll show clear strength trends.';
    } else if (peakSlope > 0.5 || volSlope > 5) {
      verdict = 'You’re gaining strength — loads and/or volume are trending up.';
      tone = 'up';
    } else if (peakSlope < -0.5 && volSlope < -5) {
      verdict = 'Strength markers are sliding — check recovery, sleep, or add progressive overload.';
      tone = 'down';
    } else {
      verdict = 'Mostly maintaining — keep nudging peak sets up when form stays solid.';
      tone = 'flat';
    }
    var metrics = [
      { label: 'Sessions', value: String(n) },
      {
        label: 'Total volume',
        value: totalVol >= 1000 ? Math.round(totalVol / 1000) + 'k lb' : Math.round(totalVol) + ' lb',
      },
    ];
    if (exerciseName) {
      var peaks = (peakSeries || []).filter(function (v) {
        return v != null;
      });
      if (peaks.length) {
        metrics.push({
          label: exerciseName + ' peak',
          value: Math.round(peaks[peaks.length - 1]) + ' lb',
        });
      }
    }
    var volDir = volSlope > 5 ? 'rising' : volSlope < -5 ? 'falling' : 'steady';
    metrics.push({ label: 'Volume trend', value: volDir });
    return { verdict: verdict, tone: tone, metrics: metrics, lead: null };
  }

  function colorToRgba(color, alpha) {
    var c = String(color || '').trim();
    var a = alpha == null ? 1 : alpha;
    if (!c) return 'rgba(255, 140, 0, ' + a + ')';
    var rgbMatch = c.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
    if (rgbMatch) {
      return 'rgba(' + rgbMatch[1] + ', ' + rgbMatch[2] + ', ' + rgbMatch[3] + ', ' + a + ')';
    }
    if (c.charAt(0) === '#') {
      var hex = c.slice(1);
      if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
      }
      if (hex.length >= 6) {
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
        }
      }
    }
    return 'rgba(255, 140, 0, ' + a + ')';
  }

  function themeAccent() {
    try {
      var s = getComputedStyle(document.documentElement);
      var accent = (s.getPropertyValue('--accent') || '#ff8c00').trim() || '#ff8c00';
      var bright = (s.getPropertyValue('--accent-bright') || '#ffa033').trim() || '#ffa033';
      var muted = (s.getPropertyValue('--text-muted') || '#aaa').trim() || '#aaa';
      var page = (s.getPropertyValue('--bg-page') || '#141414').trim() || '#141414';
      return {
        accent: accent,
        bright: bright,
        muted: muted,
        page: page,
        grid: 'rgba(255,255,255,0.08)',
        fade: colorToRgba(accent, 0.22),
        fadeSoft: colorToRgba(accent, 0.12),
        rgba: function (alpha) {
          return colorToRgba(accent, alpha);
        },
      };
    } catch (e) {
      return {
        accent: '#ff8c00',
        bright: '#ffa033',
        muted: '#aaa',
        page: '#141414',
        grid: 'rgba(255,255,255,0.08)',
        fade: 'rgba(255, 140, 0, 0.22)',
        fadeSoft: 'rgba(255, 140, 0, 0.12)',
        rgba: function (alpha) {
          return colorToRgba('#ff8c00', alpha);
        },
      };
    }
  }

  window.StrengthStats = {
    sessionVolume: sessionVolume,
    sessionPeakForName: sessionPeakForName,
    sessionBestE1rmForName: sessionBestE1rmForName,
    listExerciseOptions: listExerciseOptions,
    buildVolumeSeries: buildVolumeSeries,
    buildPeakSeries: buildPeakSeries,
    buildE1rmSeries: buildE1rmSeries,
    compareLiftPeaks: compareLiftPeaks,
    buildInsight: buildInsight,
    themeAccent: themeAccent,
    normalizeName: normalizeName,
    slope: slope,
    epleyE1rm: epleyE1rm,
    exerciseSets: exerciseSets,
  };
})();
