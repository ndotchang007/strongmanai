/**
 * Front/back anatomy maps (finish screen) + radar skills web (profile).
 * Region IDs align with RockyCoachingInsights.MUSCLE_GROUPS.
 */
(function () {
  var GROUP_IDS = [
    'chest',
    'back',
    'shoulders',
    'arms',
    'quads',
    'hamstrings',
    'glutes',
    'core',
  ];

  var GROUP_LABELS = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    arms: 'Arms',
    quads: 'Quads',
    hamstrings: 'Hams',
    glutes: 'Glutes',
    core: 'Core',
  };

  var RADAR_AXES = [
    { id: 'chest', label: 'Chest' },
    { id: 'shoulders', label: 'Delts' },
    { id: 'arms', label: 'Arms' },
    { id: 'quads', label: 'Quads' },
    { id: 'hamstrings', label: 'Hams' },
    { id: 'glutes', label: 'Glutes' },
    { id: 'back', label: 'Back' },
    { id: 'core', label: 'Core' },
  ];

  /** Broad calling-card hexagon — 6 spokes scored from est. 1RM vs hard standards. */
  var HEX_AXES = [
    { id: 'legs', label: 'Legs', from: ['quads', 'hamstrings', 'glutes'] },
    { id: 'abs', label: 'Abs', from: ['core'] },
    { id: 'shoulders', label: 'Shoulders', from: ['shoulders'] },
    { id: 'chest', label: 'Chest', from: ['chest'] },
    { id: 'back', label: 'Back', from: ['back'] },
    { id: 'arms', label: 'Arms', from: ['arms'] },
  ];

  /**
   * Impressive e1RM targets (lb). Outer ring ≈ advanced/strong — casual gym
   * weights (e.g. 45 lb DB shoulder press) stay well inside the web.
   */
  var HEX_E1RM_TARGETS_LB = {
    legs: 455, // deep back squat
    abs: 90, // serious weighted crunch / hanging raise load
    shoulders: 245, // barbell overhead press
    chest: 365, // competition-style bench
    back: 545, // conventional deadlift
    arms: 275, // close-grip bench / heavy curl equiv
  };

  /** Canonical lifts → axis + how to turn logged weight into a BB-comparable e1RM. */
  var HEX_LIFT_RULES = [
    { axis: 'legs', pattern: /\b(back\s*)?squat\b|\bhack squat\b|\bfront squat\b/i, side: 'bar' },
    { axis: 'legs', pattern: /\bleg press\b/i, side: 'bar', scale: 0.4 },
    { axis: 'legs', pattern: /\bbulgarian|\bsplit squat|\blunge\b/i, side: 'db' },
    { axis: 'chest', pattern: /\bbench press\b|\bflat bench\b/i, side: 'auto' },
    { axis: 'chest', pattern: /\bincline (bench|press)\b/i, side: 'auto', scale: 1.08 },
    { axis: 'chest', pattern: /\bdecline (bench|press)\b/i, side: 'auto', scale: 0.95 },
    { axis: 'chest', pattern: /\bdumbbell (bench|press)\b|\bdb bench\b/i, side: 'db' },
    { axis: 'shoulders', pattern: /\b(overhead|military|shoulder)\s*press\b|\bohp\b|\bpush press\b/i, side: 'auto' },
    { axis: 'shoulders', pattern: /\barnold press\b|\bdb (ohp|press)\b|\bdumbbell (shoulder|overhead)\b/i, side: 'db' },
    { axis: 'back', pattern: /\bdeadlift\b|\bconventional dead|\bsumo dead\b|\brdl\b|\bromanian\b/i, side: 'bar' },
    { axis: 'back', pattern: /\b(barbell|pendlay|seal|chest.?supported)?\s*row\b|\bt.?bar row\b/i, side: 'auto', scale: 1.35 },
    { axis: 'back', pattern: /\bpull.?up\b|\bchin.?up\b|\blat pulldown\b/i, side: 'bar', scale: 1.6, addBody: true },
    { axis: 'arms', pattern: /\bclose.?grip bench\b|\bcg bench\b/i, side: 'bar' },
    { axis: 'arms', pattern: /\b(barbell|ez|dumbbell|db)?\s*(bicep\s*)?curl\b|\bpreacher curl\b|\bhammer curl\b/i, side: 'auto', scale: 2.2 },
    { axis: 'arms', pattern: /\bskull\s*crush|\blying tricep|\boverhead tricep|\btricep(s)? (pushdown|extension)\b/i, side: 'auto', scale: 1.8 },
    { axis: 'arms', pattern: /\bdip\b/i, side: 'bar', scale: 1.15, addBody: true },
    { axis: 'abs', pattern: /\bcable crunch\b|\bweighted (crunch|sit.?up)\b|\bhanging (leg|knee)\b|\bdecline sit/i, side: 'auto' },
    { axis: 'abs', pattern: /\bab wheel\b|\bpallof\b|\bdragon flag\b/i, side: 'bar', scale: 1.2 },
  ];

  function parseLiftNum(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function epleyE1rmLocal(weight, reps) {
    if (window.StrengthStats && typeof window.StrengthStats.epleyE1rm === 'function') {
      return window.StrengthStats.epleyE1rm(weight, reps);
    }
    if (!weight || weight <= 0) return null;
    var r = reps && reps > 0 ? Math.min(Number(reps), 12) : 1;
    if (r === 1) return weight;
    return weight * (1 + r / 30);
  }

  function exerciseSetList(ex) {
    if (window.StrengthStats && typeof window.StrengthStats.exerciseSets === 'function') {
      return window.StrengthStats.exerciseSets(ex);
    }
    var out = [];
    if (!ex) return out;
    if (Array.isArray(ex.sets)) {
      ex.sets.forEach(function (s) {
        if (!s) return;
        out.push({
          weight: parseLiftNum(s.weight != null ? s.weight : s.lbs),
          reps: parseLiftNum(s.reps),
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
          weight: parseLiftNum(weights[i] != null ? weights[i] : ex.weight),
          reps: parseLiftNum(reps[i] != null ? reps[i] : ex.reps),
        });
      }
      return out;
    }
    out.push({ weight: parseLiftNum(ex.weight), reps: parseLiftNum(ex.reps) });
    return out;
  }

  function isDumbbellName(name) {
    return /\b(dumbbell|db|kettlebell|kb)\b/i.test(name || '');
  }

  function bestE1rmForExercise(ex) {
    var best = 0;
    exerciseSetList(ex).forEach(function (set) {
      if (set.weight == null || set.weight <= 0) return;
      var e = epleyE1rmLocal(set.weight, set.reps || 1);
      if (e != null && e > best) best = e;
    });
    return best;
  }

  function bodyweightLb(opts) {
    var u = (opts && opts.user) || (typeof window !== 'undefined' && window.getCurrentUser && window.getCurrentUser());
    if (!u) return 180;
    var raw = u.weightLb != null ? u.weightLb : u.weight;
    var n = parseLiftNum(raw);
    if (n && n > 60 && n < 500) {
      if (u.weightUnit === 'kg' || (u.unitSystem || '').indexOf('metric') !== -1) {
        return n * 2.2046226218;
      }
      return n;
    }
    return 180;
  }

  function comparableE1rm(ex, rule, opts) {
    var raw = bestE1rmForExercise(ex);
    if (!raw) return 0;
    var name = ex.name || '';
    var side = rule.side || 'auto';
    var useDb = side === 'db' || (side === 'auto' && isDumbbellName(name));
    var score = useDb ? raw * 2 : raw;
    if (rule.addBody) score += bodyweightLb(opts);
    if (rule.scale) score *= rule.scale;
    return score;
  }

  function collectHexE1rmScores(exercises, opts) {
    opts = opts || {};
    var best = {};
    HEX_AXES.forEach(function (axis) {
      best[axis.id] = 0;
    });
    (exercises || []).forEach(function (ex) {
      if (!ex || !ex.name) return;
      HEX_LIFT_RULES.forEach(function (rule) {
        if (!rule.pattern.test(ex.name)) return;
        var e = comparableE1rm(ex, rule, opts);
        if (e > (best[rule.axis] || 0)) best[rule.axis] = e;
      });
    });
    var values = {};
    HEX_AXES.forEach(function (axis) {
      var target = HEX_E1RM_TARGETS_LB[axis.id] || 300;
      var e1 = best[axis.id] || 0;
      if (!e1) {
        values[axis.id] = 0;
        return;
      }
      // Steeper than linear so mid-gym loads don't look elite.
      var ratio = Math.max(0, Math.min(1, e1 / target));
      values[axis.id] = Math.pow(ratio, 1.55);
    });
    return { best: best, values: values };
  }

  function aggregateBroadCounts(counts, axes) {
    var out = {};
    (axes || HEX_AXES).forEach(function (axis) {
      var sum = 0;
      (axis.from || [axis.id]).forEach(function (id) {
        sum += counts[id] || 0;
      });
      out[axis.id] = sum;
    });
    return out;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inferGroupsFromExerciseName(name) {
    var hits = [];
    try {
      var groups =
        (typeof window !== 'undefined' &&
          window.RockyCoachingInsights &&
          window.RockyCoachingInsights.MUSCLE_GROUPS) ||
        [];
      groups.forEach(function (g) {
        if (!g || !g.pattern || typeof g.pattern.test !== 'function') return;
        try {
          if (g.pattern.test(name || '')) hits.push(g.id);
        } catch (e) {}
      });
    } catch (e) {}
    return hits;
  }

  function collectActiveGroups(exercises) {
    var counts = {};
    GROUP_IDS.forEach(function (id) {
      counts[id] = 0;
    });
    (exercises || []).forEach(function (ex) {
      if (!ex) return;
      var named = String(ex.targetMuscles || '')
        .toLowerCase()
        .split(/[,;/|]+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      var fromName = inferGroupsFromExerciseName(ex.name || '');
      var ids = fromName.slice();
      named.forEach(function (token) {
        GROUP_IDS.forEach(function (id) {
          if (token.indexOf(id) !== -1 || token.indexOf(GROUP_LABELS[id].toLowerCase()) !== -1) {
            if (ids.indexOf(id) === -1) ids.push(id);
          }
        });
        if (/pec|chest/.test(token) && ids.indexOf('chest') === -1) ids.push('chest');
        if (/lat|trap|rhomb|rear/.test(token) && ids.indexOf('back') === -1) ids.push('back');
        if (/delt|shoulder/.test(token) && ids.indexOf('shoulders') === -1) ids.push('shoulders');
        if (/bicep|tricep|forearm|arm/.test(token) && ids.indexOf('arms') === -1) ids.push('arms');
        if (/quad|thigh/.test(token) && ids.indexOf('quads') === -1) ids.push('quads');
        if (/ham|hamstring/.test(token) && ids.indexOf('hamstrings') === -1) ids.push('hamstrings');
        if (/glute/.test(token) && ids.indexOf('glutes') === -1) ids.push('glutes');
        if (/core|ab|oblique/.test(token) && ids.indexOf('core') === -1) ids.push('core');
      });
      if (!ids.length) ids = fromName;
      ids.forEach(function (id) {
        if (counts[id] != null) counts[id] += 1;
      });
    });
    return counts;
  }

  function regionClass(active, id) {
    return 'mm-region' + (active[id] ? ' is-active' : '');
  }

  /** More anatomical front silhouette (head → feet). */
  function frontSvg(active) {
    return (
      '<svg class="mm-svg mm-svg--front" viewBox="0 0 160 320" role="img" aria-label="Front muscle map">' +
      // Head / neck / base torso outline
      '<ellipse class="mm-outline" cx="80" cy="28" rx="16" ry="20"/>' +
      '<path class="mm-outline" d="M72 46c-2 6-2 12 0 16h16c2-4 2-10 0-16-4 3-12 3-16 0z"/>' +
      '<path class="mm-outline" d="M48 68c-4 8-6 20-6 34v88c0 10 4 18 10 22l8 48c2 10 6 18 12 18h20c6 0 10-8 12-18l8-48c6-4 10-12 10-22V102c0-14-2-26-6-34-10 14-34 16-48 0z"/>' +
      // Delts
      '<path data-muscle="shoulders" class="' +
      regionClass(active, 'shoulders') +
      '" d="M42 72c-14 6-22 20-24 36 8 2 16 2 22-2 4-12 10-22 18-28-6-4-12-6-16-6zm76 0c14 6 22 20 24 36-8 2-16 2-22-2-4-12-10-22-18-28 6-4 12-6 16-6z"/>' +
      // Pecs (two lobes)
      '<path data-muscle="chest" class="' +
      regionClass(active, 'chest') +
      '" d="M52 78c10-8 18-10 28-8v42c-12 2-22-2-28-12-2-8-2-16 0-22zm56 0c-10-8-18-10-28-8v42c12 2 22-2 28-12 2-8 2-16 0-22z"/>' +
      // Abs / core
      '<path data-muscle="core" class="' +
      regionClass(active, 'core') +
      '" d="M64 118h32c1 8 1 16 0 24H64c-1-8-1-16 0-24zm0 28h32c1 8 1 14 0 22H64c-1-8-1-14 0-22zm2 26h28c1 6 0 12-2 18H68c-2-6-3-12-2-18z"/>' +
      // Arms (biceps / brachialis silhouette)
      '<path data-muscle="arms" class="' +
      regionClass(active, 'arms') +
      '" d="M30 108c-8 10-10 28-8 46 6 4 12 6 16 4 0-14 2-28 6-40-4-4-10-8-14-10zm100 0c8 10 10 28 8 46-6 4-12 6-16 4 0-14-2-28-6-40 4-4 10-8 14-10z"/>' +
      // Quads
      '<path data-muscle="quads" class="' +
      regionClass(active, 'quads') +
      '" d="M58 198c-2 0-6 2-8 6-2 22-2 44 2 66 4 2 10 2 14 0 2-22 2-44 0-66-2-4-4-6-8-6zm36 0c-4 0-6 2-8 6-2 22-2 44 0 66 4 2 10 2 14 0 4-22 4-44 2-66-2-4-6-6-8-6z"/>' +
      '</svg>'
    );
  }

  /** More anatomical back silhouette. */
  function backSvg(active) {
    return (
      '<svg class="mm-svg mm-svg--back" viewBox="0 0 160 320" role="img" aria-label="Back muscle map">' +
      '<ellipse class="mm-outline" cx="80" cy="28" rx="16" ry="20"/>' +
      '<path class="mm-outline" d="M72 46c-2 6-2 12 0 16h16c2-4 2-10 0-16-4 3-12 3-16 0z"/>' +
      '<path class="mm-outline" d="M48 68c-4 8-6 20-6 34v88c0 10 4 18 10 22l8 48c2 10 6 18 12 18h20c6 0 10-8 12-18l8-48c6-4 10-12 10-22V102c0-14-2-26-6-34-10 14-34 16-48 0z"/>' +
      // Rear delts
      '<path data-muscle="shoulders" class="' +
      regionClass(active, 'shoulders') +
      '" d="M42 72c-14 6-22 20-24 36 8 2 16 2 22-2 4-12 10-22 18-28-6-4-12-6-16-6zm76 0c14 6 22 20 24 36-8 2-16 2-22-2-4-12-10-22-18-28 6-4 12-6 16-6z"/>' +
      // Lats + mid-back V-taper
      '<path data-muscle="back" class="' +
      regionClass(active, 'back') +
      '" d="M50 78c8-6 20-8 30-8s22 2 30 8c4 18 6 40 2 62-8 8-20 12-32 12s-24-4-32-12c-4-22-2-44 2-62zm26 4v54c4 2 8 2 12 0V82c-4-2-8-2-12 0z"/>' +
      // Triceps
      '<path data-muscle="arms" class="' +
      regionClass(active, 'arms') +
      '" d="M30 108c-8 10-10 28-8 46 6 4 12 6 16 4 0-14 2-28 6-40-4-4-10-8-14-10zm100 0c8 10 10 28 8 46-6 4-12 6-16 4 0-14-2-28-6-40 4-4 10-8 14-10z"/>' +
      // Glutes
      '<path data-muscle="glutes" class="' +
      regionClass(active, 'glutes') +
      '" d="M56 188c8-6 16-8 24-8s16 2 24 8c2 10 2 18 0 26-8 4-16 6-24 6s-16-2-24-6c-2-8-2-16 0-26z"/>' +
      // Hamstrings
      '<path data-muscle="hamstrings" class="' +
      regionClass(active, 'hamstrings') +
      '" d="M58 220c-2 0-6 2-8 6-2 18-2 36 2 54 4 2 10 2 14 0 2-18 2-36 0-54-2-4-4-6-8-6zm36 0c-4 0-6 2-8 6-2 18-2 36 0 54 4 2 10 2 14 0 4-18 4-36 2-54-2-4-6-6-8-6z"/>' +
      '</svg>'
    );
  }

  function legendHtml(counts) {
    var bits = GROUP_IDS.filter(function (id) {
      return counts[id] > 0;
    }).map(function (id) {
      return (
        '<li class="mm-legend-item"><span class="mm-legend-swatch" aria-hidden="true"></span>' +
        escapeHtml(GROUP_LABELS[id]) +
        '</li>'
      );
    });
    if (!bits.length) {
      return '<p class="mm-empty">No clear muscle targets detected yet.</p>';
    }
    return '<ul class="mm-legend">' + bits.join('') + '</ul>';
  }

  function renderPair(exercises, opts) {
    opts = opts || {};
    var counts = collectActiveGroups(exercises);
    var active = {};
    GROUP_IDS.forEach(function (id) {
      active[id] = counts[id] > 0;
    });
    var title = opts.title || 'Muscles hit';
    var wrapClass = 'mm-pair' + (opts.compact ? ' mm-pair--compact' : '');
    return (
      '<div class="' +
      wrapClass +
      '" role="group" aria-label="' +
      escapeHtml(title) +
      '">' +
      '<p class="mm-pair-title">' +
      escapeHtml(title) +
      '</p>' +
      '<div class="mm-pair-figures">' +
      '<figure class="mm-figure"><figcaption>Front</figcaption>' +
      frontSvg(active) +
      '</figure>' +
      '<figure class="mm-figure"><figcaption>Back</figcaption>' +
      backSvg(active) +
      '</figure>' +
      '</div>' +
      legendHtml(counts) +
      '</div>'
    );
  }

  function polarPoint(cx, cy, radius, angleRad) {
    return {
      x: cx + Math.sin(angleRad) * radius,
      y: cy - Math.cos(angleRad) * radius,
    };
  }

  function polygonPoints(cx, cy, radius, n, values) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var t = values ? Math.max(0, Math.min(1, values[i])) : 1;
      var p = polarPoint(cx, cy, radius * t, (i * 2 * Math.PI) / n);
      pts.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
    }
    return pts.join(' ');
  }

  function estimateSpectrum(exercises) {
    var reps = [];
    (exercises || []).forEach(function (ex) {
      if (!ex) return;
      var sets = Array.isArray(ex.sets) ? ex.sets : [];
      sets.forEach(function (s) {
        if (s && s.reps != null && !isNaN(Number(s.reps))) reps.push(Number(s.reps));
      });
    });
    if (!reps.length) return 0.5;
    var avg = reps.reduce(function (a, b) {
      return a + b;
    }, 0) / reps.length;
    // 3 reps → power (0), 15+ → volume (1)
    return Math.max(0, Math.min(1, (avg - 3) / 12));
  }

  function renderRadar(exercises, opts) {
    opts = opts || {};
    var axes = opts.axes || (opts.hex ? HEX_AXES : RADAR_AXES);
    var values;
    if (opts.hex) {
      var scored = collectHexE1rmScores(exercises, opts);
      values = axes.map(function (axis) {
        var v = scored.values[axis.id] || 0;
        if (!v) return 0.1;
        return 0.1 + v * 0.9;
      });
    } else {
      var rawCounts = collectActiveGroups(exercises);
      var counts =
        opts.axes && opts.axes[0] && opts.axes[0].from
          ? aggregateBroadCounts(rawCounts, axes)
          : rawCounts;
      var max = 0;
      axes.forEach(function (axis) {
        if (counts[axis.id] > max) max = counts[axis.id];
      });
      values = axes.map(function (axis) {
        if (!max) return 0.14;
        return 0.22 + (counts[axis.id] / max) * 0.78;
      });
    }
    var n = axes.length;
    var size = opts.size || (opts.hex ? 340 : 280);
    var cx = size / 2;
    var cy = size / 2;
    var r = opts.radius || (opts.hex ? 112 : 96);
    var hexStroke = opts.hex ? ' stroke="currentColor" stroke-width="1.4"' : '';
    var hexRingStroke = opts.hex
      ? ' fill="none" stroke="currentColor" stroke-width="1.35" opacity="0.45"'
      : '';
    var spokes = '';
    var labels = '';
    for (var i = 0; i < n; i++) {
      var tip = polarPoint(cx, cy, r, (i * 2 * Math.PI) / n - Math.PI / 2);
      var lab = polarPoint(cx, cy, r + (opts.hex ? 28 : 22), (i * 2 * Math.PI) / n - Math.PI / 2);
      spokes +=
        '<line class="mm-radar-spoke" x1="' +
        cx +
        '" y1="' +
        cy +
        '" x2="' +
        tip.x.toFixed(1) +
        '" y2="' +
        tip.y.toFixed(1) +
        '"' +
        hexStroke +
        '/>';
      labels +=
        '<text class="mm-radar-label" x="' +
        lab.x.toFixed(1) +
        '" y="' +
        lab.y.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="middle"' +
        (opts.hex ? ' fill="currentColor"' : '') +
        '>' +
        escapeHtml(axes[i].label) +
        '</text>';
    }
    var fillPts = [];
    for (var j = 0; j < n; j++) {
      var t = Math.max(0, Math.min(1, values[j]));
      var p = polarPoint(cx, cy, r * t, (j * 2 * Math.PI) / n - Math.PI / 2);
      fillPts.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
    }
    var ringPts = [0.33, 0.66, 1]
      .map(function (t) {
        var pts = [];
        for (var k = 0; k < n; k++) {
          var rp = polarPoint(cx, cy, r * t, (k * 2 * Math.PI) / n - Math.PI / 2);
          pts.push(rp.x.toFixed(1) + ',' + rp.y.toFixed(1));
        }
        return (
          '<polygon class="mm-radar-ring" points="' +
          pts.join(' ') +
          '"' +
          hexRingStroke +
          '/>'
        );
      })
      .join('');
    var title = opts.title != null ? opts.title : 'Specialty';
    var showSpectrum = opts.spectrum !== false && !opts.hex;
    var spectrum = showSpectrum ? estimateSpectrum(exercises) : 0.5;
    var wrapClass = 'mm-radar' + (opts.hex ? ' mm-radar--hex' : '');
    var fillAttrs = opts.hex
      ? ' fill="currentColor" fill-opacity="0.28" stroke="currentColor" stroke-width="2.75"'
      : '';
    return (
      '<div class="' +
      wrapClass +
      '" role="img" aria-label="' +
      escapeHtml(title || 'Muscle skills') +
      '">' +
      (title
        ? '<p class="mm-radar-title">' + escapeHtml(title) + '</p>'
        : '') +
      '<svg class="mm-radar-svg" viewBox="0 0 ' +
      size +
      ' ' +
      size +
      '"' +
      (opts.hex ? ' style="color:var(--accent,#ff4d0d)"' : '') +
      '>' +
      ringPts +
      spokes +
      '<polygon class="mm-radar-fill" points="' +
      fillPts.join(' ') +
      '"' +
      fillAttrs +
      '/>' +
      labels +
      '</svg>' +
      (showSpectrum
        ? '<div class="mm-radar-spectrum" aria-hidden="true">' +
          '<span>Power</span>' +
          '<div class="mm-radar-spectrum-track">' +
          '<span class="mm-radar-spectrum-thumb" style="left:' +
          (spectrum * 100).toFixed(1) +
          '%"></span>' +
          '</div>' +
          '<span>Volume</span>' +
          '</div>'
        : '') +
      '</div>'
    );
  }

  function mount(container, exercises, opts) {
    if (!container) return null;
    container.innerHTML = renderPair(exercises, opts);
    return container;
  }

  function exercisesFromDraft(draft) {
    if (!draft) return [];
    if (Array.isArray(draft.exercises)) return draft.exercises;
    return [];
  }

  window.MuscleMap = {
    GROUP_IDS: GROUP_IDS,
    GROUP_LABELS: GROUP_LABELS,
    HEX_AXES: HEX_AXES,
    HEX_E1RM_TARGETS_LB: HEX_E1RM_TARGETS_LB,
    collectActiveGroups: collectActiveGroups,
    collectHexE1rmScores: collectHexE1rmScores,
    aggregateBroadCounts: aggregateBroadCounts,
    renderPair: renderPair,
    renderRadar: renderRadar,
    mount: mount,
    exercisesFromDraft: exercisesFromDraft,
  };
})();
