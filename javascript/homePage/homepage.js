(function () {
  // Sidebar: set active tab from body data-current-page
  var currentPage = document.body.getAttribute('data-current-page');
  if (currentPage) {
    document.querySelectorAll('.sidebar-link').forEach(function (link) {
      if (link.getAttribute('data-page') === currentPage) {
        link.classList.add('sidebar-link-active');
      } else {
        link.classList.remove('sidebar-link-active');
      }
    });
  }

  // Welcome message: time-aware greeting + first name when available
  var welcomeEl = document.getElementById('home-welcome-title');
  if (welcomeEl) {
    var hour = new Date().getHours();
    var timeGreeting = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var firstName = null;
    if (typeof window.getCurrentUser === 'function') {
      var user = window.getCurrentUser();
      if (user && user.firstName) firstName = user.firstName;
    }
    welcomeEl.textContent = firstName ? timeGreeting + ', ' + firstName : timeGreeting;
  }

  // Log daily workout — primary CTA to tracking
  var logDailyBtn = document.getElementById('home-log-daily-workout');
  if (logDailyBtn) {
    logDailyBtn.addEventListener('click', function () {
      window.location.href = '/tracking';
    });
  }

  // Leaderboard table from API — scope uses server-backed follows / mutual friends.
  var leaderboardBody = document.getElementById('leaderboard-body');
  var homeLbUsers = null;
  var homeFollowingIds = [];
  var homeFriendIds = [];
  var homeLbScope = 'global';

  function sortHomeLbUsers(users) {
    var list = (users || []).slice();
    list.sort(function (a, b) {
      var wa = a.weight != null ? Number(a.weight) : -Infinity;
      var wb = b.weight != null ? Number(b.weight) : -Infinity;
      return wb - wa;
    });
    return list;
  }

  function idAllowSet(ids) {
    var s = {};
    if (Array.isArray(ids)) {
      ids.forEach(function (raw) {
        var n = Number(raw);
        if (Number.isFinite(n)) s[n] = true;
      });
    }
    return s;
  }

  function fetchScopeLists(scope) {
    var cu = window.getCurrentUser();
    homeFollowingIds = [];
    homeFriendIds = [];
    if (!leaderboardBody || typeof window.apiGet !== 'function') return Promise.resolve();
    if (!cu || !cu.token || scope === 'global') return Promise.resolve();
    if (scope === 'followers') {
      return window
        .apiGet('/users/me/following')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (ids) {
          homeFollowingIds = Array.isArray(ids) ? ids : [];
        });
    }
    if (scope === 'friends') {
      return window
        .apiGet('/users/me/friends')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (ids) {
          homeFriendIds = Array.isArray(ids) ? ids : [];
        });
    }
    return Promise.resolve();
  }

  function renderHomeLeaderboardTable() {
    if (!leaderboardBody) return;

    function escCell(s) {
      var d = document.createElement('div');
      d.textContent = s == null ? '' : String(s);
      return d.innerHTML;
    }
    function userNameCell(user) {
      var name = escCell(user.username || '–');
      if (user.id == null) return name;
      return (
        '<a class="home-lb-user-link" href="/profile?id=' +
        encodeURIComponent(String(user.id)) +
        '">' +
        name +
        '</a>'
      );
    }

    var currentUser = window.getCurrentUser();
    var base = Array.isArray(homeLbUsers) ? homeLbUsers : [];
    var ranked = sortHomeLbUsers(base);
    var scope = homeLbScope;
    var list = ranked;

    if (scope === 'followers') {
      if (!currentUser || !currentUser.token) {
        leaderboardBody.innerHTML =
          '<tr><td colspan="4">Sign in to see people you follow on this leaderboard.</td></tr>';
        return;
      }
      var fSet = idAllowSet(homeFollowingIds);
      list = ranked.filter(function (u) {
        return (currentUser && u.id === currentUser.id) || fSet[u.id];
      });
    } else if (scope === 'friends') {
      if (!currentUser || !currentUser.token) {
        leaderboardBody.innerHTML =
          '<tr><td colspan="4">Sign in to see mutual friends on this leaderboard.</td></tr>';
        return;
      }
      var mSet = idAllowSet(homeFriendIds);
      list = ranked.filter(function (u) {
        return (currentUser && u.id === currentUser.id) || mSet[u.id];
      });
    }

    leaderboardBody.innerHTML = '';
    if (!list.length) {
      var baseLen = ranked.length;
      if (!baseLen && scope === 'global') {
        leaderboardBody.innerHTML = '<tr><td colspan="4">No users yet.</td></tr>';
        return;
      }
      leaderboardBody.innerHTML =
        '<tr><td colspan="4">No one to show for this view yet.</td></tr>';
      return;
    }

    list.forEach(function (user, i) {
      var tr = document.createElement('tr');
      if (currentUser && currentUser.id === user.id) tr.classList.add('leaderboard-row-user');
      tr.innerHTML =
        '<td>' +
        (i + 1) +
        '</td><td>' +
        userNameCell(user) +
        '</td><td>' +
        escCell(user.weight != null ? user.weight : '–') +
        '</td><td>' +
        escCell(user.height != null ? user.height : '–') +
        '</td>';
      leaderboardBody.appendChild(tr);
    });
  }

  function loadHomeLeaderboard(scope) {
    if (typeof scope === 'string') homeLbScope = scope;
    if (!leaderboardBody || typeof window.apiGet !== 'function') return;
    leaderboardBody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    window.apiGet('/users')
      .then(function (res) {
        return res.json();
      })
      .then(function (users) {
        homeLbUsers = Array.isArray(users) ? users : [];
        return fetchScopeLists(homeLbScope);
      })
      .then(function () {
        renderHomeLeaderboardTable();
      })
      .catch(function () {
        leaderboardBody.innerHTML = '<tr><td colspan="4">Could not load leaderboard.</td></tr>';
      });
  }

  loadHomeLeaderboard('global');

  var logDatetimeEl = document.getElementById('log-datetime');
  var logDateShortEl = document.getElementById('log-date-short');
  var daySplitEl = document.getElementById('day-split');
  var graphExerciseSelect = document.getElementById('graph-exercise-select');

  function renderHomeWorkoutSplit() {
    var WS = window.WorkoutSplit;
    var todayEl = document.getElementById('home-today-split-summary');
    if (!WS || !daySplitEl) return;
    var state = WS.load();
    if (todayEl) {
      todayEl.textContent = WS.splitFieldLineForDate(state, new Date());
    }
    daySplitEl.textContent = '';
    var letters = WS.dayLetters || ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    for (var i = 0; i < 7; i++) {
      var row = document.createElement('div');
      row.className = 'split-row';
      row.setAttribute('data-day', String(i));
      var letterEl = document.createElement('span');
      letterEl.className = 'split-day';
      letterEl.textContent = letters[i] || '—';
      var nameEl = document.createElement('span');
      nameEl.className = 'split-name';
      nameEl.textContent = (state.days && state.days[i]) || '—';
      row.appendChild(letterEl);
      row.appendChild(nameEl);
      daySplitEl.appendChild(row);
    }
    highlightCurrentDay();
  }

  // Real date and time for Log Workout section
  function updateLogDateTime() {
    var now = new Date();
    var days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    var dayName = days[now.getDay()];
    var hours = now.getHours();
    var mins = now.getMinutes();
    var timeStr = (hours < 10 ? '0' : '') + hours + ':' + (mins < 10 ? '0' : '') + mins;
    if (logDatetimeEl) {
      logDatetimeEl.textContent = dayName + ' ' + timeStr;
    }
    var month = now.getMonth() + 1;
    var date = now.getDate();
    if (logDateShortEl) {
      logDateShortEl.textContent = month + '/' + date;
    }
  }

  // Day split: highlight current day. Grid order is Mon=0 .. Sun=6.
  // getDay() is 0=Sun, 1=Mon, ..., 6=Sat => index = (getDay() + 6) % 7
  function highlightCurrentDay() {
    if (!daySplitEl) return;
    var rows = daySplitEl.querySelectorAll('.split-row');
    var today = new Date().getDay();
    var index = (today + 6) % 7;
    rows.forEach(function (row, i) {
      if (parseInt(row.getAttribute('data-day'), 10) === index) {
        row.classList.add('current-day');
      } else {
        row.classList.remove('current-day');
      }
    });
  }

  updateLogDateTime();
  renderHomeWorkoutSplit();
  setInterval(updateLogDateTime, 60000);

  window.addEventListener('storage', function (e) {
    if (e.key === (window.WorkoutSplit && window.WorkoutSplit.STORAGE_KEY)) {
      renderHomeWorkoutSplit();
    }
  });

  var homeLogComplication = document.getElementById('home-complication-log');
  var homeSplitDetails = document.getElementById('home-split-details');
  if (homeLogComplication && homeSplitDetails) {
    homeLogComplication.addEventListener('click', function (e) {
      if (e.target.closest('a[href]')) return;
      if (e.target.closest('summary')) return;
      if (e.target.closest('.complication-split-label')) return;
      if (e.target.closest('#day-split')) return;
      if (e.target.closest('.complication-split-expanded-inner')) return;
      homeSplitDetails.open = !homeSplitDetails.open;
    });
  }

  // Graph: weight and reps over recent sessions for the selected exercise (from WorkoutLog).
  var graphWeightTitleEl = document.getElementById('graph-weight-title');
  var graphRepsTitleEl = document.getElementById('graph-reps-title');
  var GRAPH_XS = [40, 82, 124, 166, 208, 250];
  var GRAPH_Y_TOP = 22;
  var GRAPH_Y_BOTTOM = 110;
  var GRAPH_POINT_LIMIT = 6;
  var FAVORITES_LS_KEY = 'strongman-favorite-movements';
  var homeGraphSessions = [];

  function graphExerciseLabel(selectEl) {
    if (!selectEl || selectEl.selectedIndex < 0) return '';
    return selectEl.options[selectEl.selectedIndex].text || '';
  }

  function graphExerciseSlug(label) {
    return String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function exerciseMatchesSelection(name, selectEl) {
    var label = graphExerciseLabel(selectEl);
    var slug = selectEl && selectEl.value ? String(selectEl.value) : '';
    var n = String(name || '').trim().toLowerCase();
    if (!n) return false;
    var needle = String(label || '').trim().toLowerCase();
    if (!needle && slug) needle = slug.replace(/-/g, ' ');
    if (!needle) return false;
    if (n === needle) return true;
    if (n.indexOf(needle) !== -1 || needle.indexOf(n) !== -1) return true;
    var slugFromName = graphExerciseSlug(name);
    return !!(slug && slugFromName && (slugFromName === slug || slugFromName.indexOf(slug) !== -1 || slug.indexOf(slugFromName) !== -1));
  }

  function parseFavoriteMovementLines() {
    var out = [];
    try {
      var raw = localStorage.getItem(FAVORITES_LS_KEY) || '';
      raw.split(/[\n,]+/).forEach(function (part) {
        var t = part.trim();
        if (t) out.push(t);
      });
    } catch (e) {}
    return out;
  }

  function collectExerciseOptionsFromSessions(sessions) {
    var map = {};
    (sessions || []).forEach(function (s) {
      (s.exercises || []).forEach(function (ex) {
        var label = ex && ex.name ? String(ex.name).trim() : '';
        if (!label) return;
        var key = label.toLowerCase();
        if (!map[key]) map[key] = { label: label, count: 0 };
        map[key].count += 1;
      });
    });
    var list = Object.keys(map).map(function (k) {
      return map[k];
    });
    list.sort(function (a, b) {
      return b.count - a.count || a.label.localeCompare(b.label);
    });
    return list;
  }

  function populateGraphExerciseSelect(sessions, preferredValue) {
    if (!graphExerciseSelect) return;
    var fromLog = collectExerciseOptionsFromSessions(sessions);
    var seen = {};
    var options = [];
    fromLog.forEach(function (row) {
      var slug = graphExerciseSlug(row.label);
      if (!slug || seen[slug]) return;
      seen[slug] = true;
      options.push({ value: slug, label: row.label });
    });
    parseFavoriteMovementLines().forEach(function (fav) {
      var slug = graphExerciseSlug(fav);
      if (!slug || seen[slug]) return;
      seen[slug] = true;
      options.push({ value: slug, label: fav });
    });
    if (!options.length) {
      options.push({ value: 'bench', label: 'Bench' });
    }
    var prev = preferredValue || graphExerciseSelect.value;
    graphExerciseSelect.innerHTML = '';
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      graphExerciseSelect.appendChild(o);
    });
    var pick = prev;
    if (pick && !seen[pick]) {
      for (var i = 0; i < options.length; i++) {
        if (options[i].value === pick || options[i].label.toLowerCase() === String(prev).toLowerCase()) {
          pick = options[i].value;
          break;
        }
      }
    }
    if (!pick || !seen[pick]) {
      var benchIdx = options.findIndex(function (o) {
        return /bench/i.test(o.label);
      });
      pick = benchIdx >= 0 ? options[benchIdx].value : options[0].value;
    }
    graphExerciseSelect.value = pick;
  }

  function sessionSortTime(s) {
    if (s && s.createdAt) {
      var t = Date.parse(s.createdAt);
      if (!isNaN(t)) return t;
    }
    if (s && s.date) {
      var p = String(s.date).split('-');
      if (p.length === 3) {
        var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    return 0;
  }

  function formatGraphXLabel(point) {
    if (point && point.date) {
      var parts = String(point.date).split('-');
      if (parts.length === 3) {
        return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
      }
    }
    if (point && point.createdAt) {
      var d = new Date(point.createdAt);
      if (!isNaN(d.getTime())) return d.getMonth() + 1 + '/' + d.getDate();
    }
    return '';
  }

  function formatGraphYLabel(value, metric) {
    if (value == null || isNaN(value)) return '—';
    if (metric === 'reps') return String(Math.round(value));
    var n = Number(value);
    return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
  }

  function buildExerciseTrendPoints(sessions, selectEl) {
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionSortTime(a) - sessionSortTime(b);
      });
    var points = [];
    sorted.forEach(function (s) {
      if (!s) return;
      var bestW = null;
      var bestR = null;
      (s.exercises || []).forEach(function (ex) {
        if (!exerciseMatchesSelection(ex.name, selectEl)) return;
        var w = parseFloat(ex.weight);
        var r = parseFloat(ex.reps);
        if (!isNaN(w) && w > 0) bestW = bestW == null ? w : Math.max(bestW, w);
        if (!isNaN(r) && r > 0) bestR = bestR == null ? r : Math.max(bestR, r);
      });
      if (bestW == null && bestR == null) return;
      points.push({
        date: s.date,
        createdAt: s.createdAt,
        weight: bestW,
        reps: bestR
      });
    });
    if (points.length > GRAPH_POINT_LIMIT) {
      points = points.slice(points.length - GRAPH_POINT_LIMIT);
    }
    return points;
  }

  function scaleMetricValue(value, min, max) {
    if (value == null || isNaN(value)) return GRAPH_Y_BOTTOM;
    if (max <= min) return GRAPH_Y_BOTTOM - (GRAPH_Y_BOTTOM - GRAPH_Y_TOP) * 0.5;
    var t = (value - min) / (max - min);
    return GRAPH_Y_BOTTOM - t * (GRAPH_Y_BOTTOM - GRAPH_Y_TOP);
  }

  function metricRange(points, metric) {
    var vals = [];
    points.forEach(function (p) {
      var v = metric === 'weight' ? p.weight : p.reps;
      if (v != null && !isNaN(v)) vals.push(v);
    });
    if (!vals.length) return { min: 0, max: 1 };
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    if (max <= min) {
      var pad = metric === 'reps' ? 1 : 5;
      return { min: Math.max(0, min - pad), max: max + pad };
    }
    var span = max - min;
    return { min: Math.max(0, min - span * 0.08), max: max + span * 0.08 };
  }

  function coordsForMetric(points, metric) {
    var range = metricRange(points, metric);
    var n = points.length;
    var coords = [];
    for (var i = 0; i < n; i++) {
      var x = n === 1 ? GRAPH_XS[GRAPH_XS.length - 1] : GRAPH_XS[GRAPH_XS.length - n + i];
      var raw = metric === 'weight' ? points[i].weight : points[i].reps;
      var y =
        raw == null || isNaN(raw)
          ? GRAPH_Y_BOTTOM
          : scaleMetricValue(raw, range.min, range.max);
      coords.push({ x: x, y: y, raw: raw, point: points[i] });
    }
    return { coords: coords, range: range };
  }

  function setTickLabels(container, labels, xs, ys, anchor) {
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < labels.length; i++) {
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(xs[i]));
      text.setAttribute('y', String(ys[i]));
      text.setAttribute('text-anchor', anchor || 'middle');
      text.textContent = labels[i];
      container.appendChild(text);
    }
  }

  function renderHomeMetricChart(config) {
    var areaEl = document.getElementById(config.areaId);
    var lineEl = document.getElementById(config.lineId);
    var dotEl = document.getElementById(config.dotId);
    var ticksY = document.getElementById(config.ticksYId);
    var ticksX = document.getElementById(config.ticksXId);
    var pane = config.paneEl;
    if (!areaEl || !lineEl || !dotEl) return;

    var points = config.points || [];
    var hasMetric = points.some(function (p) {
      var v = config.metric === 'weight' ? p.weight : p.reps;
      return v != null && !isNaN(v);
    });

    if (pane) pane.classList.toggle('graph-pane--empty', !hasMetric);

    if (!hasMetric) {
      areaEl.setAttribute('d', '');
      lineEl.setAttribute('points', '');
      dotEl.setAttribute('cx', String(GRAPH_XS[0]));
      dotEl.setAttribute('cy', String(GRAPH_Y_BOTTOM));
      dotEl.setAttribute('opacity', '0');
      var yEmpty = [GRAPH_Y_BOTTOM, 78, 46, GRAPH_Y_TOP];
      setTickLabels(
        ticksY,
        ['—', '—', '—', '—'],
        [36, 36, 36, 36],
        yEmpty,
        'end'
      );
      setTickLabels(
        ticksX,
        ['—', '—', '—', '—', '—', '—'],
        GRAPH_XS,
        [122, 122, 122, 122, 122, 122]
      );
      return;
    }

    dotEl.setAttribute('opacity', '1');
    var plotted = coordsForMetric(points, config.metric);
    var coords = plotted.coords;
    var range = plotted.range;
    var linePts = coords
      .map(function (c) {
        return c.x + ',' + c.y;
      })
      .join(' ');
    lineEl.setAttribute('points', linePts);

    if (coords.length) {
      var first = coords[0];
      var last = coords[coords.length - 1];
      var areaD =
        'M' +
        first.x +
        ',' +
        first.y +
        coords
          .slice(1)
          .map(function (c) {
            return ' L' + c.x + ',' + c.y;
          })
          .join('') +
        ' L' +
        last.x +
        ',' +
        GRAPH_Y_BOTTOM +
        ' L' +
        first.x +
        ',' +
        GRAPH_Y_BOTTOM +
        ' Z';
      areaEl.setAttribute('d', areaD);
      dotEl.setAttribute('cx', String(last.x));
      dotEl.setAttribute('cy', String(last.y));
    }

    var yVals = [range.min, range.min + (range.max - range.min) / 3, range.min + ((range.max - range.min) * 2) / 3, range.max];
    var yPos = [GRAPH_Y_BOTTOM, 94, 70, GRAPH_Y_TOP];
    setTickLabels(
      ticksY,
      yVals.map(function (v) {
        return formatGraphYLabel(v, config.metric);
      }),
      [36, 36, 36, 36],
      yPos,
      'end'
    );

    var xLabels = [];
    var xCoords = [];
    for (var i = 0; i < GRAPH_XS.length; i++) {
      var pt = points[i - (GRAPH_XS.length - points.length)];
      if (i < GRAPH_XS.length - points.length) {
        xLabels.push('');
      } else {
        xLabels.push(pt ? formatGraphXLabel(pt) || String(i - (GRAPH_XS.length - points.length) + 1) : '');
      }
      xCoords.push(GRAPH_XS[i]);
    }
    setTickLabels(ticksX, xLabels, xCoords, new Array(GRAPH_XS.length).fill(122));
  }

  function updateGraphTitles() {
    var exercise = graphExerciseLabel(graphExerciseSelect);
    var prefix = exercise ? exercise + ' — ' : '';
    if (graphWeightTitleEl) graphWeightTitleEl.textContent = prefix + 'Weight (lb)';
    if (graphRepsTitleEl) graphRepsTitleEl.textContent = prefix + 'Reps';
  }

  function renderHomeGraphs() {
    updateGraphTitles();
    var points = buildExerciseTrendPoints(homeGraphSessions, graphExerciseSelect);
    var weightPane = graphWeightTitleEl && graphWeightTitleEl.closest('.complication-graph-pane');
    var repsPane = graphRepsTitleEl && graphRepsTitleEl.closest('.complication-graph-pane');
    renderHomeMetricChart({
      metric: 'weight',
      points: points,
      areaId: 'graph-weight-area',
      lineId: 'graph-weight-line',
      dotId: 'graph-weight-dot',
      ticksYId: 'graph-weight-ticks-y',
      ticksXId: 'graph-weight-ticks-x',
      paneEl: weightPane
    });
    renderHomeMetricChart({
      metric: 'reps',
      points: points,
      areaId: 'graph-reps-area',
      lineId: 'graph-reps-line',
      dotId: 'graph-reps-dot',
      ticksYId: 'graph-reps-ticks-y',
      ticksXId: 'graph-reps-ticks-x',
      paneEl: repsPane
    });
  }

  function refreshHomeGraphData() {
    var WL = window.WorkoutLog;
    if (!WL || typeof WL.getSessions !== 'function') {
      homeGraphSessions = [];
      renderHomeGraphs();
      return;
    }
    homeGraphSessions = WL.getSessions() || [];
    populateGraphExerciseSelect(homeGraphSessions, graphExerciseSelect && graphExerciseSelect.value);
    renderHomeGraphs();
  }

  function loadHomeGraphs() {
    var WL = window.WorkoutLog;
    if (WL && typeof WL.syncFromServer === 'function') {
      var cu = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (cu && cu.token) {
        WL.syncFromServer(function () {
          refreshHomeGraphData();
        });
        return;
      }
    }
    refreshHomeGraphData();
  }

  loadHomeGraphs();
  if (graphExerciseSelect) {
    graphExerciseSelect.addEventListener('change', function () {
      renderHomeGraphs();
    });
  }

  window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf('strongman_workouts') !== 0) return;
    refreshHomeGraphData();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.body.getAttribute('data-current-page') === 'home') {
      loadHomeGraphs();
    }
  });

  // Leaderboard scope toggle: Global / Followers / Friends (data source TBD per user account)
  document.querySelectorAll('.scope-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.scope-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      this.classList.add('active');
      var scope = this.getAttribute('data-scope');
      loadHomeLeaderboard(scope || 'global');
    });
  });

  /** Highlighted lifts — top viewed clips from local VideoArchive. */
  var homeHighlightBlobUrls = [];

  function revokeHomeHighlightBlobUrls() {
    homeHighlightBlobUrls.forEach(function (u) {
      try {
        URL.revokeObjectURL(u);
      } catch (e) {}
    });
    homeHighlightBlobUrls = [];
  }

  function sortArchiveByViewsThenDate(rows) {
    var list = (rows || [])
      .filter(function (r) {
        return r && r.videoBlob;
      })
      .slice();
    list.sort(function (a, b) {
      var va = Number(a.viewCount) || 0;
      var vb = Number(b.viewCount) || 0;
      if (vb !== va) return vb - va;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  }

  function hydrateHomeHighlightsFromArchive() {
    var cards = document.querySelectorAll('.page-2-cards .highlight-card');
    if (!cards.length) return Promise.resolve();

    function resetCard(card) {
      var userEl = card.querySelector('.highlight-card-user');
      var titleEl = card.querySelector('.highlight-card-lift-title');
      var metaEl = card.querySelector('.highlight-card-lift-meta');
      var shell = card.querySelector('.highlight-video-shell');
      var vid = card.querySelector('.highlight-card-video');
      if (vid && vid._strongmanViewPlayHandler) {
        vid.removeEventListener('play', vid._strongmanViewPlayHandler);
        vid._strongmanViewPlayHandler = null;
      }
      if (userEl) userEl.textContent = '—';
      if (titleEl) titleEl.textContent = 'No clip in this slot yet.';
      if (metaEl) metaEl.textContent = 'Save from Create to fill your library.';
      card.classList.add('highlight-card--empty');
      if (shell && vid) bindHighlightVideo(shell, vid, '');
    }

    if (!window.VideoArchive || typeof window.VideoArchive.getAll !== 'function') {
      cards.forEach(resetCard);
      return Promise.resolve();
    }

    return window.VideoArchive.getAll().then(function (rows) {
      revokeHomeHighlightBlobUrls();
      var top = sortArchiveByViewsThenDate(rows).slice(0, 3);
      cards.forEach(function (card, i) {
        var row = top[i];
        var userEl = card.querySelector('.highlight-card-user');
        var titleEl = card.querySelector('.highlight-card-lift-title');
        var metaEl = card.querySelector('.highlight-card-lift-meta');
        var shell = card.querySelector('.highlight-video-shell');
        var vid = card.querySelector('.highlight-card-video');
        if (!row || !row.videoBlob) {
          resetCard(card);
          return;
        }
        card.classList.remove('highlight-card--empty');
        var handle = row.uploaderDisplayName ? String(row.uploaderDisplayName).trim() : 'Member';
        if (handle.charAt(0) === '@') handle = handle.slice(1);
        if (userEl) userEl.textContent = handle ? '@' + handle : '@Member';
        if (titleEl) titleEl.textContent = row.title || 'Untitled clip';
        if (metaEl) {
          var vc = Number(row.viewCount) || 0;
          metaEl.textContent = vc + (vc === 1 ? ' view' : ' views') + ' · from your library';
        }
        var u = URL.createObjectURL(row.videoBlob);
        homeHighlightBlobUrls.push(u);
        if (shell && vid) {
          if (vid._strongmanViewPlayHandler) {
            vid.removeEventListener('play', vid._strongmanViewPlayHandler);
            vid._strongmanViewPlayHandler = null;
          }
          bindHighlightVideo(shell, vid, u);
          if (row.id != null && window.VideoArchive && typeof window.VideoArchive.recordPlaybackView === 'function') {
            vid._strongmanViewPlayHandler = function () {
              window.VideoArchive.recordPlaybackView(row.id);
            };
            vid.addEventListener('play', vid._strongmanViewPlayHandler, { passive: true });
          }
        }
      });
    }).catch(function () {
      revokeHomeHighlightBlobUrls();
      cards.forEach(resetCard);
    });
  }

  function bindHighlightVideo(shell, videoEl, url) {
    if (!shell || !videoEl) return;
    shell.classList.remove('is-loaded', 'is-error');
    while (videoEl.firstChild) {
      videoEl.removeChild(videoEl.firstChild);
    }
    videoEl.removeAttribute('src');
    if (videoEl.srcObject) {
      try {
        videoEl.srcObject = null;
      } catch (e) {}
    }
    try {
      videoEl.load();
    } catch (e) {}

    if (!url || !String(url).trim()) {
      return;
    }

    function onLoaded() {
      shell.classList.add('is-loaded');
      shell.classList.remove('is-error');
      videoEl.removeEventListener('loadeddata', onLoaded);
      videoEl.removeEventListener('canplay', onLoaded);
    }
    function onErr() {
      shell.classList.add('is-error');
      shell.classList.remove('is-loaded');
      videoEl.removeEventListener('error', onErr);
    }

    videoEl.addEventListener('loadeddata', onLoaded, { once: true });
    videoEl.addEventListener('canplay', onLoaded, { once: true });
    videoEl.addEventListener('error', onErr, { once: true });
    videoEl.src = url;
  }

  hydrateHomeHighlightsFromArchive();

  window.addEventListener('strongman-video-archive-changed', function () {
    hydrateHomeHighlightsFromArchive();
  });
  window.addEventListener('strongman-video-views-changed', function () {
    hydrateHomeHighlightsFromArchive();
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.body.getAttribute('data-current-page') === 'home') {
      hydrateHomeHighlightsFromArchive();
    }
  });

  window.addEventListener('pagehide', revokeHomeHighlightBlobUrls);
})();
