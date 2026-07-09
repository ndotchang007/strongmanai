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

  var LB_MODES = ['exercises', 'streak', 'times'];
  var LB_TABLE_IDS = {
    exercises: 'lb-table-exercises',
    streak: 'lb-table-streak',
    times: 'lb-table-times'
  };
  var LB_TBODY_IDS = {
    exercises: 'leaderboard-body-exercises',
    streak: 'leaderboard-body-streak',
    times: 'leaderboard-body-times'
  };

  var messageEl = document.getElementById('leaderboard-message');
  var panelExercises = document.getElementById('lb-panel-exercises');
  var panelTimes = document.getElementById('lb-panel-times');
  var userRankLabels = document.getElementById('lb-user-rank-labels');
  var exerciseSearch = document.getElementById('lb-exercise-search');
  var exerciseSuggestions = document.getElementById('lb-exercise-suggestions');
  var exerciseHint = document.getElementById('lb-exercise-hint');
  var timeSport = document.getElementById('lb-time-sport');
  var timeDistance = document.getElementById('lb-time-distance');
  var timeEvent = document.getElementById('lb-time-event');
  var tableScroll = document.getElementById('lb-table-scroll');
  var pinTop = document.getElementById('lb-table-pin-top');
  var pinBottom = document.getElementById('lb-table-pin-bottom');
  var userRankRow = document.getElementById('leaderboard-user-row');

  var LB_VISIBLE_ROWS = 10;
  var lbUserRowObserver = null;
  var lbSelfRowEl = null;
  var lbSelfRowData = null;

  var state = {
    audience: 'global',
    mode: 'exercises'
  };

  var ADD_EXERCISE_SURVEY_URL = '/survey/exercises';
  var lbSearchDebounceTimer = null;
  var lbSearchAppliedKey = '';
  var FAVORITES_LS_KEY = 'strongman-favorite-movements';
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
    if (!trimmed) {
      return { valid: false, label: '', exercise: null, suggestions: [] };
    }
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
    if (!raw) {
      return {
        valid: false,
        label: '',
        slug: '',
        rawLabel: '',
        suggestions: [],
        empty: true
      };
    }
    var resolved = resolveExerciseInput(raw);
    return {
      valid: resolved.valid,
      label: resolved.valid ? resolved.label : raw,
      slug: exerciseSlug(resolved.valid ? resolved.label : raw),
      rawLabel: raw,
      suggestions: resolved.suggestions || []
    };
  }

  function validatedTimesQuery() {
    var sport = timeSport && timeSport.value ? String(timeSport.value).trim() : '';
    var distance = timeDistance && timeDistance.value ? String(timeDistance.value).trim() : '';
    var event = timeEvent && timeEvent.value ? String(timeEvent.value).trim() : '';
    var empty = !sport && !distance && !event;
    var valid = !!(sport && distance && event);
    return { sport: sport, distance: distance, event: event, valid: valid, empty: empty };
  }

  function timesQueryCacheKey(q) {
    return (
      String(q.sport || '') +
      '|' +
      String(q.distance || '').toLowerCase() +
      '|' +
      String(q.event || '').toLowerCase()
    );
  }

  function activeTbody() {
    return document.getElementById(LB_TBODY_IDS[state.mode]);
  }

  function activeTableEl() {
    return document.getElementById(LB_TABLE_IDS[state.mode]);
  }

  function columnLabelsForMode(mode) {
    if (mode === 'exercises') {
      return ['Rank', 'Username', 'Intensity', 'Weight (' + weightUnitsLabel() + ')', 'Reps'];
    }
    if (mode === 'streak') {
      return ['Rank', 'Username', 'Streak'];
    }
    return ['Rank', 'Username', 'Time'];
  }

  function renderUserRankLabels(mode) {
    if (!userRankLabels) return;
    userRankLabels.setAttribute('data-lb-mode', mode);
    userRankLabels.innerHTML = columnLabelsForMode(mode)
      .map(function (label) {
        return '<span>' + escapeHtml(label) + '</span>';
      })
      .join('');
  }

  function updateWeightHeaderLabel() {
    var thWeight = document.getElementById('lb-th-weight');
    if (thWeight) thWeight.textContent = 'Weight (' + weightUnitsLabel() + ')';
  }

  function applyModeLayout(mode) {
    LB_MODES.forEach(function (m) {
      var tableEl = document.getElementById(LB_TABLE_IDS[m]);
      if (tableEl) tableEl.hidden = m !== mode;
    });
    if (userRankRow) userRankRow.setAttribute('data-lb-mode', mode);
    updateWeightHeaderLabel();
    renderUserRankLabels(mode);
    updatePickerVisibility();
  }

  function tableColspan(mode) {
    if (mode === 'exercises') return 5;
    return 3;
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
        commitLeaderboardFilters();
      });
    });
  }

  function renderEmptyLeaderboard(message) {
    applyModeLayout(state.mode);
    clearUserRowPins();
    var tbodyEl = activeTbody();
    LB_MODES.forEach(function (mode) {
      var tb = document.getElementById(LB_TBODY_IDS[mode]);
      if (tb) tb.innerHTML = '';
    });
    if (tbodyEl) {
      tbodyEl.innerHTML =
        '<tr><td colspan="' +
        tableColspan(state.mode) +
        '">' +
        escapeHtml(message || 'No entries to show yet.') +
        '</td></tr>';
    }
    if (messageEl) messageEl.textContent = '';
    resetUserRankBar();
  }

  function resetUserRankBar() {
    var ids = [
      'lb-user-rank-num',
      'lb-user-name',
      'lb-user-intensity',
      'lb-user-weight',
      'lb-user-reps',
      'lb-user-metric'
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
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

  function formatIntensity(user) {
    if (user.intensity != null && !isNaN(Number(user.intensity))) {
      return String(Math.round(Number(user.intensity)));
    }
    return '—';
  }

  function formatReps(user) {
    if (user.reps != null && !isNaN(Number(user.reps)) && Number(user.reps) > 0) {
      return String(Number(user.reps));
    }
    if (
      user.liftWeight != null &&
      !isNaN(Number(user.liftWeight)) &&
      Number(user.liftWeight) > 0
    ) {
      return '1';
    }
    return '—';
  }

  function formatTimeDisplay(user) {
    if (user.timeDisplay) return String(user.timeDisplay);
    return '—';
  }

  function exerciseSlug(label) {
    return String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function exerciseQueryCacheKey(q) {
    return (q.slug || '') + '|' + String(q.label || '').toLowerCase();
  }

  function userHasRankedEntry(user, mode) {
    if (!user) return false;
    if (mode === 'exercises') {
      return (
        user.intensity != null &&
        !isNaN(Number(user.intensity)) &&
        Number(user.intensity) > 0
      );
    }
    if (mode === 'streak') {
      return user.streak != null && !isNaN(Number(user.streak)) && Number(user.streak) > 0;
    }
    if (mode === 'times') {
      return user.timeSeconds != null && !isNaN(Number(user.timeSeconds)) && Number(user.timeSeconds) > 0;
    }
    return false;
  }

  function filterRankedUsers(list, mode) {
    if (mode === 'exercises') {
      return list.filter(function (u) {
        return userHasRankedEntry(u, mode);
      });
    }
    if (mode === 'times') {
      return list.filter(function (u) {
        return userHasRankedEntry(u, mode);
      });
    }
    if (mode === 'streak') {
      return list.filter(function (u) {
        return userHasRankedEntry(u, mode);
      });
    }
    return list;
  }

  function streakMetric(user) {
    var days = user && user.streak != null ? Number(user.streak) : null;
    if (days != null && !isNaN(days) && days > 0) {
      return String(days) + (days === 1 ? ' day' : ' days');
    }
    return '—';
  }

  function updatePickerVisibility() {
    var mode = state.mode;
    if (panelExercises) panelExercises.hidden = mode !== 'exercises';
    if (panelTimes) panelTimes.hidden = mode !== 'times';
    if (mode !== 'exercises') hideExerciseHint();
  }

  function buildRowCellsHtml(user, rank, mode) {
    var html =
      '<td>' + rank + '</td><td>' + usernameCellHtml(user) + '</td>';
    if (mode === 'exercises') {
      html +=
        '<td>' +
        escapeHtml(formatIntensity(user)) +
        '</td><td>' +
        escapeHtml(formatLiftWeight(user.liftWeight)) +
        '</td><td>' +
        escapeHtml(formatReps(user)) +
        '</td>';
    } else if (mode === 'streak') {
      html += '<td>' + escapeHtml(streakMetric(user)) + '</td>';
    } else {
      html += '<td>' + escapeHtml(formatTimeDisplay(user)) + '</td>';
    }
    return html;
  }

  function clearUserRowPins() {
    lbSelfRowEl = null;
    lbSelfRowData = null;
    if (lbUserRowObserver) {
      lbUserRowObserver.disconnect();
      lbUserRowObserver = null;
    }
    if (pinTop) {
      pinTop.hidden = true;
      pinTop.innerHTML = '';
    }
    if (pinBottom) {
      pinBottom.hidden = true;
      pinBottom.innerHTML = '';
    }
  }

  function renderPinRow(container, user, rank, mode, position) {
    if (!container || !user) return;
    container.innerHTML =
      '<table><tbody><tr class="lb-row-self">' +
      buildRowCellsHtml(user, rank, mode) +
      '</tr></tbody></table>';
    container.hidden = false;
    container.setAttribute('aria-hidden', 'false');
    container.setAttribute('data-pin-position', position);
  }

  function setupUserRowPinObserver(user, rank, mode) {
    clearUserRowPins();
    if (!tableScroll || !user || !lbSelfRowEl) return;
    lbSelfRowData = { user: user, rank: rank, mode: mode };

    function updatePins(isVisible) {
      if (!lbSelfRowData) return;
      if (isVisible) {
        if (pinTop) {
          pinTop.hidden = true;
          pinTop.innerHTML = '';
        }
        if (pinBottom) {
          pinBottom.hidden = true;
          pinBottom.innerHTML = '';
        }
        return;
      }
      var rowTop = lbSelfRowEl.offsetTop;
      var scrollTop = tableScroll.scrollTop;
      var viewport = tableScroll.clientHeight;
      if (rowTop < scrollTop) {
        renderPinRow(pinTop, lbSelfRowData.user, lbSelfRowData.rank, lbSelfRowData.mode, 'top');
        if (pinBottom) {
          pinBottom.hidden = true;
          pinBottom.innerHTML = '';
        }
      } else if (rowTop + lbSelfRowEl.offsetHeight > scrollTop + viewport) {
        renderPinRow(
          pinBottom,
          lbSelfRowData.user,
          lbSelfRowData.rank,
          lbSelfRowData.mode,
          'bottom'
        );
        if (pinTop) {
          pinTop.hidden = true;
          pinTop.innerHTML = '';
        }
      }
    }

    if (typeof IntersectionObserver === 'function') {
      lbUserRowObserver = new IntersectionObserver(
        function (entries) {
          var entry = entries[0];
          updatePins(entry && entry.isIntersecting);
        },
        { root: tableScroll, threshold: 0.01 }
      );
      lbUserRowObserver.observe(lbSelfRowEl);
    }

    tableScroll.onscroll = function () {
      if (!lbSelfRowEl || !lbSelfRowData) return;
      var rect = lbSelfRowEl.getBoundingClientRect();
      var rootRect = tableScroll.getBoundingClientRect();
      var visible =
        rect.bottom > rootRect.top + 2 && rect.top < rootRect.bottom - 2;
      updatePins(visible);
    };
  }

  function scrollToInitialUserPosition(userIdx, totalRows) {
    if (!tableScroll || userIdx < 0 || totalRows <= LB_VISIBLE_ROWS) {
      if (tableScroll) tableScroll.scrollTop = 0;
      return;
    }
    if (userIdx < LB_VISIBLE_ROWS) {
      tableScroll.scrollTop = 0;
      return;
    }
    var rowHeight = lbSelfRowEl ? lbSelfRowEl.offsetHeight : 44;
    var targetTop = Math.max(0, (userIdx - LB_VISIBLE_ROWS + 1) * rowHeight);
    tableScroll.scrollTop = targetTop;
  }

  function updateUserRankBar(rowUser, rank, mode, currentUser) {
    if (isPublicLeaderboard) return;
    var userRankEl = document.getElementById('lb-user-rank-num');
    var userNameEl = document.getElementById('lb-user-name');
    var userIntensityEl = document.getElementById('lb-user-intensity');
    var userWeightEl = document.getElementById('lb-user-weight');
    var userRepsEl = document.getElementById('lb-user-reps');
    var userMetricEl = document.getElementById('lb-user-metric');

    if (currentUser && rowUser) {
      if (userRankEl) userRankEl.textContent = String(rank);
      if (userNameEl) userNameEl.textContent = rowUser.username || currentUser.username || '—';
      if (mode === 'exercises') {
        if (userIntensityEl) userIntensityEl.textContent = formatIntensity(rowUser);
        if (userWeightEl) userWeightEl.textContent = formatLiftWeight(rowUser.liftWeight);
        if (userRepsEl) userRepsEl.textContent = formatReps(rowUser);
      } else if (userMetricEl) {
        userMetricEl.textContent =
          mode === 'times' ? formatTimeDisplay(rowUser) : streakMetric(rowUser);
      }
    } else if (currentUser) {
      if (userRankEl) userRankEl.textContent = '—';
      if (userNameEl) userNameEl.textContent = currentUser.username || '—';
      if (mode === 'exercises') {
        if (userIntensityEl) userIntensityEl.textContent = 'none recorded';
        if (userWeightEl) userWeightEl.textContent = '—';
        if (userRepsEl) userRepsEl.textContent = '—';
      } else if (userMetricEl) {
        userMetricEl.textContent = 'none recorded';
      }
    } else {
      resetUserRankBar();
    }
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
    populateDatalist(exerciseSuggestions, labels);
  }

  function sortUsers(users, mode) {
    var list = (users || []).slice();
    if (mode === 'exercises') {
      list.sort(function (a, b) {
        var ia =
          a.intensity != null && !isNaN(Number(a.intensity)) ? Number(a.intensity) : -Infinity;
        var ib =
          b.intensity != null && !isNaN(Number(b.intensity)) ? Number(b.intensity) : -Infinity;
        if (ib !== ia) return ib - ia;
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
        var ta =
          a.timeSeconds != null && !isNaN(Number(a.timeSeconds))
            ? Number(a.timeSeconds)
            : Infinity;
        var tb =
          b.timeSeconds != null && !isNaN(Number(b.timeSeconds))
            ? Number(b.timeSeconds)
            : Infinity;
        if (ta !== tb) return ta - tb;
        return String(a.username || '').localeCompare(String(b.username || ''));
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
    var tbodyEl = activeTbody();
    if (!tbodyEl) return;
    clearUserRowPins();
    LB_MODES.forEach(function (mode) {
      var tb = document.getElementById(LB_TBODY_IDS[mode]);
      if (tb) tb.innerHTML = '';
    });
    var mode = state.mode;
    applyModeLayout(mode);

    var scoped = filterByAudience(users, state.audience);
    if (scoped.needsSignIn) {
      tbodyEl.innerHTML =
        '<tr><td colspan="' +
        tableColspan(mode) +
        '">Sign in to see this leaderboard view.</td></tr>';
      return;
    }

    var sortedAll = filterRankedUsers(scoped.list, mode);
    var currentUser =
      !isPublicLeaderboard && window.getCurrentUser && window.getCurrentUser();

    if (!sortedAll.length) {
      var emptyMsg =
        mode === 'exercises'
          ? 'No lifts recorded for this exercise yet.'
          : mode === 'times'
            ? 'No times logged for this event yet. Log a PR from Tracking.'
            : 'No one to show for this view yet.';
      tbodyEl.innerHTML =
        '<tr><td colspan="' + tableColspan(mode) + '">' + escapeHtml(emptyMsg) + '</td></tr>';
      updateUserRankBar(null, 0, mode, currentUser);
      return;
    }

    lbSelfRowEl = null;
    sortedAll.forEach(function (user, i) {
      var tr = document.createElement('tr');
      var rank = i + 1;
      if (currentUser && currentUser.id === user.id) {
        tr.classList.add('lb-row-self');
        lbSelfRowEl = tr;
      }
      tr.innerHTML = buildRowCellsHtml(user, rank, mode);
      tbodyEl.appendChild(tr);
    });

    var userIdx = currentUser
      ? sortedAll.findIndex(function (u) {
          return u.id === currentUser.id;
        })
      : -1;
    var rowUser = userIdx >= 0 ? sortedAll[userIdx] : null;
    updateUserRankBar(rowUser, userIdx >= 0 ? userIdx + 1 : 0, mode, currentUser);

    if (tableScroll) {
      scrollToInitialUserPosition(userIdx, sortedAll.length);
    }
    if (rowUser && lbSelfRowEl) {
      setupUserRowPinObserver(rowUser, userIdx + 1, mode);
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
      var tq = validatedTimesQuery();
      if (!tq.valid) {
        return Promise.reject({ code: 'incomplete_times', query: tq });
      }
      var timesPath =
        '/leaderboard/times?sport=' +
        encodeURIComponent(tq.sport) +
        '&distance=' +
        encodeURIComponent(tq.distance) +
        '&event=' +
        encodeURIComponent(tq.event);
      return window.apiGet(timesPath).then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      });
    }
    var q = validatedExerciseQuery();
    if (q.empty) {
      return Promise.reject({ code: 'empty_exercise', query: q });
    }
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
    var mode = state.mode;
    applyModeLayout(mode);

    if (mode === 'exercises') {
      var validated = validatedExerciseQuery();
      if (validated.empty) {
        hideExerciseHint();
        renderEmptyLeaderboard('Search for an exercise to view the leaderboard.');
        return;
      }
      if (!validated.valid) {
        lbExerciseValid = false;
        showUnknownExerciseHint(validated.label);
        renderEmptyLeaderboard('Pick a registered exercise to view the leaderboard.');
        return;
      }
    } else if (mode === 'times') {
      hideExerciseHint();
      var timesQ = validatedTimesQuery();
      if (timesQ.empty) {
        renderEmptyLeaderboard('Select a sport, distance, and event to view times.');
        return;
      }
      if (!timesQ.valid) {
        renderEmptyLeaderboard('Select a sport, distance, and event to view times.');
        return;
      }
    } else {
      hideExerciseHint();
    }

    if (messageEl) messageEl.textContent = 'Loading…';
    var loadingBody = activeTbody();
    if (loadingBody) {
      loadingBody.innerHTML =
        '<tr><td colspan="' + tableColspan(mode) + '">Loading…</td></tr>';
    }

    if (mode === 'exercises' && exerciseSearch) {
      var exerciseValidated = validatedExerciseQuery();
      lbExerciseValid = true;
      hideExerciseHint();
      if (exerciseSearch.value !== exerciseValidated.label) {
        exerciseSearch.value = exerciseValidated.label;
      }
      lbSearchAppliedKey = exerciseQueryCacheKey({
        label: exerciseValidated.label,
        slug: exerciseValidated.slug
      });
    } else if (mode === 'times') {
      lbSearchAppliedKey = timesQueryCacheKey(validatedTimesQuery());
    } else {
      lbSearchAppliedKey = '';
    }

    fetchLeaderboardRows()
      .then(function (rows) {
        lbRows = Array.isArray(rows) ? rows : [];
        return fetchScopeLists(state.audience);
      })
      .then(function () {
        renderLeaderboard(lbRows);
        if (messageEl) messageEl.textContent = '';
      })
      .catch(function (err) {
        if (err && err.code === 'empty_exercise') {
          renderEmptyLeaderboard('Search for an exercise to view the leaderboard.');
          return;
        }
        if (err && err.code === 'incomplete_times') {
          renderEmptyLeaderboard('Select a sport, distance, and event to view times.');
          return;
        }
        if (err && err.code === 'unknown_exercise') {
          showUnknownExerciseHint(err.query && err.query.label ? err.query.label : '');
          renderEmptyLeaderboard('Pick a registered exercise to view the leaderboard.');
          return;
        }
        renderEmptyLeaderboard('Could not load leaderboard. Try again in a moment.');
        if (messageEl) messageEl.textContent = 'Leaderboard unavailable right now.';
      });
  }

  function commitLeaderboardFilters() {
    if (state.mode === 'exercises') {
      var validated = validatedExerciseQuery();
      var key = exerciseQueryCacheKey({
        label: validated.valid ? validated.label : validated.rawLabel,
        slug: validated.slug
      });
      if (validated.empty) {
        lbSearchAppliedKey = '';
        renderEmptyLeaderboard('Search for an exercise to view the leaderboard.');
        return;
      }
      if (key === lbSearchAppliedKey) return;
      lbSearchAppliedKey = key;
      loadLeaderboard();
      return;
    }
    if (state.mode === 'times') {
      var tq = validatedTimesQuery();
      var timesKey = timesQueryCacheKey(tq);
      if (tq.empty) {
        lbSearchAppliedKey = '';
        renderEmptyLeaderboard('Select a sport, distance, and event to view times.');
        return;
      }
      if (timesKey === lbSearchAppliedKey) return;
      lbSearchAppliedKey = timesKey;
      loadLeaderboard();
    }
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
        applyModeLayout(value);
      }
      loadLeaderboard();
    });
  });

  wirePickerSearch(exerciseSearch, commitLeaderboardFilters);
  if (timeSport) {
    timeSport.addEventListener('change', commitLeaderboardFilters);
  }
  wirePickerSearch(timeDistance, commitLeaderboardFilters);
  wirePickerSearch(timeEvent, commitLeaderboardFilters);

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

  applyModeLayout(state.mode);

  initLeaderboardExerciseDb().then(function () {
    if (state.mode === 'streak') {
      loadLeaderboard();
    } else {
      renderEmptyLeaderboard(
        state.mode === 'times'
          ? 'Select a sport, distance, and event to view times.'
          : 'Search for an exercise to view the leaderboard.'
      );
    }
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

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var uid = compUid();
        if (!uid) return;
        setErr('');
        if (fOpp) fOpp.value = '';
        if (fOppId) fOppId.value = '';
        if (fGoal) fGoal.value = '';
        if (fW) fW.value = '';
        if (fEnd) fEnd.value = '';
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
