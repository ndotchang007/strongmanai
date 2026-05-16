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

  // Graph: each pane is a fixed metric (Weight / Reps); the exercise select prefixes both titles.
  var graphWeightTitleEl = document.getElementById('graph-weight-title');
  var graphRepsTitleEl = document.getElementById('graph-reps-title');
  function updateGraphTitles() {
    var exercise = graphExerciseSelect ? graphExerciseSelect.options[graphExerciseSelect.selectedIndex].text : '';
    var prefix = exercise ? exercise + ' — ' : '';
    if (graphWeightTitleEl) graphWeightTitleEl.textContent = prefix + 'Weight (lb)';
    if (graphRepsTitleEl) graphRepsTitleEl.textContent = prefix + 'Reps';
  }
  updateGraphTitles();
  if (graphExerciseSelect) {
    graphExerciseSelect.addEventListener('change', function () {
      updateGraphTitles();
      // TODO: when other exercises exist, switch both chart datasets by selected exercise
    });
  }

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
