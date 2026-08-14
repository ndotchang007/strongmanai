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
    { name: 'Log press', category: 'press', equipment: 'SM', minIncrement: 10, aliases: ['log clean and press', 'log cp'] },
    { name: 'Axle press', category: 'press', equipment: 'BB', minIncrement: 5, aliases: ['axle clean and press', 'axle cp'] },
    { name: 'Circus dumbbell press', category: 'press', equipment: 'DB', minIncrement: 5, aliases: ['cdb press', 'circus db'] },
    { name: 'Overhead press', category: 'press', equipment: 'BB', minIncrement: 5, aliases: ['ohp', 'strict press', 'military press'] },
    { name: 'Bench press', category: 'press', equipment: 'BB', minIncrement: 5, aliases: ['bench', 'flat bench'] },
    { name: 'Incline bench press', category: 'press', equipment: 'BB', minIncrement: 5, aliases: ['incline bench'] },
    { name: 'Chest fly', category: 'press', equipment: 'DB', minIncrement: 5, aliases: ['pec fly', 'dumbbell fly', 'cable fly', 'chest flies'] },
    { name: 'Push press', category: 'press', equipment: 'BB', minIncrement: 5, aliases: [] },
    { name: 'Viking press', category: 'press', equipment: 'SM', minIncrement: 10, aliases: [] },
    { name: 'Back squat', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: ['squat', 'barbell squat'] },
    { name: 'Front squat', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: [] },
    { name: 'Deadlift', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: ['conventional deadlift'] },
    { name: 'Sumo deadlift', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: ['sumo'] },
    { name: 'Deficit deadlift', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: [] },
    { name: 'Romanian deadlift', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: ['rdl'] },
    { name: 'Trap bar deadlift', category: 'squat_dead', equipment: 'BB', minIncrement: 5, aliases: ['hex bar deadlift'] },
    { name: 'Atlas stones', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['stone load', 'stone to platform'] },
    { name: 'Yoke walk', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['yoke', 'yoke carry'] },
    { name: "Farmer's walk", category: 'events', equipment: 'SM', aliases: ['farmers carry', 'farmers walk'] },
    { name: 'Sandbag load', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['sandbag to platform', 'sandbag carry'] },
    { name: 'Sandbag carry', category: 'events', equipment: 'SM', minIncrement: 10, aliases: [] },
    { name: 'Tire flip', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['tire'] },
    { name: 'Truck pull', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['vehicle pull'] },
    { name: 'Husafell stone', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['husafell carry', 'husafell'] },
    { name: 'Loading race', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['loading medley'] },
    { name: 'Frame carry', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['super yoke', 'frame walk'] },
    { name: 'Keg toss', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['keg load'] },
    { name: 'Car deadlift', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['car dl', 'silver dollar deadlift'] },
    { name: "Conan's wheel", category: 'events', equipment: 'SM', aliases: ['conans wheel'] },
    { name: "Fingal's fingers", category: 'events', equipment: 'SM', aliases: ['fingals fingers'] },
    { name: 'Natural stone press', category: 'events', equipment: 'SM', minIncrement: 10, aliases: ['stone press'] },
    { name: 'Dumbbell row', category: 'accessory', equipment: 'DB', minIncrement: 5, aliases: ['db row', 'single arm row'] },
    { name: 'Barbell row', category: 'accessory', equipment: 'BB', minIncrement: 5, aliases: ['pendlay row', 'bent over row'] },
    { name: 'Row', category: 'accessory', equipment: 'BB', minIncrement: 5, aliases: ['bent over row'] },
    { name: 'Pull-up', category: 'accessory', equipment: 'BW', minIncrement: 0, aliases: ['pullups', 'chin-up'] },
    { name: 'Lat pulldown', category: 'accessory', equipment: 'CB', minIncrement: 2.5, aliases: [] },
    { name: 'Dumbbell curl', category: 'accessory', equipment: 'DB', minIncrement: 5, aliases: ['db curl', 'bicep curl'] },
    { name: 'Curl', category: 'accessory', equipment: 'BB', minIncrement: 5, aliases: ['bicep curl', 'barbell curl'] },
    { name: 'Tricep pushdown', category: 'accessory', equipment: 'CB', minIncrement: 2.5, aliases: ['cable pushdown'] },
    { name: 'Tricep extension', category: 'accessory', equipment: 'DB', minIncrement: 5, aliases: ['skull crusher', 'overhead extension'] },
    { name: 'Face pull', category: 'accessory', equipment: 'CB', minIncrement: 2.5, aliases: [] },
    { name: 'Lateral raise', category: 'accessory', equipment: 'DB', minIncrement: 5, aliases: ['side raise'] },
    { name: 'Hammer curl', category: 'accessory', equipment: 'DB', minIncrement: 5, aliases: [] },
    { name: 'Good morning', category: 'accessory', equipment: 'BB', minIncrement: 5, aliases: [] },
    { name: 'Hip thrust', category: 'accessory', equipment: 'BB', minIncrement: 5, aliases: ['glute bridge barbell'] },
    { name: 'Leg press', category: 'accessory', equipment: 'SM', minIncrement: 10, aliases: [] },
    { name: 'Leg curl', category: 'accessory', equipment: 'SM', minIncrement: 10, aliases: [] },
    { name: 'Leg extension', category: 'accessory', equipment: 'SM', minIncrement: 10, aliases: [] },
    { name: 'Calf raise', category: 'accessory', equipment: 'SM', minIncrement: 10, aliases: [] },
    { name: 'Ab wheel rollout', category: 'accessory', equipment: 'BW', minIncrement: 0, aliases: ['rollout'] },
    { name: 'Pallof press', category: 'accessory', equipment: 'CB', minIncrement: 2.5, aliases: [] },
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
    { id: 'barbell', label: 'Barbell', equip: 'BB' , minIncrement: 5 },
    { id: 'dumbbell', label: 'Dumbbell', equip: 'DB' , minIncrement: 5 },
    { id: 'single_arm', label: 'Single arm', equip: 'DB' , minIncrement: 5 },
    { id: 'cable', label: 'Cable', equip: 'CB' , minIncrement: 2.5 },
    { id: 'machine', label: 'Machine', equip: 'SM' , minIncrement: 10 },
    { id: 'bodyweight', label: 'Bodyweight', equip: 'BW' , minIncrement: 0 },
    { id: 'kettlebell', label: 'Kettlebell', equip: 'KB' , minIncrement: 5 },
    { id: 'strongman', label: 'Strongman', equip: 'SM' , minIncrement: 10 },
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
  VARIANT_DEFS.push({ id: 'trap_bar', label: 'Trap bar', equip: 'BB' , minIncrement: 5 });

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
        var row = Object.assign({}, ex);
        if (row.minIncrement == null && row.equipment) {
          var defaults = { BB: 5, DB: 5, KB: 5, CB: 2.5, BW: 0, SM: 10 };
          row.minIncrement = defaults[row.equipment] != null ? defaults[row.equipment] : 5;
        }
        CATALOG.push(row);
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

  function getMinIncrement(opts) {
    opts = typeof opts === 'string' ? { name: opts } : opts || {};
    var metric = !!opts.metric;
    if (!metric && window.Units && typeof window.Units.getUnits === 'function') {
      metric = window.Units.getUnits() === 'metric';
    }
    var lb = 5;
    var variantId = opts.variantId || null;
    var name = opts.name || '';
    if (!variantId && name) {
      var parsed = parseExerciseName(name);
      variantId = parsed.variantId || null;
      if (parsed.movement) name = parsed.movement;
    }
    if (variantId) {
      var v = variantById(variantId);
      if (v && v.minIncrement != null) lb = Number(v.minIncrement);
    } else {
      var ex = findByName(name) || findByName(opts.name);
      if (ex && ex.minIncrement != null) lb = Number(ex.minIncrement);
      else if (ex && ex.equipment) {
        var defaults = { BB: 5, DB: 5, KB: 5, CB: 2.5, BW: 0, SM: 10 };
        lb = defaults[ex.equipment] != null ? defaults[ex.equipment] : 5;
      }
    }
    if (!(lb >= 0)) lb = 5;
    if (metric) {
      if (lb === 0) return 0;
      if (lb <= 2.5) return 1.25;
      if (lb <= 5) return 2.5;
      return 5;
    }
    return lb;
  }

  function inferPrimaryMuscles(name) {
    var n = normalize(name);
    if (!n) return '';
    if (/bench|chest|fly|pec|push-?up/.test(n) && !/tricep/.test(n)) return 'chest, triceps, shoulders';
    if (/overhead press|shoulder press|military|ohp|lateral raise|rear delt/.test(n)) return 'shoulders';
    if (/squat|leg press|lunge|leg extension/.test(n)) return 'quads, glutes';
    if (/deadlift|rdl|good morning|hip thrust|leg curl|ham/.test(n)) return 'hamstrings, glutes, back';
    if (/row|pulldown|pull-?up|chin|lat /.test(n)) return 'back, biceps';
    if (/curl|hammer/.test(n) && !/leg curl/.test(n)) return 'biceps';
    if (/tricep|pushdown|skull|extension/.test(n) && !/leg extension/.test(n)) return 'triceps';
    if (/calf/.test(n)) return 'calves';
    if (/ab wheel|pallof|plank|core/.test(n)) return 'core';
    if (/yoke|farmer|sandbag|atlas|tire|frame|carry|load|husafell|conan|fingal/.test(n)) {
      return 'full body, grip';
    }
    if (/log press|axle press|circus|viking/.test(n)) return 'shoulders, triceps, core';
    return '';
  }

  var FORM_TIPS = {
    'Bench press':
      'Plant feet flat, slight arch, retract scapulae. Lower the bar to mid-chest with control, then press up without bouncing. Keep wrists stacked over elbows.',
    'Incline bench press':
      'Set the bench ~30–45°. Keep shoulders packed, lower to upper chest, and press without letting elbows flare wildly.',
    'Chest fly':
      'Soft elbow bend throughout. Open until you feel a stretch across the chest, then squeeze back. Don’t go so deep that shoulders roll forward.',
    'Overhead press':
      'Brace your core, ribs down. Press the bar/DBs straight up over mid-foot. Avoid excessive lower-back arch; lock out overhead without shrugging into your ears.',
    'Push press':
      'Dip briefly through the hips and knees, then drive up and finish with an overhead lockout. Keep the torso upright — don’t turn it into a thruster.',
    'Log press':
      'Clean the log tight to your chest, elbows high. Dip and drive, then punch the log overhead. Keep the midsection braced the whole way.',
    'Axle press':
      'Use a false or mixed grip if needed. Brace hard, press in a straight line, and keep the axle close to your face on the way up.',
    'Circus dumbbell press':
      'Clean to the shoulder, get under it, then press with a slight lean away. Keep the wrist stacked and core tight.',
    'Back squat':
      'Brace before you unrack. Sit between your hips, keep knees tracking over toes, and drive up through mid-foot. Chest up without collapsing forward.',
    'Front squat':
      'Elbows high, torso upright. Sit down between the hips; if elbows drop, the bar will roll. Drive up tall.',
    'Deadlift':
      'Bar over mid-foot, hips hinge, lats tight. Push the floor away and keep the bar close. Lock out by standing tall — don’t hyperextend the low back.',
    'Romanian deadlift':
      'Soft knees, push hips back, keep a flat back. Feel the hamstring stretch, then drive hips forward to stand. Bar stays close to legs.',
    'Sumo deadlift':
      'Wide stance, toes out, shins vertical at the start. Push knees out, keep chest tall, and lock out without shrugging.',
    'Trap bar deadlift':
      'Stand centered in the handles. Hinge, brace, then drive through the floor. Think squat-hinge hybrid — tall finish.',
    'Row':
      'Hinge at the hips, flat back. Pull toward the lower ribs/hip pocket, squeeze the shoulder blades, then control the lower. Don’t yank with momentum.',
    'Pull-up':
      'Full hang to start. Pull elbows down/back until chin clears the bar, then lower with control. Avoid excessive kipping unless programmed.',
    'Lat pulldown':
      'Thumb-over or normal grip — lean slightly back. Pull the bar to upper chest, lead with elbows, then return without letting shoulders shrug up.',
    'Curl':
      'Elbows pinned near your sides. Curl without swinging; squeeze at the top, lower slowly. Don’t let shoulders roll forward.',
    'Hammer curl':
      'Neutral grip, elbows still. Curl without torso lean. Control the eccentric — this is great for forearms and elbow-friendly biceps work.',
    'Tricep pushdown':
      'Elbows glued to your sides. Push down to full extension without shrugging, then return only as far as you keep tension on the triceps.',
    'Tricep extension':
      'Keep elbows pointed up/forward (not flaring). Lower with control, then extend fully without locking out aggressively if elbows are cranky.',
    'Lateral raise':
      'Slight elbow bend, raise to about shoulder height. Lead with elbows, pinkies slightly up. Don’t shrug — think “pour a pitcher” gently.',
    'Face pull':
      'Pull toward your face/forehead with elbows high. Externally rotate at the end (thumbs back). Squeeze rear delts — don’t turn it into a row to the belly.',
    'Hip thrust':
      'Upper back on the bench, chin tucked lightly. Drive through heels to a full hip lockout and squeeze glutes. Avoid overarching the lumbar spine.',
    'Leg press':
      'Feet mid-platform. Lower until knees track comfortably, then press without locking out aggressively. Keep low back glued to the pad.',
    'Leg curl':
      'Hips pinned down. Curl through a full range without lifting the hips. Squeeze hamstrings at the top.',
    'Leg extension':
      'Pad on lower shins. Extend fully without snapping the knees, then lower with control. Soften the finish if knees are sensitive.',
    'Calf raise':
      'Full stretch at the bottom, full squeeze at the top. Pause briefly at both ends — don’t bounce.',
    'Good morning':
      'Soft knees, brace hard, hinge hips back with a flat back. Only go as deep as you can keep tension — this is not a race to depth.',
    'Ab wheel rollout':
      'Brace like someone will punch your stomach. Roll out only as far as you can keep ribs down, then pull back. Don’t dump into the low back.',
    'Pallof press':
      'Stand tall, cable at mid-chest. Press arms straight out and resist rotation. Hold briefly, then return. Brace — don’t lean into the cable.',
    "Farmer's walk":
      'Tall posture, shoulders packed, knuckles forward. Short quick steps. Don’t let the implements yank your shoulders down.',
    'Yoke walk':
      'Set the yoke on traps (not neck). Brace hard, take short steps, stay tall. Soft knees — don’t lock out every step.',
    'Atlas stones':
      'Hug the stone low, lap it, then roll it up the torso and load. Keep the stone close and use your hips — protect the low back.',
    'Tire flip':
      'Get low, hands under the tread, drive through the legs, then punch/push the tire over. Don’t round hard and yank with the arms alone.',
  };

  var DEFAULT_FORM_TIP =
    'Brace your core, move through a controlled full range, and stop any set where form breaks down. Prioritize smooth reps over max load.';

  function getFormTips(name) {
    if (!name) return DEFAULT_FORM_TIP;
    var parsed = parseExerciseName(name);
    var key = (parsed && parsed.movement) || name;
    if (FORM_TIPS[key]) return FORM_TIPS[key];
    var found = findMovement(key) || findByName(key);
    if (found && FORM_TIPS[found.name]) return FORM_TIPS[found.name];
    var n = normalize(key);
    for (var tipName in FORM_TIPS) {
      if (normalize(tipName) === n) return FORM_TIPS[tipName];
    }
    var muscles = inferPrimaryMuscles(key);
    if (muscles) {
      return 'Focus on ' + muscles + '. Brace, control the eccentric, and keep tension on the target muscles — stop when form breaks.';
    }
    return DEFAULT_FORM_TIP;
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
    getMinIncrement: getMinIncrement,
    inferPrimaryMuscles: inferPrimaryMuscles,
    getFormTips: getFormTips,
    fetch: fetchFromApi,
  };
})();
