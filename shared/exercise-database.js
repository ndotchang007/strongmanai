(function () {
  var CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'events', label: 'Events' },
    { id: 'press', label: 'Press' },
    { id: 'squat_dead', label: 'Squat & pull' },
    { id: 'carry', label: 'Carry & load' },
    { id: 'accessory', label: 'Accessory' },
  ];

  var CATALOG = [
    { name: 'Log press', category: 'press', equipment: 'SM', aliases: ['log clean and press', 'log cp'] },
    { name: 'Axle press', category: 'press', equipment: 'BB', aliases: ['axle clean and press', 'axle cp'] },
    { name: 'Circus dumbbell press', category: 'press', equipment: 'DB', aliases: ['cdb press', 'circus db'] },
    { name: 'Overhead press', category: 'press', equipment: 'BB', aliases: ['ohp', 'strict press', 'military press'] },
    { name: 'Bench press', category: 'press', equipment: 'BB', aliases: ['bench', 'flat bench'] },
    { name: 'Incline bench press', category: 'press', equipment: 'BB', aliases: ['incline bench'] },
    { name: 'Chest fly', category: 'press', equipment: 'DB', aliases: ['pec fly', 'dumbbell fly', 'cable fly', 'chest flies'] },
    { name: 'Push press', category: 'press', equipment: 'BB', aliases: [] },
    { name: 'Viking press', category: 'press', equipment: 'SM', aliases: [] },
    { name: 'Back squat', category: 'squat_dead', equipment: 'BB', aliases: ['squat', 'barbell squat'] },
    { name: 'Front squat', category: 'squat_dead', equipment: 'BB', aliases: [] },
    { name: 'Deadlift', category: 'squat_dead', equipment: 'BB', aliases: ['conventional deadlift'] },
    { name: 'Sumo deadlift', category: 'squat_dead', equipment: 'BB', aliases: ['sumo'] },
    { name: 'Deficit deadlift', category: 'squat_dead', equipment: 'BB', aliases: [] },
    { name: 'Romanian deadlift', category: 'squat_dead', equipment: 'BB', aliases: ['rdl'] },
    { name: 'Trap bar deadlift', category: 'squat_dead', equipment: 'BB', aliases: ['hex bar deadlift'] },
    { name: 'Atlas stones', category: 'events', equipment: 'SM', aliases: ['stone load', 'stone to platform'] },
    { name: 'Yoke walk', category: 'events', equipment: 'SM', aliases: ['yoke', 'yoke carry'] },
    { name: "Farmer's walk", category: 'events', equipment: 'SM', aliases: ['farmers carry', 'farmers walk'] },
    { name: 'Sandbag load', category: 'events', equipment: 'SM', aliases: ['sandbag to platform', 'sandbag carry'] },
    { name: 'Sandbag carry', category: 'events', equipment: 'SM', aliases: [] },
    { name: 'Tire flip', category: 'events', equipment: 'SM', aliases: ['tire'] },
    { name: 'Truck pull', category: 'events', equipment: 'SM', aliases: ['vehicle pull'] },
    { name: 'Husafell stone', category: 'events', equipment: 'SM', aliases: ['husafell carry', 'husafell'] },
    { name: 'Loading race', category: 'events', equipment: 'SM', aliases: ['loading medley'] },
    { name: 'Frame carry', category: 'events', equipment: 'SM', aliases: ['super yoke', 'frame walk'] },
    { name: 'Keg toss', category: 'events', equipment: 'SM', aliases: ['keg load'] },
    { name: 'Car deadlift', category: 'events', equipment: 'SM', aliases: ['car dl', 'silver dollar deadlift'] },
    { name: "Conan's wheel", category: 'events', equipment: 'SM', aliases: ['conans wheel'] },
    { name: "Fingal's fingers", category: 'events', equipment: 'SM', aliases: ['fingals fingers'] },
    { name: 'Natural stone press', category: 'events', equipment: 'SM', aliases: ['stone press'] },
    { name: 'Dumbbell row', category: 'accessory', equipment: 'DB', aliases: ['db row', 'single arm row'] },
    { name: 'Barbell row', category: 'accessory', equipment: 'BB', aliases: ['pendlay row', 'bent over row'] },
    { name: 'Row', category: 'accessory', equipment: 'BB', aliases: ['bent over row'] },
    { name: 'Pull-up', category: 'accessory', equipment: 'BW', aliases: ['pullups', 'chin-up'] },
    { name: 'Lat pulldown', category: 'accessory', equipment: 'CB', aliases: [] },
    { name: 'Dumbbell curl', category: 'accessory', equipment: 'DB', aliases: ['db curl', 'bicep curl'] },
    { name: 'Curl', category: 'accessory', equipment: 'BB', aliases: ['bicep curl', 'barbell curl'] },
    { name: 'Tricep pushdown', category: 'accessory', equipment: 'CB', aliases: ['cable pushdown'] },
    { name: 'Tricep extension', category: 'accessory', equipment: 'DB', aliases: ['skull crusher', 'overhead extension'] },
    { name: 'Face pull', category: 'accessory', equipment: 'CB', aliases: [] },
    { name: 'Lateral raise', category: 'accessory', equipment: 'DB', aliases: ['side raise'] },
    { name: 'Hammer curl', category: 'accessory', equipment: 'DB', aliases: [] },
    { name: 'Good morning', category: 'accessory', equipment: 'BB', aliases: [] },
    { name: 'Hip thrust', category: 'accessory', equipment: 'BB', aliases: ['glute bridge barbell'] },
    { name: 'Leg press', category: 'accessory', equipment: 'SM', aliases: [] },
    { name: 'Leg curl', category: 'accessory', equipment: 'SM', aliases: [] },
    { name: 'Leg extension', category: 'accessory', equipment: 'SM', aliases: [] },
    { name: 'Calf raise', category: 'accessory', equipment: 'SM', aliases: [] },
    { name: 'Ab wheel rollout', category: 'accessory', equipment: 'BW', aliases: ['rollout'] },
    { name: 'Pallof press', category: 'accessory', equipment: 'CB', aliases: [] },
  ];

  var EQUIP_LABELS = {
    BB: 'Barbell',
    DB: 'Dumbbell',
    KB: 'Kettlebell',
    CB: 'Cable',
    BW: 'Bodyweight',
    SM: 'Strongman',
  };

  var VARIANT_DEFS = [
    { id: 'barbell', label: 'Barbell', equip: 'BB' },
    { id: 'dumbbell', label: 'Dumbbell', equip: 'DB' },
    { id: 'single_arm', label: 'Single arm', equip: 'DB' },
    { id: 'cable', label: 'Cable', equip: 'CB' },
    { id: 'machine', label: 'Machine', equip: 'SM' },
    { id: 'bodyweight', label: 'Bodyweight', equip: 'BW' },
    { id: 'kettlebell', label: 'Kettlebell', equip: 'KB' },
    { id: 'strongman', label: 'Strongman', equip: 'SM' },
  ];

  /** Base movements users pick first; then choose a variant (barbell, dumbbell, etc.). */
  var MOVEMENTS = [
    { name: 'Bench press', category: 'press', variants: ['barbell', 'dumbbell', 'single_arm', 'machine'] },
    { name: 'Incline bench press', category: 'press', variants: ['barbell', 'dumbbell', 'machine'] },
    { name: 'Chest fly', category: 'press', variants: ['dumbbell', 'cable', 'machine', 'single_arm'] },
    { name: 'Overhead press', category: 'press', variants: ['barbell', 'dumbbell', 'single_arm', 'machine'] },
    { name: 'Push press', category: 'press', variants: ['barbell', 'dumbbell'] },
    { name: 'Log press', category: 'press', variants: ['strongman'] },
    { name: 'Axle press', category: 'press', variants: ['barbell', 'strongman'] },
    { name: 'Circus dumbbell press', category: 'press', variants: ['dumbbell', 'single_arm'] },
    { name: 'Viking press', category: 'press', variants: ['strongman', 'machine'] },
    { name: 'Back squat', category: 'squat_dead', variants: ['barbell', 'machine'] },
    { name: 'Front squat', category: 'squat_dead', variants: ['barbell', 'dumbbell'] },
    { name: 'Deadlift', category: 'squat_dead', variants: ['barbell', 'trap_bar', 'dumbbell'] },
    { name: 'Romanian deadlift', category: 'squat_dead', variants: ['barbell', 'dumbbell', 'single_arm'] },
    { name: 'Sumo deadlift', category: 'squat_dead', variants: ['barbell'] },
    { name: 'Trap bar deadlift', category: 'squat_dead', variants: ['barbell'] },
    { name: 'Atlas stones', category: 'events', variants: ['strongman'] },
    { name: 'Yoke walk', category: 'events', variants: ['strongman'] },
    { name: "Farmer's walk", category: 'events', variants: ['strongman', 'dumbbell', 'kettlebell'] },
    { name: 'Sandbag load', category: 'events', variants: ['strongman'] },
    { name: 'Sandbag carry', category: 'events', variants: ['strongman'] },
    { name: 'Tire flip', category: 'events', variants: ['strongman'] },
    { name: 'Truck pull', category: 'events', variants: ['strongman'] },
    { name: 'Row', category: 'accessory', variants: ['barbell', 'dumbbell', 'single_arm', 'cable', 'machine'] },
    { name: 'Pull-up', category: 'accessory', variants: ['bodyweight', 'machine'] },
    { name: 'Lat pulldown', category: 'accessory', variants: ['cable', 'machine'] },
    { name: 'Curl', category: 'accessory', variants: ['barbell', 'dumbbell', 'cable', 'single_arm'] },
    { name: 'Hammer curl', category: 'accessory', variants: ['dumbbell', 'cable'] },
    { name: 'Tricep pushdown', category: 'accessory', variants: ['cable', 'machine'] },
    { name: 'Tricep extension', category: 'accessory', variants: ['dumbbell', 'cable', 'single_arm', 'machine'] },
    { name: 'Lateral raise', category: 'accessory', variants: ['dumbbell', 'cable', 'single_arm', 'machine'] },
    { name: 'Face pull', category: 'accessory', variants: ['cable'] },
    { name: 'Hip thrust', category: 'accessory', variants: ['barbell', 'machine'] },
    { name: 'Leg press', category: 'accessory', variants: ['machine'] },
    { name: 'Leg curl', category: 'accessory', variants: ['machine', 'dumbbell'] },
    { name: 'Leg extension', category: 'accessory', variants: ['machine'] },
    { name: 'Calf raise', category: 'accessory', variants: ['machine', 'dumbbell', 'barbell'] },
    { name: 'Good morning', category: 'accessory', variants: ['barbell'] },
    { name: 'Ab wheel rollout', category: 'accessory', variants: ['bodyweight'] },
    { name: 'Pallof press', category: 'accessory', variants: ['cable'] },
  ];

  // Alias trap_bar onto barbell-style labeling for deadlifts
  VARIANT_DEFS.push({ id: 'trap_bar', label: 'Trap bar', equip: 'BB' });

  var QUICK_PICKS = [
    'Bench press',
    'Chest fly',
    'Overhead press',
    'Deadlift',
    'Back squat',
    'Row',
    'Curl',
    'Lateral raise',
  ];

  function variantById(id) {
    for (var i = 0; i < VARIANT_DEFS.length; i++) {
      if (VARIANT_DEFS[i].id === id) return VARIANT_DEFS[i];
    }
    return null;
  }

  function listMovements(opts) {
    opts = opts || {};
    var q = opts.q || '';
    var category = opts.category || 'all';
    var limit = opts.limit || 40;
    return MOVEMENTS.filter(function (m) {
      if (category && category !== 'all' && m.category !== category) return false;
      if (!q) return true;
      return normalize(m.name).indexOf(normalize(q)) !== -1;
    }).slice(0, limit);
  }

  function findMovement(name) {
    var n = normalize(name);
    if (!n) return null;
    for (var i = 0; i < MOVEMENTS.length; i++) {
      if (normalize(MOVEMENTS[i].name) === n) return MOVEMENTS[i];
    }
    return null;
  }

  function variantsForMovement(movementName) {
    var m = findMovement(movementName);
    if (!m) return VARIANT_DEFS.slice(0, 6);
    return (m.variants || []).map(variantById).filter(Boolean);
  }

  function formatExerciseName(movementName, variantId) {
    var base = String(movementName || '').trim();
    if (!base) return '';
    var v = variantById(variantId);
    if (!v) return base;
    if (variantId === 'single_arm') return 'Single-arm ' + base;
    if (v.label.toLowerCase() === 'strongman' && /press|walk|stones|load|carry|flip|pull/i.test(base)) {
      return base;
    }
    return base + ' (' + v.label + ')';
  }

  function parseExerciseName(fullName) {
    var raw = String(fullName || '').trim();
    var single = /^single[- ]?arm\s+(.+)$/i.exec(raw);
    if (single) {
      return { movement: single[1].trim(), variantId: 'single_arm' };
    }
    var paren = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(raw);
    if (paren) {
      var label = paren[2].trim().toLowerCase();
      for (var i = 0; i < VARIANT_DEFS.length; i++) {
        if (VARIANT_DEFS[i].label.toLowerCase() === label) {
          return { movement: paren[1].trim(), variantId: VARIANT_DEFS[i].id };
        }
      }
    }
    var found = findMovement(raw) || findByName(raw);
    return { movement: found ? found.name : raw, variantId: found && found.equipment ? equipToDefaultVariant(found.equipment) : null };
  }

  function equipToDefaultVariant(code) {
    var map = { BB: 'barbell', DB: 'dumbbell', CB: 'cable', BW: 'bodyweight', KB: 'kettlebell', SM: 'strongman' };
    return map[code] || null;
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function matches(ex, q, category) {
    if (category && category !== 'all' && ex.category !== category) return false;
    if (!q) return true;
    var hay = normalize([ex.name, ex.equipment, (ex.aliases || []).join(' ')].join(' '));
    var terms = normalize(q).split(/\s+/).filter(Boolean);
    return terms.every(function (t) {
      return hay.indexOf(t) !== -1;
    });
  }

  function search(opts) {
    opts = opts || {};
    var q = opts.q || '';
    var category = opts.category || 'all';
    var limit = opts.limit || 24;
    return CATALOG.filter(function (ex) {
      return matches(ex, q, category);
    }).slice(0, limit);
  }

  function findByName(name) {
    var n = normalize(name);
    if (!n) return null;
    for (var i = 0; i < CATALOG.length; i++) {
      var ex = CATALOG[i];
      if (normalize(ex.name) === n) return ex;
      if ((ex.aliases || []).some(function (a) { return normalize(a) === n; })) return ex;
    }
    return null;
  }

  function levenshtein(a, b) {
    var m = a.length;
    var n = b.length;
    if (!m) return n;
    if (!n) return m;
    var dp = [];
    var i;
    var j;
    for (i = 0; i <= m; i++) {
      dp[i] = [];
      dp[i][0] = i;
    }
    for (j = 0; j <= n; j++) dp[0][j] = j;
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function suggest(name, limit) {
    limit = limit || 3;
    var n = normalize(name);
    if (!n) return [];
    var scored = [];
    CATALOG.forEach(function (ex) {
      var candidates = [ex.name].concat(ex.aliases || []);
      var best = 0;
      candidates.forEach(function (candidate) {
        var cn = normalize(candidate);
        var score = 0;
        if (cn === n) score = 1000;
        else if (cn.indexOf(n) !== -1 || n.indexOf(cn) !== -1) {
          score = 500 - Math.abs(cn.length - n.length);
        } else {
          var dist = levenshtein(n, cn);
          var threshold = Math.max(2, Math.floor(Math.max(n.length, cn.length) / 3));
          if (dist <= threshold) score = 200 - dist * 15;
        }
        if (score > best) best = score;
      });
      if (best > 0) scored.push({ ex: ex, score: best });
    });
    scored.sort(function (a, b) {
      return b.score - a.score || a.ex.name.localeCompare(b.ex.name);
    });
    var seen = {};
    var out = [];
    for (var i = 0; i < scored.length; i++) {
      if (seen[scored[i].ex.name]) continue;
      seen[scored[i].ex.name] = true;
      out.push(scored[i].ex);
      if (out.length >= limit) break;
    }
    return out;
  }

  function resolveQuery(label) {
    return findByName(label);
  }

  function equipmentLabel(code) {
    return EQUIP_LABELS[code] || code || '';
  }

  function categoryLabel(id) {
    var c = CATEGORIES.find(function (x) { return x.id === id; });
    return c ? c.label : id;
  }

  function applyApiPayload(body) {
    if (!body) return;
    if (Array.isArray(body.exercises) && body.exercises.length) {
      CATALOG.length = 0;
      body.exercises.forEach(function (ex) {
        CATALOG.push(ex);
      });
    }
    if (Array.isArray(body.categories) && body.categories.length) {
      CATEGORIES.length = 0;
      body.categories.forEach(function (cat) {
        CATEGORIES.push(cat);
      });
    }
  }

  function fetchFromApi(opts) {
    if (typeof window.apiGet !== 'function') {
      return Promise.resolve({ exercises: search(opts), categories: CATEGORIES });
    }
    var params = [];
    if (opts && opts.q) params.push('q=' + encodeURIComponent(opts.q));
    if (opts && opts.category && opts.category !== 'all') {
      params.push('category=' + encodeURIComponent(opts.category));
    }
    if (opts && opts.limit) params.push('limit=' + encodeURIComponent(String(opts.limit)));
    var path = '/exercises' + (params.length ? '?' + params.join('&') : '');
    return window.apiGet(path).then(function (body) {
      applyApiPayload(body);
      return body || { exercises: CATALOG.slice(), categories: CATEGORIES.slice() };
    }).catch(function () {
      return { exercises: search(opts), categories: CATEGORIES };
    });
  }

  window.ExerciseDatabase = {
    categories: CATEGORIES,
    catalog: CATALOG,
    movements: MOVEMENTS,
    variants: VARIANT_DEFS,
    quickPicks: QUICK_PICKS,
    search: search,
    findByName: findByName,
    suggest: suggest,
    resolveQuery: resolveQuery,
    equipmentLabel: equipmentLabel,
    categoryLabel: categoryLabel,
    listMovements: listMovements,
    findMovement: findMovement,
    variantsForMovement: variantsForMovement,
    formatExerciseName: formatExerciseName,
    parseExerciseName: parseExerciseName,
    variantById: variantById,
    fetch: fetchFromApi,
  };
})();
