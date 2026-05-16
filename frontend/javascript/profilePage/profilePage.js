(function () {
  var GRAY_THUMB =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect fill="#2a2a2a" width="100%" height="100%"/></svg>'
    );

  var DEFAULT_AVATAR = '../../assets/default-user.png';
  var BADGES_STORE_KEY = 'strongman_user_badges_v1';
  var AVATAR_FALLBACK_SVG =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
        '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="#2a2a2a"/><stop offset="100%" stop-color="#1a1a1a"/></linearGradient></defs>' +
        '<circle cx="128" cy="128" r="128" fill="url(#g)"/>' +
        '<circle cx="128" cy="96" r="44" fill="#5c5c5c"/>' +
        '<ellipse cx="128" cy="210" rx="72" ry="56" fill="#5c5c5c"/>' +
        '</svg>'
    );

  function loadBadgeRows(userId) {
    if (userId == null) return [];
    try {
      var raw = localStorage.getItem(BADGES_STORE_KEY);
      var bag = raw ? JSON.parse(raw) : {};
      var uid = String(userId);
      var list = bag && Array.isArray(bag[uid]) ? bag[uid] : [];
      return list.filter(function (b) {
        return b && typeof b.label === 'string' && String(b.label).trim();
      });
    } catch (e) {
      return [];
    }
  }

  function saveBadgeRows(userId, rows) {
    if (userId == null) return;
    try {
      var raw = localStorage.getItem(BADGES_STORE_KEY);
      var bag = raw ? JSON.parse(raw) : {};
      if (typeof bag !== 'object' || bag === null) bag = {};
      bag[String(userId)] = rows;
      localStorage.setItem(BADGES_STORE_KEY, JSON.stringify(bag));
    } catch (e) {}
  }

  function chipClassForKind(kind) {
    if (kind === 'platform') return 'profile-chip--gold';
    if (kind === 'cardio') return 'profile-chip--muted';
    return 'profile-chip--accent';
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

  var profileLink = document.querySelector('.sidebar-profile-trigger');
  if (profileLink && currentPage === 'profile') {
    profileLink.classList.add('sidebar-link-active');
  }

  function fillThumbGrid(container, altPrefix) {
    if (!container || container.querySelector('img')) return;
    for (var i = 0; i < 9; i += 1) {
      var img = document.createElement('img');
      img.src = GRAY_THUMB;
      img.alt = altPrefix + ' ' + (i + 1);
      img.className = 'profile-thumb';
      img.loading = 'lazy';
      img.width = 300;
      img.height = 300;
      container.appendChild(img);
    }
  }

  fillThumbGrid(document.getElementById('profile-thumb-grid'), 'Post thumbnail');
  fillThumbGrid(document.getElementById('profile-bookmark-grid'), 'Saved thumbnail');

  var tabGrid = document.getElementById('tab-grid');
  var tabBookmark = document.getElementById('tab-bookmark');
  var panelGrid = document.getElementById('panel-grid');
  var panelBookmark = document.getElementById('panel-bookmark');
  var gallerySection = document.getElementById('profile-gallery');

  function setActiveTab(name) {
    var isGrid = name === 'grid';
    if (tabGrid) {
      tabGrid.classList.toggle('profile-tabstrip-btn--active', isGrid);
      tabGrid.setAttribute('aria-selected', isGrid ? 'true' : 'false');
    }
    if (tabBookmark && !tabBookmark.hidden) {
      tabBookmark.classList.toggle('profile-tabstrip-btn--active', !isGrid);
      tabBookmark.setAttribute('aria-selected', isGrid ? 'false' : 'true');
    }
    if (panelGrid) {
      panelGrid.classList.toggle('profile-tab-panel--active', isGrid);
    }
    if (panelBookmark && !tabBookmark.hidden) {
      panelBookmark.classList.toggle('profile-tab-panel--active', !isGrid);
    } else if (panelBookmark && tabBookmark.hidden) {
      panelBookmark.classList.remove('profile-tab-panel--active');
    }
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (tabGrid) {
    tabGrid.addEventListener('click', function () {
      setActiveTab('grid');
    });
  }
  if (tabBookmark) {
    tabBookmark.addEventListener('click', function () {
      if (!tabBookmark.hidden) setActiveTab('bookmark');
    });
  }

  function bindAvatar(img, displayName, avatarUrl) {
    if (!img) return;
    var url = avatarUrl && String(avatarUrl).trim() ? String(avatarUrl).trim() : DEFAULT_AVATAR;
    img.onerror = function () {
      img.onerror = null;
      if (img.src.indexOf('data:') === 0) return;
      img.src = AVATAR_FALLBACK_SVG;
    };
    img.src = url;
    img.alt = displayName ? displayName + ' profile photo' : 'Profile photo';
  }

  function parseViewedUserId() {
    try {
      var q = new URLSearchParams(window.location.search);
      var raw = q.get('id') || q.get('user');
      if (raw == null || raw === '') return null;
      var n = parseInt(String(raw).trim(), 10);
      if (!Number.isInteger(n) || n < 1) return null;
      return n;
    } catch (e) {
      return null;
    }
  }

  function bioFromUser(u) {
    if (!u) return '';
    if (u.bio || u.profileBio) return String(u.bio || u.profileBio);
    var parts = [];
    if (u.experience) parts.push(String(u.experience));
    if (u.reason) parts.push(String(u.reason));
    return parts.join(' · ');
  }

  function displayNameFromUser(u) {
    if (!u) return 'Member';
    return u.username || u.firstName || 'Member';
  }

  function loadPublicProfile(userId) {
    return window.apiGet('/users/' + userId).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('bad_status');
      return res.json();
    });
  }

  var loginBanner = document.getElementById('profile-login-banner');
  var errorBanner = document.getElementById('profile-error-banner');
  var eyebrowEl = document.getElementById('profile-eyebrow');
  var usernameEl = document.getElementById('profile-username');
  var bioEl = document.getElementById('profile-bio');
  var followingEl = document.getElementById('profile-following');
  var followersEl = document.getElementById('profile-followers');
  var statsRow = document.getElementById('profile-stats-row');
  var avatarImg = document.getElementById('profile-avatar-img');
  var competeBtn = document.getElementById('profile-compete-btn');
  var logoutWrap = document.getElementById('profile-logout-wrap');
  var logoutLink = document.getElementById('profile-logout');
  var editLink = document.getElementById('profile-edit-link');
  var highlightsList = document.getElementById('profile-highlights-list');
  var highlightsEmpty = document.getElementById('profile-highlights-empty');
  var highlightsWrap = document.getElementById('profile-highlights-wrap');
  var badgeAddWrap = document.getElementById('profile-badge-add-wrap');
  var badgeAddBtn = document.getElementById('profile-badge-add-btn');
  var badgeKindEl = document.getElementById('profile-badge-kind');
  var badgeLabelInput = document.getElementById('profile-badge-label-input');

  function setError(msg) {
    if (!errorBanner) return;
    if (!msg) {
      errorBanner.hidden = true;
      errorBanner.textContent = '';
      return;
    }
    errorBanner.hidden = false;
    errorBanner.textContent = msg;
  }

  function applyFollowButtonState(targetUserId, viewer, viewingOther, followOpts) {
    followOpts = followOpts || {};
    var followBtnEl = document.getElementById('profile-follow-btn');
    if (!followBtnEl) return;
    followBtnEl.onclick = null;
    followBtnEl.disabled = false;

    if (!viewingOther || targetUserId == null) {
      followBtnEl.hidden = true;
      return;
    }

    followBtnEl.hidden = false;

    if (!viewer || !viewer.token) {
      followBtnEl.textContent = 'Log in to follow';
      followBtnEl.classList.remove('profile-btn--primary');
      followBtnEl.classList.add('profile-btn--ghost');
      followBtnEl.onclick = function () {
        window.location.href = '/';
      };
      return;
    }

    var viewerFollowsTarget = !!followOpts.viewerFollowsTarget;

    function paintFollowingState() {
      followBtnEl.textContent = viewerFollowsTarget ? 'Following' : 'Follow';
      followBtnEl.classList.toggle('profile-btn--primary', !viewerFollowsTarget);
      followBtnEl.classList.toggle('profile-btn--ghost', viewerFollowsTarget);
    }

    paintFollowingState();

    followBtnEl.onclick = function () {
      var path = '/users/' + encodeURIComponent(String(targetUserId)) + '/follow';
      var del = viewerFollowsTarget;
      var req = del ? window.apiDelete(path) : window.apiPost(path, {});
      followBtnEl.disabled = true;
      req
        .then(function (res) {
          followBtnEl.disabled = false;
          if (!res || !res.ok) {
            if (res && res.json) {
              return res.json().then(function (d) {
                setError((d && d.error) || 'Could not update follow.');
              });
            }
            setError('Could not update follow.');
            return;
          }
          return res.json().then(function (data) {
            viewerFollowsTarget = !!data.viewerFollowsTarget;
            if (followersEl && typeof data.followersCount === 'number') {
              followersEl.textContent = data.followersCount + ' followers';
            }
            setError('');
            paintFollowingState();
          });
        })
        .catch(function () {
          followBtnEl.disabled = false;
          setError('Network error. Try again.');
        });
    };
  }

  function configureTabs(viewingOther) {
    if (!tabBookmark || !panelBookmark) return;
    if (viewingOther) {
      tabBookmark.hidden = true;
      panelBookmark.hidden = true;
      panelBookmark.classList.remove('profile-tab-panel--active');
      if (tabGrid) {
        tabGrid.classList.add('profile-tabstrip-btn--active');
        tabGrid.setAttribute('aria-selected', 'true');
      }
      if (panelGrid) {
        panelGrid.classList.add('profile-tab-panel--active');
      }
    } else {
      tabBookmark.hidden = false;
      panelBookmark.hidden = false;
    }
  }

  function renderBadges(targetUserId, viewingOther) {
    if (!highlightsList) return;
    if (viewingOther || !targetUserId) {
      if (highlightsWrap) highlightsWrap.hidden = true;
      if (badgeAddWrap) badgeAddWrap.hidden = true;
      return;
    }
    if (highlightsWrap) highlightsWrap.hidden = false;
    if (typeof window.ensureJoinPlatformBadge === 'function') {
      window.ensureJoinPlatformBadge(targetUserId);
    }
    var rows = loadBadgeRows(targetUserId);
    if (highlightsEmpty) highlightsEmpty.hidden = rows.length > 0;
    highlightsList.innerHTML = '';
    rows.forEach(function (row) {
      var li = document.createElement('li');
      li.className = 'profile-chip-item';
      var span = document.createElement('span');
      span.className = 'profile-chip ' + chipClassForKind(row.kind || 'lift');
      var prefix = '';
      if (row.kind === 'lift') prefix = 'Lift · ';
      else if (row.kind === 'cardio') prefix = 'Cardio · ';
      span.textContent = prefix + String(row.label).trim();
      li.appendChild(span);
      if (row.id && String(row.id).indexOf('custom-') === 0) {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'profile-chip-remove';
        rm.setAttribute('aria-label', 'Remove this badge');
        rm.textContent = '×';
        (function (rid) {
          rm.addEventListener('click', function () {
            var next = loadBadgeRows(targetUserId).filter(function (r) {
              return r.id !== rid;
            });
            saveBadgeRows(targetUserId, next);
            renderBadges(targetUserId, false);
          });
        })(row.id);
        li.appendChild(rm);
      }
      highlightsList.appendChild(li);
    });
    if (badgeAddWrap) badgeAddWrap.hidden = false;
  }

  var viewedId = parseViewedUserId();
  var viewer = window.getCurrentUser();
  var viewingOther =
    viewedId != null && (!viewer || Number(viewer.id) !== Number(viewedId));

  if (logoutWrap) logoutWrap.hidden = !viewer;

  if (editLink) {
    editLink.hidden = !!(viewingOther || !viewer);
  }

  if (loginBanner) {
    if (!viewer && !viewingOther) {
      loginBanner.hidden = false;
      loginBanner.innerHTML =
        'Not logged in. <a href="/login">Log in</a> or <a href="/signup">sign up</a>.';
    } else if (!viewer && viewingOther) {
      loginBanner.hidden = false;
      loginBanner.innerHTML =
        'Viewing a member profile. <a href="/login">Log in</a> to follow or <a href="/signup">sign up</a>.';
    } else {
      loginBanner.hidden = true;
    }
  }

  setError('');

  configureTabs(viewingOther);

  if (competeBtn) {
    competeBtn.hidden = !viewingOther;
    if (viewingOther) {
      competeBtn.addEventListener('click', function () {
        window.location.href = '/leaderboard';
      });
    }
  }

  if (logoutLink && viewer) {
    logoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.setCurrentUser(null);
      window.location.href = '/';
    });
  }

  if (badgeAddBtn && viewer) {
    badgeAddBtn.addEventListener('click', function () {
      var uid = viewer.id;
      if (!uid) return;
      var kind = badgeKindEl && badgeKindEl.value === 'cardio' ? 'cardio' : 'lift';
      var label = badgeLabelInput && badgeLabelInput.value ? badgeLabelInput.value.trim() : '';
      if (!label) return;
      var rows = loadBadgeRows(uid);
      rows.push({ id: 'custom-' + Date.now(), kind: kind, label: label });
      saveBadgeRows(uid, rows);
      if (badgeLabelInput) badgeLabelInput.value = '';
      renderBadges(uid, false);
    });
  }

  function renderProfile(u, opts) {
    opts = opts || {};
    var displayName = displayNameFromUser(u);
    if (usernameEl) usernameEl.textContent = displayName;
    document.title = displayName + ' · Profile — Strongman AI';

    if (eyebrowEl) {
      eyebrowEl.textContent = opts.viewingOther ? 'Member profile' : 'Your profile';
    }

    var fc = u && u.followingCount != null ? u.followingCount : null;
    var fwc = u && u.followersCount != null ? u.followersCount : null;
    if (statsRow) {
      var showStats = fc != null || fwc != null;
      statsRow.hidden = !showStats;
      if (followingEl && fc != null) followingEl.textContent = fc + ' following';
      if (followersEl && fwc != null) followersEl.textContent = fwc + ' followers';
    }

    if (bioEl) bioEl.textContent = bioFromUser(u);

    bindAvatar(avatarImg, displayName, u && u.avatarUrl);

    renderBadges(u && u.id, !!opts.viewingOther);
  }

  if (viewedId == null) {
    if (!viewer) {
      if (eyebrowEl) eyebrowEl.textContent = 'Your profile';
      if (usernameEl) usernameEl.textContent = 'Guest';
      if (bioEl) bioEl.textContent = '';
      if (statsRow) statsRow.hidden = true;
      bindAvatar(avatarImg, 'Guest', null);
      applyFollowButtonState(null, null, false);
      renderBadges(null, true);
      document.title = 'Profile — Strongman AI';
      return;
    }

    renderProfile(viewer, { viewingOther: false });
    applyFollowButtonState(viewer.id, viewer, false);
    loadPublicProfile(viewer.id).then(function (fresh) {
      if (!fresh) return;
      renderProfile(Object.assign({}, viewer, fresh), { viewingOther: false });
    });
    return;
  }

  if (viewer && Number(viewer.id) === Number(viewedId)) {
    renderProfile(viewer, { viewingOther: false });
    applyFollowButtonState(viewedId, viewer, false);
    loadPublicProfile(viewedId).then(function (fresh) {
      if (!fresh) return;
      renderProfile(Object.assign({}, viewer, fresh), { viewingOther: false });
    });
    return;
  }

  loadPublicProfile(viewedId)
    .then(function (remote) {
      if (!remote) {
        setError('That user could not be found.');
        if (usernameEl) usernameEl.textContent = 'Unknown user';
        if (bioEl) bioEl.textContent = '';
        if (statsRow) statsRow.hidden = true;
        bindAvatar(avatarImg, 'Unknown', null);
        configureTabs(false);
        applyFollowButtonState(null, viewer, false);
        document.title = 'Profile — Strongman AI';
        renderBadges(null, true);
        return;
      }
      renderProfile(remote, { viewingOther: true });
      applyFollowButtonState(viewedId, viewer, true, {
        viewerFollowsTarget: !!remote.viewerFollowsTarget,
      });
    })
    .catch(function () {
      setError('Could not load this profile. Check your connection and try again.');
      if (usernameEl) usernameEl.textContent = 'Error';
      configureTabs(false);
      applyFollowButtonState(null, viewer, false);
      renderBadges(null, true);
    });
})();
