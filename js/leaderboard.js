(function () {
  var isPublicLeaderboard =
    document.body.getAttribute('data-leaderboard-public') === 'true';

  var userRankWrap = document.querySelector('.lb-user-rank-wrap');
  if (isPublicLeaderboard && userRankWrap) {
    userRankWrap.hidden = true;
  }

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

  var tbody = document.getElementById('leaderboard-body');
  var messageEl = document.getElementById('leaderboard-message');
  var thMetric = document.getElementById('lb-th-metric');
  var thSkill = document.getElementById('lb-th-skill');
  var exercisePickerRow = document.getElementById('lb-exercise-picker');
  var exerciseSearch = document.getElementById('lb-exercise-search');
  var exerciseSuggestions = document.getElementById('lb-exercise-suggestions');
  var exerciseHint = document.getElementById('lb-exercise-hint');

  var state = {
    audience: 'global',
    mode: 'exercises'
  };

  var DEFAULT_EXERCISE = { label: 'Bench press', slug: 'bench-press' };
  var DEFAULT_TIME_EVENT = { label: 'Yoke walk', slug: 'yoke-walk' };
  var ADD_EXERCISE_SURVEY_URL = '/survey/exercises';
  var FAVORITES_LS_KEY = 'strongman-favorite-movements';
  var TIMED_EVENT_DEFAULTS = [
    'Yoke walk',
    'Atlas stones',
    "Farmer's carry",
    'Truck pull',
    'Sandbag carry',
    'Tire flip',
    'Husafell stone',
    'Loading race'
  ];
  var lbSearchDebounceTimer = null;
  var lbSearchAppliedKey = '';
  var SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
  var lbRows = null;
  var lbFollowingIds = [];
  var lbFriendIds = [];
  var lbExerciseValid = true;

  function exerciseDb() {
    return window.ExerciseDatabase || null;
  }

  function resolveExerciseInput(label) {
    var ED = exerciseDb();
    if (!ED || typeof ED.findByName !== 'function') {
      return { valid: true, label: label, exercise: null, suggestions: [] };
    }
    var trimmed = String(label || '').trim();
    if (!trimmed) trimmed = DEFAULT_EXERCISE.label;
    var match = ED.findByName(trimmed);
    if (match) {
      return { valid: true, label: match.name, exercise: match, suggestions: [] };
    }
    var suggestions =
      typeof ED.suggest === 'function' ? ED.suggest(trimmed, 3) : [];
    return { valid: false, label: trimmed, exercise: null, suggestions: suggestions };
  }

  function validatedExerciseQuery() {
    var raw = String(exerciseSearch && exerciseSearch.value ? exerciseSearch.value : '').trim();
    if (!raw) raw = DEFAULT_EXERCISE.label;
    var resolved = resolveExerciseInput(raw);
    return {
      valid: resolved.valid,
      label: resolved.valid ? resolved.label : raw,
      slug: exerciseSlug(resolved.valid ? resolved.label : raw),
      rawLabel: raw,
      suggestions: resolved.suggestions || []
    };
  }

  function hideExerciseHint() {
    if (!exerciseHint) return;
    exerciseHint.hidden = true;
    exerciseHint.innerHTML = '';
  }

  function showUnknownExerciseHint(label) {
    renderExerciseHint(resolveExerciseInput(label));
  }

  function renderExerciseHint(result) {
    if (!exerciseHint) return;
    if (!result || result.valid) {
      hideExerciseHint();
      return;
    }
    var parts = [];
    parts.push('That exercise is not in our database yet.');
    if (result.suggestions && result.suggestions.length) {
      var links = result.suggestions
        .map(function (ex) {
          return (
            '<button type="button" class="lb-exercise-suggest-btn" data-exercise-name="' +
            escapeHtml(ex.name) +
            '">' +
            escapeHtml(ex.name) +
            '</button>'
          );
        })
        .join(', ');
      parts.push(' Did you mean: ' + links + '?');
    }
    parts.push(
      ' <a class="lb-exercise-survey-link" href="' +
        ADD_EXERCISE_SURVEY_URL +
        '">Request a new exercise</a>.'
    );
    exerciseHint.innerHTML = parts.join('');
    exerciseHint.hidden = false;
    exerciseHint.querySelectorAll('.lb-exercise-suggest-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-exercise-name');
        if (!name || !exerciseSearch) return;
        exerciseSearch.value = name;
        lbExerciseValid = true;
        hideExerciseHint();
        commitExerciseSearch();
      });
    });
  }

  function renderEmptyLeaderboard(message) {
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="4">' + escapeHtml(message || 'No lifts recorded for this exercise yet.') + '</td></tr>';
    }
    if (messageEl) messageEl.textContent = '';
    var userRankEl = document.getElementById('lb-user-rank-num');
    var userNameEl = document.getElementById('lb-user-name');
    var userMetricEl = document.getElementById('lb-user-metric');
    var userSkillEl = document.getElementById('lb-user-skill');
    if (userRankEl) userRankEl.textContent = '—';
    if (userNameEl) userNameEl.textContent = '—';
    if (userMetricEl) userMetricEl.textContent = '—';
    if (userSkillEl) userSkillEl.textContent = '—';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  /** Profile destination — public leaderboard prompts sign-in with return path. */
  function profileUrlForUser(user) {
    if (!user || user.id == null) return null;
    var id = Number(user.id);
    if (!Number.isFinite(id) || id < 1) return null;
    var path = '/profile?id=' + encodeURIComponent(String(id));
    if (isPublicLeaderboard) {
      return '/login?next=' + encodeURIComponent(path);
    }
    return path;
  }

  function usernameCellHtml(user) {
    var name = escapeHtml(user.username || '—');
    var url = profileUrlForUser(user);
    if (!url) return name;
    return '<a class="lb-user-link" href="' + url + '">' + name + '</a>';
  }

  var SKILL_LABELS = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced'
  };

  function formatSkillLevel(user) {
    var raw = user && user.experience ? String(user.experience).trim().toLowerCase() : '';
    if (!raw) return '—';
    if (SKILL_LABELS[raw]) return SKILL_LABELS[raw];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function weightUnitsLabel() {
    if (window.Units && typeof window.Units.weightLabel === 'function') {
      return window.Units.weightLabel();
    }
    return 'lb';
  }

  function formatLiftWeight(rawWeight) {
    if (rawWeight == null || isNaN(Number(rawWeight))) return '—';
    var n = Number(rawWeight);
    if (window.Units && typeof window.Units.convertWeight === 'function') {
      var units = window.Units.getUnits ? window.Units.getUnits() : 'imperial';
      var converted = window.Units.convertWeight(n, 'imperial', units);
      if (converted == null) return String(n);
      var label = window.Units.weightLabel(units);
      return (
        String(units === 'metric' ? converted : Math.round(converted)) + ' ' + label
      );
    }
    return String(n) + ' lb';
  }

  function exerciseSlug(label) {
    return String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function queryFromSearchInput(el, fallback) {
    var fb = fallback || DEFAULT_EXERCISE;
    if (!el) return { label: fb.label, slug: fb.slug };
    var label = String(el.value || '').trim();
    if (!label) label = fb.label;
    if (el === exerciseSearch) {
      var resolved = resolveExerciseInput(label);
      if (resolved.valid) {
        label = resolved.label;
      }
    }
    return {
      label: label,
      slug: exerciseSlug(label) || fb.slug
    };
  }

  function exerciseQueryCacheKey(q) {
    return (q.slug || '') + '|' + String(q.label || '').toLowerCase();
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
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return b.count - a.count || a.label.localeCompare(b.label);
      });
  }

  function populateDatalist(datalistEl, labels) {
    if (!datalistEl) return;
    var seen = {};
    datalistEl.innerHTML = '';
    (labels || []).forEach(function (label) {
      var t = String(label || '').trim();
      if (!t) return;
      var key = t.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      var opt = document.createElement('option');
      opt.value = t;
      datalistEl.appendChild(opt);
    });
  }

  function populateExerciseSuggestions() {
    var labels = [];
    var ED = exerciseDb();
    if (ED && Array.isArray(ED.catalog)) {
      ED.catalog.forEach(function (ex) {
        if (ex && ex.name) labels.push(ex.name);
      });
    }
    TIMED_EVENT_DEFAULTS.forEach(function (name) {
      if (labels.indexOf(name) === -1) labels.push(name);
    });
    var WL = window.WorkoutLog;
    if (WL && typeof WL.getSessions === 'function') {
      collectExerciseOptionsFromSessions(WL.getSessions()).forEach(function (row) {
        var resolved = resolveExerciseInput(row.label);
        if (resolved.valid && labels.indexOf(resolved.label) === -1) {
          labels.push(resolved.label);
        }
      });
    }
    parseFavoriteMovementLines().forEach(function (f) {
      var resolved = resolveExerciseInput(f);
      if (resolved.valid && labels.indexOf(resolved.label) === -1) labels.push(resolved.label);
    });
    if (labels.indexOf(DEFAULT_EXERCISE.label) === -1) {
      labels.unshift(DEFAULT_EXERCISE.label);
    }
    populateDatalist(exerciseSuggestions, labels);
  }

  function updatePickerVisibility() {
    var mode = state.mode;
    if (exercisePickerRow) exercisePickerRow.hidden = mode === 'streak';
  }

  function activeExerciseFallback() {
    return state.mode === 'times' ? DEFAULT_TIME_EVENT : DEFAULT_EXERCISE;
  }

  function syntheticTimeMinutes(user) {
    var id = user && user.id != null ? Number(user.id) : 0;
    var eventSlug = queryFromSearchInput(exerciseSearch, DEFAULT_TIME_EVENT).slug;
    var slugHash = 0;
    for (var i = 0; i < eventSlug.length; i++) {
      slugHash += eventSlug.charCodeAt(i);
    }
    var base = 8 + (id % 50) + (id % 7) * 0.5 + (slugHash % 25) * 0.15;
    var mins = Math.floor(base);
    var secs = Math.floor((base - mins) * 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function metricForUser(user, mode) {
    if (mode === 'times') return syntheticTimeMinutes(user);
    if (mode === 'streak') {
      var days = user && user.streak != null ? Number(user.streak) : null;
      if (days != null && !isNaN(days) && days > 0) {
        return String(days) + (days === 1 ? ' day' : ' days');
      }
      return '—';
    }
    if (user.liftWeight != null) return formatLiftWeight(user.liftWeight);
    return '—';
  }

  function userRowMetric(user, mode) {
    if (mode === 'times') return syntheticTimeMinutes(user);
    if (mode === 'streak') {
      var streakDays = user && user.streak != null ? Number(user.streak) : null;
      if (streakDays != null && !isNaN(streakDays) && streakDays > 0) {
        return String(streakDays) + (streakDays === 1 ? ' day' : ' days');
      }
      return 'none recorded';
    }
    if (user.liftWeight != null) return formatLiftWeight(user.liftWeight);
    return 'none recorded';
  }

  function updateTableHeaders(mode) {
    if (!thMetric || !thSkill) return;
    if (mode === 'times') {
      thMetric.textContent = 'Time';
    } else if (mode === 'streak') {
      thMetric.textContent = 'Streak';
    } else {
      thMetric.textContent = 'Value (' + weightUnitsLabel() + ')';
    }
    thSkill.textContent = 'Skill level';
  }

  function sortUsers(users, mode) {
    var list = (users || []).slice();
    if (mode === 'exercises') {
      list.sort(function (a, b) {
        var wa =
          a.liftWeight != null && !isNaN(Number(a.liftWeight)) ? Number(a.liftWeight) : -Infinity;
        var wb =
          b.liftWeight != null && !isNaN(Number(b.liftWeight)) ? Number(b.liftWeight) : -Infinity;
        if (wb !== wa) return wb - wa;
        return String(a.username || '').localeCompare(String(b.username || ''));
      });
    } else if (mode === 'streak') {
      list.sort(function (a, b) {
        var sa = a.streak != null && !isNaN(Number(a.streak)) ? Number(a.streak) : -Infinity;
        var sb = b.streak != null && !isNaN(Number(b.streak)) ? Number(b.streak) : -Infinity;
        if (sb !== sa) return sb - sa;
        return String(a.username || '').localeCompare(String(b.username || ''));
      });
    } else {
      list.sort(function (a, b) {
        return syntheticTimeMinutes(a).localeCompare(syntheticTimeMinutes(b));
      });
    }
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

  function fetchScopeLists(audience) {
    lbFollowingIds = [];
    lbFriendIds = [];
    var cu = !isPublicLeaderboard && window.getCurrentUser && window.getCurrentUser();
    if (!cu || !cu.token || audience === 'global') return Promise.resolve();
    if (audience === 'followers') {
      return window
        .apiGet('/users/me/following')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (ids) {
          lbFollowingIds = Array.isArray(ids) ? ids : [];
        });
    }
    if (audience === 'friends') {
      return window
        .apiGet('/users/me/friends')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (ids) {
          lbFriendIds = Array.isArray(ids) ? ids : [];
        });
    }
    return Promise.resolve();
  }

  function filterByAudience(users, audience) {
    var ranked = sortUsers(users, state.mode);
    var currentUser = !isPublicLeaderboard && window.getCurrentUser && window.getCurrentUser();
    if (audience === 'followers') {
      if (!currentUser || !currentUser.token) return { needsSignIn: true, list: [] };
      var fSet = idAllowSet(lbFollowingIds);
      return {
        needsSignIn: false,
        list: ranked.filter(function (u) {
          return (currentUser && u.id === currentUser.id) || fSet[u.id];
        })
      };
    }
    if (audience === 'friends') {
      if (!currentUser || !currentUser.token) return { needsSignIn: true, list: [] };
      var mSet = idAllowSet(lbFriendIds);
      return {
        needsSignIn: false,
        list: ranked.filter(function (u) {
          return (currentUser && u.id === currentUser.id) || mSet[u.id];
        })
      };
    }
    return { needsSignIn: false, list: ranked };
  }

  function renderLeaderboard(users) {
    if (!tbody) return;
    tbody.innerHTML = '';
    var mode = state.mode;
    updateTableHeaders(mode);

    var scoped = filterByAudience(users, state.audience);
    if (scoped.needsSignIn) {
      tbody.innerHTML =
        '<tr><td colspan="4">Sign in to see this leaderboard view.</td></tr>';
      return;
    }

    var list = scoped.list;
    if (mode === 'exercises') {
      list = list.filter(function (u) {
        return u.liftWeight != null && !isNaN(Number(u.liftWeight)) && Number(u.liftWeight) > 0;
      });
    }
    list = list.slice(0, 10);
    var currentUser =
      !isPublicLeaderboard && window.getCurrentUser && window.getCurrentUser();

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="4">' +
        (mode === 'exercises'
          ? 'No lifts recorded for this exercise yet.'
          : 'No one to show for this view yet.') +
        '</td></tr>';
    } else {
      list.forEach(function (user, i) {
        var tr = document.createElement('tr');
        if (currentUser && currentUser.id === user.id) {
          tr.classList.add('lb-row-self');
        }
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td>' + usernameCellHtml(user) + '</td>' +
          '<td>' + escapeHtml(metricForUser(user, mode)) + '</td>' +
          '<td>' + escapeHtml(formatSkillLevel(user)) + '</td>';
        tbody.appendChild(tr);
      });
    }

    if (isPublicLeaderboard) {
      return;
    }

    var sortedAll = scoped.list;
    if (mode === 'exercises') {
      sortedAll = sortedAll.filter(function (u) {
        return u.liftWeight != null && !isNaN(Number(u.liftWeight)) && Number(u.liftWeight) > 0;
      });
    }
    var userRankEl = document.getElementById('lb-user-rank-num');
    var userNameEl = document.getElementById('lb-user-name');
    var userMetricEl = document.getElementById('lb-user-metric');
    var userSkillEl = document.getElementById('lb-user-skill');

    if (currentUser && sortedAll.length) {
      var idx = sortedAll.findIndex(function (u) {
        return u.id === currentUser.id;
      });
      var rowUser = idx >= 0 ? sortedAll[idx] : null;
      if (rowUser) {
        if (userRankEl) userRankEl.textContent = String(idx + 1);
        if (userNameEl) userNameEl.textContent = rowUser.username || currentUser.username || '—';
        if (userMetricEl) userMetricEl.textContent = userRowMetric(rowUser, mode);
        if (userSkillEl) userSkillEl.textContent = formatSkillLevel(rowUser);
      } else {
        if (userRankEl) userRankEl.textContent = '—';
        if (userNameEl) userNameEl.textContent = currentUser.username || '—';
        if (userMetricEl) {
          userMetricEl.textContent =
            mode === 'times' ? '00:00' : 'none recorded';
        }
        if (userSkillEl) userSkillEl.textContent = formatSkillLevel(currentUser);
      }
    } else {
      if (userRankEl) userRankEl.textContent = '—';
      if (userNameEl) userNameEl.textContent = '—';
      if (userMetricEl) userMetricEl.textContent = '—';
      if (userSkillEl) userSkillEl.textContent = '—';
    }
  }

  function fetchLeaderboardRows() {
    if (state.mode === 'streak') {
      return window.apiGet('/leaderboard/streak').then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      });
    }
    if (state.mode === 'times') {
      return window.apiGet('/users').then(function (res) {
        return res.json();
      });
    }
    var q = validatedExerciseQuery();
    if (!q.valid) {
      return Promise.reject({ code: 'unknown_exercise', query: q });
    }
    var path =
      '/leaderboard?exercise=' +
      encodeURIComponent(q.slug) +
      '&label=' +
      encodeURIComponent(q.label);
    return window.apiGet(path).then(function (res) {
      if (!res.ok) throw new Error('bad status');
      return res.json();
    });
  }

  function loadLeaderboard() {
    if (messageEl) messageEl.textContent = 'Loading…';
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    }
    if (state.mode === 'exercises' && exerciseSearch) {
      var validated = validatedExerciseQuery();
      if (!validated.valid) {
        lbExerciseValid = false;
        showUnknownExerciseHint(validated.label);
        renderEmptyLeaderboard('Pick a registered exercise to view the leaderboard.');
        return;
      }
      lbExerciseValid = true;
      hideExerciseHint();
      if (exerciseSearch.value !== validated.label) {
        exerciseSearch.value = validated.label;
      }
      lbSearchAppliedKey = exerciseQueryCacheKey({
        label: validated.label,
        slug: validated.slug
      });
    } else if (state.mode === 'times' && exerciseSearch) {
      hideExerciseHint();
      lbSearchAppliedKey = exerciseQueryCacheKey(
        queryFromSearchInput(exerciseSearch, DEFAULT_TIME_EVENT)
      );
    } else {
      hideExerciseHint();
      lbSearchAppliedKey = '';
    }
    fetchLeaderboardRows()
      .then(function (rows) {
        lbRows = Array.isArray(rows) ? rows : [];
        return fetchScopeLists(state.audience);
      })
      .then(function () {
        if (!lbRows.length && state.mode === 'times') {
          renderLeaderboard([]);
          if (messageEl) {
            messageEl.textContent =
              'Timed exercise leaderboards use logged workout data when available.';
          }
          return;
        }
        renderLeaderboard(lbRows);
        if (messageEl) messageEl.textContent = '';
      })
      .catch(function (err) {
        if (err && err.code === 'unknown_exercise') {
          showUnknownExerciseHint(err.query && err.query.label ? err.query.label : '');
          renderEmptyLeaderboard('Pick a registered exercise to view the leaderboard.');
          return;
        }
        renderEmptyLeaderboard('Could not load leaderboard. Try again in a moment.');
        if (messageEl) messageEl.textContent = 'Leaderboard unavailable right now.';
      });
  }

  function commitExerciseSearch() {
    if ((state.mode !== 'exercises' && state.mode !== 'times') || !exerciseSearch) return;
    if (state.mode === 'exercises') {
      var validated = validatedExerciseQuery();
      var key = exerciseQueryCacheKey({
        label: validated.valid ? validated.label : validated.rawLabel,
        slug: validated.slug
      });
      if (!validated.valid) {
        if (key === lbSearchAppliedKey) return;
        lbSearchAppliedKey = key;
        loadLeaderboard();
        return;
      }
      if (key === lbSearchAppliedKey) return;
      lbSearchAppliedKey = key;
      loadLeaderboard();
      return;
    }
    var q = queryFromSearchInput(exerciseSearch, DEFAULT_TIME_EVENT);
    var timesKey = exerciseQueryCacheKey(q);
    if (timesKey === lbSearchAppliedKey) return;
    lbSearchAppliedKey = timesKey;
    loadLeaderboard();
  }

  function wirePickerSearch(inputEl, commitFn) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (lbSearchDebounceTimer) {
          clearTimeout(lbSearchDebounceTimer);
          lbSearchDebounceTimer = null;
        }
        commitFn();
      }
    });
    inputEl.addEventListener('change', function () {
      if (lbSearchDebounceTimer) {
        clearTimeout(lbSearchDebounceTimer);
        lbSearchDebounceTimer = null;
      }
      commitFn();
    });
    inputEl.addEventListener('blur', function () {
      if (lbSearchDebounceTimer) {
        clearTimeout(lbSearchDebounceTimer);
        lbSearchDebounceTimer = null;
      }
      commitFn();
    });
    inputEl.addEventListener('input', function () {
      if (lbSearchDebounceTimer) clearTimeout(lbSearchDebounceTimer);
      lbSearchDebounceTimer = setTimeout(function () {
        lbSearchDebounceTimer = null;
        commitFn();
      }, 450);
    });
  }

  document.querySelectorAll('.lb-filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      var value = btn.getAttribute('data-value');
      if (!group || !value) return;
      state[group] = value;
      document.querySelectorAll('.lb-filter-btn[data-group="' + group + '"]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-value') === value);
      });
      if (group === 'mode') {
        lbSearchAppliedKey = '';
        updatePickerVisibility();
        if (exerciseSearch) {
          var fallback = activeExerciseFallback();
          exerciseSearch.value = fallback.label;
          exerciseSearch.placeholder =
            value === 'times' ? 'Search timed exercise…' : 'Search exercise…';
        }
      }
      loadLeaderboard();
    });
  });

  wirePickerSearch(exerciseSearch, commitExerciseSearch);

  function initLeaderboardExerciseDb() {
    var ED = exerciseDb();
    if (ED && typeof ED.fetch === 'function') {
      return ED.fetch().then(function () {
        populateExerciseSuggestions();
      });
    }
    populateExerciseSuggestions();
    return Promise.resolve();
  }

  initLeaderboardExerciseDb().then(function () {
    updatePickerVisibility();
    loadLeaderboard();
  });

  var compState = 'finished';
  var compTickId = null;
  var compUsersCache = [];

  function loadCompOpponentUsers() {
    if (!window.apiGet || !window.isLoggedIn || !window.isLoggedIn()) {
      return Promise.resolve([]);
    }
    return window
      .apiGet('/users')
      .then(function (res) {
        return res.ok ? res.json() : [];
      })
      .then(function (rows) {
        var selfId = compUid();
        compUsersCache = (Array.isArray(rows) ? rows : []).filter(function (u) {
          return u && u.id != null && Number(u.id) !== selfId;
        });
        return compUsersCache;
      })
      .catch(function () {
        return compUsersCache;
      });
  }

  function populateCompOpponentSuggestions(datalistEl) {
    if (!datalistEl) return;
    datalistEl.innerHTML = '';
    compUsersCache.forEach(function (u) {
      if (!u || !u.username) return;
      var opt = document.createElement('option');
      opt.value = u.username;
      opt.setAttribute('data-user-id', String(u.id));
      datalistEl.appendChild(opt);
    });
  }

  function resolveOpponentUserId(username) {
    var q = String(username || '').trim().toLowerCase();
    if (!q) return null;
    for (var i = 0; i < compUsersCache.length; i++) {
      var u = compUsersCache[i];
      if (u && String(u.username || '').toLowerCase() === q) return Number(u.id);
    }
    return null;
  }

  function padPct(n) {
    var num = Math.max(0, Math.min(100, Math.round(Number(n))));
    return String(num).padStart(3, '0') + '%';
  }

  function formatShortYmd(ymd) {
    if (!ymd || typeof ymd !== 'string') return '—';
    var p = ymd.split('-');
    if (p.length !== 3) return ymd;
    return Number(p[1]) + '.' + Number(p[2]) + '.' + String(p[0] || '').slice(-2);
  }

  function ymdToday() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseYmdEndOfDayMs(ymd) {
    if (!ymd) return NaN;
    return new Date(ymd + 'T23:59:59').getTime();
  }

  function compUid() {
    var u = !isPublicLeaderboard && window.getCurrentUser && window.getCurrentUser();
    return u && u.id != null ? Number(u.id) : null;
  }

  function clearCompTicker() {
    if (compTickId) {
      clearInterval(compTickId);
      compTickId = null;
    }
  }

  function tickCompetitionTimers() {
    document.querySelectorAll('.lb-competition-card[data-status="ongoing"]').forEach(function (card) {
      var el = card.querySelector('.lb-comp-timer-value');
      if (!el) return;
      var endMs = parseInt(card.getAttribute('data-end-ms'), 10);
      if (!Number.isFinite(endMs)) {
        el.textContent = '—';
        return;
      }
      var left = Math.max(0, endMs - Date.now());
      if (left <= 0) {
        el.textContent = '00:00:00';
        return;
      }
      var s = Math.floor(left / 1000);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      el.textContent =
        String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    });
  }

  function startCompTicker() {
    clearCompTicker();
    tickCompetitionTimers();
    compTickId = setInterval(tickCompetitionTimers, 1000);
  }

  function buildOneCard(comp, selfName) {
    var art = document.createElement('article');
    art.className = 'lb-competition-card';
    art.setAttribute('data-comp-id', comp.id);
    art.setAttribute('data-status', comp.status);
    var endMs = parseYmdEndOfDayMs(comp.endDate);
    art.setAttribute('data-end-ms', String(Number.isFinite(endMs) ? endMs : ''));

    var mascL = document.createElement('div');
    mascL.className = 'lb-comp-mascot lb-comp-mascot--left';
    mascL.setAttribute('aria-hidden', 'true');
    art.appendChild(mascL);
    var mascR = document.createElement('div');
    mascR.className = 'lb-comp-mascot lb-comp-mascot--right';
    mascR.setAttribute('aria-hidden', 'true');
    art.appendChild(mascR);
    var scrim = document.createElement('div');
    scrim.className = 'lb-comp-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    art.appendChild(scrim);

    var inner = document.createElement('div');
    inner.className = 'lb-comp-inner';

    var dates = document.createElement('p');
    dates.className = 'lb-comp-dates';
    dates.textContent = formatShortYmd(comp.startDate) + ' → ' + formatShortYmd(comp.endDate);

    var names = document.createElement('div');
    names.className = 'lb-comp-names';
    var ns = document.createElement('span');
    ns.textContent = selfName || 'You';
    var no = document.createElement('span');
    no.textContent = comp.opponentName || 'Opponent';
    names.appendChild(ns);
    names.appendChild(no);

    var center = document.createElement('div');
    center.className = 'lb-comp-center';
    var goal = document.createElement('h3');
    goal.className = 'lb-comp-goal';
    goal.textContent = comp.goalTitle || 'Goal';

    var grid = document.createElement('div');
    grid.className = 'lb-comp-stat-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Head to head stats');

    function row(label, left, right) {
      var r = document.createElement('div');
      r.className = 'lb-comp-stat-row';
      var l = document.createElement('span');
      l.className = 'lb-comp-stat-side lb-comp-stat-side--left';
      l.textContent = left;
      var lab = document.createElement('span');
      lab.className = 'lb-comp-stat-label';
      lab.textContent = label;
      var rt = document.createElement('span');
      rt.className = 'lb-comp-stat-side lb-comp-stat-side--right';
      rt.textContent = right;
      r.appendChild(l);
      r.appendChild(lab);
      r.appendChild(rt);
      return r;
    }

    var oppPct =
      comp.opponentProgressPct != null && comp.opponentProgressPct !== ''
        ? padPct(comp.opponentProgressPct)
        : '—';
    var goalLb = comp.weightGoalLb != null ? Number(comp.weightGoalLb) : 0;
    var oppCurrentLb =
      comp.opponentProgressPct != null && comp.opponentProgressPct !== ''
        ? Math.round((Number(comp.opponentProgressPct) / 100) * goalLb * 10) / 10
        : null;
    grid.appendChild(row('Progress', padPct(comp.progressSelfPct), oppPct));
    grid.appendChild(
      row(
        'Weight increase',
        (comp.weightCurrentLb != null ? String(comp.weightCurrentLb) : '0') + ' LBS',
        (oppCurrentLb != null ? String(oppCurrentLb) : '0') + ' LBS'
      )
    );
    grid.appendChild(
      row(
        'Competitions won',
        String(comp.winsSelf != null ? comp.winsSelf : 0),
        String(comp.winsOpp != null ? comp.winsOpp : 0)
      )
    );

    center.appendChild(goal);
    center.appendChild(grid);

    if (comp.quote) {
      var bq = document.createElement('blockquote');
      bq.className = 'lb-comp-quote';
      bq.appendChild(document.createTextNode('\u201c' + comp.quote + '\u201d'));
      if (comp.quoteAuthor) {
        var cite = document.createElement('cite');
        cite.appendChild(document.createTextNode(' \u2014 ' + comp.quoteAuthor));
        bq.appendChild(cite);
      }
      center.appendChild(bq);
    }

    inner.appendChild(dates);
    inner.appendChild(names);
    inner.appendChild(center);

    if (comp.invitePending) {
      var pending = document.createElement('p');
      pending.className = 'lb-comp-pending-note';
      pending.textContent = 'Waiting for ' + (comp.opponentName || 'opponent') + ' to accept your invite.';
      inner.appendChild(pending);
    }

    var timer = document.createElement('div');
    timer.className = 'lb-comp-timer';
    var tl = document.createElement('span');
    tl.className = 'lb-comp-timer-label';
    tl.textContent = comp.status === 'finished' ? 'Result window' : 'Remaining time';
    var tv = document.createElement('span');
    tv.className = 'lb-comp-timer-value';
    tv.textContent = comp.status === 'finished' ? 'Ended' : '00:00:00';
    timer.appendChild(tl);
    timer.appendChild(tv);
    inner.appendChild(timer);

    if (comp.status === 'ongoing') {
      var act = document.createElement('div');
      act.className = 'lb-comp-card-actions';
      var btnDone = document.createElement('button');
      btnDone.type = 'button';
      btnDone.textContent = 'Mark finished';
      btnDone.setAttribute('data-comp-action', 'finish');
      var btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.textContent = 'Remove';
      btnDel.className = 'lb-comp-card-action--danger';
      btnDel.setAttribute('data-comp-action', 'delete');
      act.appendChild(btnDone);
      act.appendChild(btnDel);
      inner.appendChild(act);
    }

    art.appendChild(inner);
    return art;
  }

  function renderCompetitionsSection() {
    if (isPublicLeaderboard) return;

    var listEl = document.getElementById('lb-competitions-list');
    var emptyEl = document.getElementById('lb-comp-empty');
    if (!listEl || !emptyEl) return;

    var uid = compUid();
    if (!uid) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'Sign in to create and view competitions.';
      listEl.innerHTML = '';
      clearCompTicker();
      return;
    }

    function paint() {
      var ongoing = window.competitionsStoreOngoing ? window.competitionsStoreOngoing(uid) : [];
      var finished = window.competitionsStoreFinished ? window.competitionsStoreFinished(uid) : [];
      var show = compState === 'ongoing' ? ongoing : finished;
      var selfName =
        (window.getCurrentUser && window.getCurrentUser() && window.getCurrentUser().username) || 'You';

      listEl.innerHTML = '';

      if (!show.length) {
        emptyEl.hidden = false;
        emptyEl.textContent =
          compState === 'ongoing'
            ? 'No current competitions. Start one to challenge a friend and track it here.'
            : 'No finished competitions yet. When you mark one complete, it will appear here.';
        clearCompTicker();
        return;
      }

      emptyEl.hidden = true;
      for (var i = 0; i < show.length; i++) {
        listEl.appendChild(buildOneCard(show[i], selfName));
      }

      listEl.querySelectorAll('button[data-comp-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.lb-competition-card');
          var id = card && card.getAttribute('data-comp-id');
          var act = btn.getAttribute('data-comp-action');
          if (!id || !act) return;
          if (act === 'delete' && !window.confirm('Cancel this competition?')) return;
          btn.disabled = true;
          var action =
            act === 'delete'
              ? window.competitionsStoreRemove(uid, id)
              : window.competitionsStoreUpdate(uid, id, { status: 'finished' });
          Promise.resolve(action)
            .then(function () {
              renderCompetitionsSection();
            })
            .catch(function () {
              btn.disabled = false;
            });
        });
      });

      startCompTicker();
    }

    if (window.competitionsStoreSync) {
      window.competitionsStoreSync(uid).then(paint).catch(paint);
    } else {
      paint();
    }
  }

  document.querySelectorAll('.lb-comp-toggle-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (isPublicLeaderboard) return;
      var st = btn.getAttribute('data-comp-state');
      document.querySelectorAll('.lb-comp-toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-comp-state') === st);
      });
      compState = st || 'finished';
      renderCompetitionsSection();
    });
  });

  function openCompFormOverlay() {
    var ov = document.getElementById('lb-comp-form-overlay');
    if (!ov) return;
    ov.hidden = false;
  }

  function closeCompFormOverlay() {
    var ov = document.getElementById('lb-comp-form-overlay');
    if (!ov) return;
    ov.hidden = true;
  }

  function wireCompetitionForm() {
    if (isPublicLeaderboard) return;
    var addBtn = document.getElementById('lb-comp-add-btn');
    var ov = document.getElementById('lb-comp-form-overlay');
    var closeBtn = document.getElementById('lb-comp-form-close');
    var cancelBtn = document.getElementById('lb-comp-form-cancel');
    var saveBtn = document.getElementById('lb-comp-form-save');
    var errEl = document.getElementById('lb-comp-form-error');
    var fOpp = document.getElementById('lb-comp-field-opponent');
    var fOppId = document.getElementById('lb-comp-field-opponent-id');
    var fOppList = document.getElementById('lb-comp-opponent-suggestions');
    var fGoal = document.getElementById('lb-comp-field-goal');
    var fW = document.getElementById('lb-comp-field-weight');
    var fEnd = document.getElementById('lb-comp-field-end');

    function setErr(msg) {
      if (!errEl) return;
      if (msg) {
        errEl.textContent = msg;
        errEl.hidden = false;
      } else {
        errEl.textContent = '';
        errEl.hidden = true;
      }
    }

    function defaultEndDate() {
      var d = new Date();
      d.setDate(d.getDate() + 56);
      return d.toISOString().slice(0, 10);
    }

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var uid = compUid();
        if (!uid) return;
        setErr('');
        if (fOpp) fOpp.value = '';
        if (fOppId) fOppId.value = '';
        if (fGoal) fGoal.value = '';
        if (fW) fW.value = '';
        if (fEnd) fEnd.value = defaultEndDate();
        loadCompOpponentUsers().then(function () {
          populateCompOpponentSuggestions(fOppList);
          openCompFormOverlay();
        });
      });
    }
    if (fOpp) {
      fOpp.addEventListener('change', function () {
        var id = resolveOpponentUserId(fOpp.value);
        if (fOppId) fOppId.value = id != null ? String(id) : '';
      });
      fOpp.addEventListener('input', function () {
        var id = resolveOpponentUserId(fOpp.value);
        if (fOppId) fOppId.value = id != null ? String(id) : '';
      });
    }
    [closeBtn, cancelBtn].forEach(function (b) {
      if (b) b.addEventListener('click', closeCompFormOverlay);
    });
    if (ov) {
      ov.addEventListener('click', function (e) {
        if (e.target === ov) closeCompFormOverlay();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var uid = compUid();
        if (!uid) return;
        setErr('');
        var oppName = fOpp ? fOpp.value.trim() : '';
        var oppId = fOppId && fOppId.value ? Number(fOppId.value) : resolveOpponentUserId(oppName);
        var goal = fGoal ? fGoal.value.trim() : '';
        var w = fW ? Number(fW.value) : 0;
        var end = fEnd ? fEnd.value.trim() : '';
        if (!oppName) return setErr('Pick an opponent.');
        if (!oppId) return setErr('Choose a valid username from the list.');
        if (!goal) return setErr('Describe your goal.');
        if (!Number.isFinite(w) || w <= 0) return setErr('Enter a target increase in pounds (greater than zero).');
        if (!end) return setErr('Pick an end date.');
        if (end < ymdToday()) return setErr('End date must be today or later.');
        saveBtn.disabled = true;
        window
          .competitionsStoreAdd(uid, {
            opponentUserId: oppId,
            goalTitle: goal,
            weightGoalLb: w,
            startDate: ymdToday(),
            endDate: end
          })
          .then(function () {
            closeCompFormOverlay();
            compState = 'ongoing';
            document.querySelectorAll('.lb-comp-toggle-btn').forEach(function (b) {
              b.classList.toggle('active', b.getAttribute('data-comp-state') === 'ongoing');
            });
            renderCompetitionsSection();
          })
          .catch(function (err) {
            setErr((err && err.message) || 'Could not create competition.');
          })
          .then(function () {
            saveBtn.disabled = false;
          });
      });
    }
  }

  window.addEventListener('strongman:competitions-updated', function () {
    if (!isPublicLeaderboard) renderCompetitionsSection();
  });

  if (!isPublicLeaderboard) {
    var initToggle = document.querySelector('.lb-comp-toggle-btn.active');
    compState =
      initToggle && initToggle.getAttribute('data-comp-state')
        ? initToggle.getAttribute('data-comp-state')
        : 'finished';
    wireCompetitionForm();
    renderCompetitionsSection();
  }
})();
