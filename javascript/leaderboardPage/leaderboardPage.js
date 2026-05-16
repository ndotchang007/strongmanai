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
  var thTenure = document.getElementById('lb-th-tenure');

  var state = {
    audience: 'global',
    mode: 'exercises'
  };

  var MOCK_USERS = [];
  for (var m = 0; m < 10; m++) {
    MOCK_USERS.push({
      id: m + 1,
      username: 'Username_' + (1234 + m),
      weight: 200 - m * 7,
      height: 70 + (m % 3),
      experience: '7 years'
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

  function formatTenure(user) {
    if (user && user.experience) return user.experience;
    return '7 years';
  }

  function syntheticTimeMinutes(user) {
    var id = user && user.id != null ? Number(user.id) : 0;
    var base = 8 + (id % 50) + (id % 7) * 0.5;
    var mins = Math.floor(base);
    var secs = Math.floor((base - mins) * 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function metricForUser(user, mode) {
    if (mode === 'times') {
      return syntheticTimeMinutes(user);
    }
    if (user.weight != null) return String(user.weight);
    return '—';
  }

  function userRowMetric(user, mode) {
    if (mode === 'times') {
      return syntheticTimeMinutes(user);
    }
    if (user.weight != null) return String(user.weight);
    return 'none recorded';
  }

  function updateTableHeaders(mode) {
    if (!thMetric || !thTenure) return;
    if (mode === 'times') {
      thMetric.textContent = 'Time';
      thTenure.textContent = 'Tenure';
    } else {
      thMetric.textContent = 'Value (lb)';
      thTenure.textContent = 'Tenure';
    }
  }

  function sortUsers(users, mode) {
    var list = (users || []).slice();
    if (mode === 'exercises') {
      list.sort(function (a, b) {
        var wa = a.weight != null ? a.weight : -1;
        var wb = b.weight != null ? b.weight : -1;
        return wb - wa;
      });
    } else {
      list.sort(function (a, b) {
        return syntheticTimeMinutes(a).localeCompare(syntheticTimeMinutes(b));
      });
    }
    return list;
  }

  function renderLeaderboard(users) {
    if (!tbody) return;
    tbody.innerHTML = '';
    var mode = state.mode;
    updateTableHeaders(mode);

    var list = sortUsers(users, mode).slice(0, 10);
    var currentUser =
      !isPublicLeaderboard && window.getCurrentUser && window.getCurrentUser();

    list.forEach(function (user, i) {
      var tr = document.createElement('tr');
      if (currentUser && currentUser.id === user.id) {
        tr.classList.add('lb-row-self');
      }
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + usernameCellHtml(user) + '</td>' +
        '<td>' + escapeHtml(metricForUser(user, mode)) + '</td>' +
        '<td>' + escapeHtml(formatTenure(user)) + '</td>';
      tbody.appendChild(tr);
    });

    if (isPublicLeaderboard) {
      return;
    }

    var sortedAll = sortUsers(users, mode);
    var userRankEl = document.getElementById('lb-user-rank-num');
    var userNameEl = document.getElementById('lb-user-name');
    var userMetricEl = document.getElementById('lb-user-metric');
    var userTenureEl = document.getElementById('lb-user-tenure');

    if (currentUser && sortedAll.length) {
      var idx = sortedAll.findIndex(function (u) {
        return u.id === currentUser.id;
      });
      var rowUser = idx >= 0 ? sortedAll[idx] : null;
      if (rowUser) {
        if (userRankEl) userRankEl.textContent = String(idx + 1);
        if (userNameEl) userNameEl.textContent = rowUser.username || currentUser.username || '—';
        if (userMetricEl) userMetricEl.textContent = userRowMetric(rowUser, mode);
        if (userTenureEl) userTenureEl.textContent = formatTenure(rowUser);
      } else {
        if (userRankEl) userRankEl.textContent = '1024';
        if (userNameEl) userNameEl.textContent = currentUser.username || 'Username_1234';
        if (userMetricEl) userMetricEl.textContent = mode === 'exercises' ? 'none recorded' : '00:00';
        if (userTenureEl) userTenureEl.textContent = '7 years';
      }
    } else {
      if (userRankEl) userRankEl.textContent = '1024';
      if (userNameEl) userNameEl.textContent = 'Username_1234';
      if (userMetricEl) userMetricEl.textContent = mode === 'exercises' ? 'none recorded' : '00:00';
      if (userTenureEl) userTenureEl.textContent = '7 years';
    }
  }

  function loadLeaderboard() {
    if (messageEl) messageEl.textContent = 'Loading…';
    window.apiGet('/users')
      .then(function (res) {
        return res.json();
      })
      .then(function (users) {
        if (!Array.isArray(users) || users.length === 0) {
          renderLeaderboard(MOCK_USERS);
          if (messageEl) messageEl.textContent = '';
          return;
        }
        renderLeaderboard(users);
        if (messageEl) messageEl.textContent = '';
      })
      .catch(function () {
        renderLeaderboard(MOCK_USERS);
        if (messageEl) messageEl.textContent = 'Showing sample data (backend unavailable).';
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
      loadLeaderboard();
    });
  });

  var compState = 'finished';
  var compTickId = null;

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
    grid.appendChild(row('Progress', padPct(comp.progressSelfPct), oppPct));
    grid.appendChild(
      row(
        'Weight increase',
        (comp.weightCurrentLb != null ? String(comp.weightCurrentLb) : '0') + ' LBS',
        (comp.weightGoalLb != null ? String(comp.weightGoalLb) : '0') + ' LBS'
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
        if (act === 'delete') {
          if (!window.confirm('Remove this competition from this device?')) return;
          window.competitionsStoreRemove(uid, id);
        } else if (act === 'finish') {
          window.competitionsStoreUpdate(uid, id, { status: 'finished' });
        }
        renderCompetitionsSection();
      });
    });

    startCompTicker();
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
        if (fGoal) fGoal.value = '';
        if (fW) fW.value = '';
        if (fEnd) fEnd.value = defaultEndDate();
        openCompFormOverlay();
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
        var opp = fOpp ? fOpp.value.trim() : '';
        var goal = fGoal ? fGoal.value.trim() : '';
        var w = fW ? Number(fW.value) : 0;
        var end = fEnd ? fEnd.value.trim() : '';
        if (!opp) return setErr('Add an opponent name.');
        if (!goal) return setErr('Describe your goal.');
        if (!Number.isFinite(w) || w <= 0) return setErr('Enter a target increase in pounds (greater than zero).');
        if (!end) return setErr('Pick an end date.');
        if (end < ymdToday()) return setErr('End date must be today or later.');
        window.competitionsStoreAdd(uid, {
          opponentName: opp,
          goalTitle: goal,
          weightGoalLb: w,
          startDate: ymdToday(),
          endDate: end,
          progressSelfPct: 0,
          opponentProgressPct: null,
          winsSelf: 0,
          winsOpp: 0,
          status: 'ongoing'
        });
        closeCompFormOverlay();
        compState = 'ongoing';
        document.querySelectorAll('.lb-comp-toggle-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-comp-state') === 'ongoing');
        });
        renderCompetitionsSection();
      });
    }
  }

  if (!isPublicLeaderboard) {
    var initToggle = document.querySelector('.lb-comp-toggle-btn.active');
    compState =
      initToggle && initToggle.getAttribute('data-comp-state')
        ? initToggle.getAttribute('data-comp-state')
        : 'finished';
    wireCompetitionForm();
    renderCompetitionsSection();
  }

  loadLeaderboard();
})();
