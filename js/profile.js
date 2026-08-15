(function () {
  var GRAY_THUMB =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect fill="#2a2a2a" width="100%" height="100%"/></svg>'
    );

  var DEFAULT_AVATAR = '/assets/default-icon.png';
  var MAX_BIO_LENGTH = 500;
  var EMPTY_BIO_TEXT = 'no bio written';
  var profileSaveInFlight = false;
  var currentAchievementState = null;
  var activeAchFilter = 'all';
  function themeAccentHex() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      return v || '#ff8c00';
    } catch (e) {
      return '#ff8c00';
    }
  }

  function themeOnAccentHex() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--on-accent-text').trim();
      return v || '#141414';
    } catch (e) {
      return '#141414';
    }
  }

  function avatarFallbackSvg(initials, size) {
    var s = size || 256;
    var font = Math.round(s * 0.34);
    var rx = Math.round(s * 0.17);
    return (
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
          s +
          '" height="' +
          s +
          '" viewBox="0 0 ' +
          s +
          ' ' +
          s +
          '">' +
          '<rect fill="' +
          themeAccentHex() +
          '" width="' +
          s +
          '" height="' +
          s +
          '" rx="' +
          rx +
          '"/>' +
          '<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="' +
          themeOnAccentHex() +
          '" font-family="DM Sans,sans-serif" font-size="' +
          font +
          '" font-weight="700">' +
          (initials || '?') +
          '</text></svg>'
      )
    );
  }


  function tierLabel(tier) {
    if (!tier) return 'Badge';
    return String(tier).charAt(0).toUpperCase() + String(tier).slice(1);
  }

  function evaluateAchievements(user, viewingOther) {
    if (!window.Achievements || typeof window.Achievements.evaluate !== 'function') {
      return { all: [], unlocked: [], locked: [], unlockedCount: 0, totalCount: 0 };
    }
    return window.Achievements.evaluate(user, { skipLocalData: !!viewingOther });
  }

  function syncTrainingDataThen(callback) {
    if (window.TrainingSync && typeof window.TrainingSync.syncAll === 'function') {
      window.TrainingSync.syncAll({ callback: callback });
      return;
    }
    var pending = 2;
    var done = false;
    function finish() {
      pending -= 1;
      if (pending <= 0 && !done) {
        done = true;
        if (callback) callback();
      }
    }
    if (window.PRLog && typeof window.PRLog.syncFromServer === 'function') {
      window.PRLog.syncFromServer(finish);
    } else {
      finish();
    }
    if (window.WorkoutLog && typeof window.WorkoutLog.syncFromServer === 'function') {
      window.WorkoutLog.syncFromServer(finish);
    } else {
      finish();
    }
  }

  function buildTrophyCard(ach, opts) {
    opts = opts || {};
    var li = document.createElement('li');
    li.className = 'profile-chip-item';
    if (opts.empty) {
      var empty = document.createElement('div');
      empty.className = 'pf-trophy pf-trophy--empty';
      empty.innerHTML =
        '<span class="pf-trophy-icon" aria-hidden="true">+</span>' +
        '<span class="pf-trophy-label">Empty</span>';
      li.appendChild(empty);
      return li;
    }
    var card = document.createElement('div');
    card.className =
      'pf-trophy pf-trophy--unlocked pf-trophy--tier-' + (ach.tier || 'bronze');
    var icon = document.createElement('span');
    icon.className = 'pf-trophy-icon';
    icon.innerHTML = badgeIconMarkup(ach.kind);
    var tierEl = document.createElement('span');
    tierEl.className = 'pf-trophy-tier';
    tierEl.textContent = tierLabel(ach.tier);
    var labelEl = document.createElement('span');
    labelEl.className = 'pf-trophy-label';
    labelEl.textContent = ach.title;
    card.appendChild(icon);
    card.appendChild(tierEl);
    card.appendChild(labelEl);
    li.appendChild(card);
    return li;
  }

  function buildAchCard(ach) {
    var li = document.createElement('li');
    var card = document.createElement('article');
    card.className =
      'pf-ach-card pf-ach-card--tier-' +
      (ach.tier || 'bronze') +
      ' ' +
      (ach.unlocked ? 'pf-ach-card--unlocked' : 'pf-ach-card--locked');
    if (!ach.unlocked) {
      var lock = document.createElement('span');
      lock.className = 'pf-ach-lock';
      lock.setAttribute('aria-hidden', 'true');
      lock.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      card.appendChild(lock);
    }
    var icon = document.createElement('span');
    icon.className = 'pf-ach-card-icon';
    icon.innerHTML = badgeIconMarkup(ach.kind);
    var tierEl = document.createElement('span');
    tierEl.className = 'pf-ach-tier';
    tierEl.textContent = tierLabel(ach.tier);
    var name = document.createElement('span');
    name.className = 'pf-ach-name';
    name.textContent = ach.title;
    var desc = document.createElement('span');
    desc.className = 'pf-ach-desc';
    desc.textContent = ach.description;
    var prog = document.createElement('span');
    prog.className = 'pf-ach-progress';
    if (ach.unlocked) {
      prog.textContent = 'Unlocked';
    } else if (ach.progressLabel) {
      prog.textContent = ach.progressLabel;
    } else if (ach.target != null && ach.progress != null) {
      prog.textContent = ach.progress + ' / ' + ach.target;
    } else {
      prog.textContent = 'Locked';
    }
    card.appendChild(icon);
    card.appendChild(tierEl);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(prog);
    li.appendChild(card);
    return li;
  }

  function renderProfileXp(u, viewingOther) {
    if (!levelValueEl) return;
    var XP = window.StrongmanXp;
    var total = 0;
    if (!viewingOther && XP && typeof XP.getSnapshot === 'function') {
      total = XP.getSnapshot().totalXp;
    } else if (u && u.totalXp != null) {
      total = Math.max(0, Number(u.totalXp) || 0);
    }
    var level =
      XP && typeof XP.levelFromXp === 'function' ? XP.levelFromXp(total).level : 1;
    levelValueEl.textContent = String(level);
    if (levelStatEl) {
      var xpLabel =
        XP && typeof XP.formatXp === 'function' ? XP.formatXp(total) : String(Math.round(total));
      levelStatEl.title = 'Level ' + level + ' · ' + xpLabel + ' XP';
    }
  }

  function updateAchievementStats(state) {
    if (!state) return;
    if (badgeCountEl) {
      badgeCountEl.textContent = state.unlockedCount + ' / ' + state.totalCount;
    }
    var sub = document.getElementById('profile-badges-subtitle');
    if (sub) {
      if (isViewingOtherProfile) {
        sub.textContent =
          state.unlockedCount + ' of ' + state.totalCount + ' unlocked';
      } else {
        sub.textContent = 'Tap to choose 3';
      }
    }
    var hint = document.getElementById('profile-trophy-hint');
    if (hint) {
      hint.hidden = !!isViewingOtherProfile;
      hint.textContent = 'Edit';
    }
  }

  function renderAchievementModal(state) {
    if (!state) return;
    var subtitle = document.getElementById('profile-ach-subtitle');
    var fill = document.getElementById('profile-ach-progress-fill');
    var grid = document.getElementById('profile-ach-grid');
    if (subtitle) {
      subtitle.textContent = state.unlockedCount + ' / ' + state.totalCount + ' unlocked';
    }
    if (fill && state.totalCount > 0) {
      fill.style.width = Math.round((state.unlockedCount / state.totalCount) * 100) + '%';
    }
    if (!grid) return;
    grid.innerHTML = '';
    var list =
      activeAchFilter === 'all'
        ? state.all
        : state.all.filter(function (a) {
            return a.category === activeAchFilter;
          });
    list.forEach(function (ach) {
      grid.appendChild(buildAchCard(ach));
    });
  }

  function renderAchievementFilters() {
    var wrap = document.getElementById('profile-ach-filters');
    if (!wrap || !window.Achievements) return;
    wrap.innerHTML = '';
    (window.Achievements.CATEGORIES || []).forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'pf-ach-filter' + (activeAchFilter === cat.id ? ' pf-ach-filter--active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', activeAchFilter === cat.id ? 'true' : 'false');
      btn.textContent = cat.label;
      btn.addEventListener('click', function () {
        activeAchFilter = cat.id;
        renderAchievementFilters();
        renderAchievementModal(currentAchievementState);
      });
      wrap.appendChild(btn);
    });
  }

  function openAchievementModal() {
    var overlay = document.getElementById('profile-ach-overlay');
    if (!overlay) return;
    if (currentAchievementState) {
      renderAchievementModal(currentAchievementState);
    }
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = document.getElementById('profile-ach-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeAchievementModal() {
    var overlay = document.getElementById('profile-ach-overlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  function badgeKindLabel(kind) {
    if (kind === 'platform') return 'Platform';
    if (kind === 'cardio') return 'Cardio';
    return 'Lift';
  }

  function badgeIconMarkup(kind) {
    if (kind === 'platform') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
    }
    if (kind === 'cardio') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
    }
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M6 5v14"/><path d="M18 5v14"/><path d="M3 8v8"/><path d="M21 8v8"/><path d="M6 12h12"/></svg>';
  }

  function formatStatNumber(n) {
    var num = Number(n);
    if (!Number.isFinite(num)) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(num);
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

  function setStatCount(el, count) {
    if (!el) return;
    var val = el.querySelector('.profile-stat-value, .pf-stat-num');
    var formatted = formatStatNumber(count);
    if (val) val.textContent = formatted;
    else el.textContent = formatted;
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
    if (gallerySection && gallerySection.isConnected) {
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
    var url = avatarUrl && String(avatarUrl).trim() ? String(avatarUrl).trim() : '';
    img.alt = displayName ? displayName + ' profile photo' : 'Profile photo';
    if (url) {
      img.onerror = function () {
        img.onerror = null;
        if (img.src.indexOf('data:') === 0) return;
        img.src = avatarFallbackSvg('?', 256);
      };
      img.src = url;
      return;
    }
    var initials = '?';
    if (window.UserAvatar && displayName) {
      initials = window.UserAvatar.initialsFromUser({ displayName: displayName, firstName: displayName.split(/\s+/)[0] });
    } else if (displayName) {
      var parts = displayName.split(/\s+/).filter(Boolean);
      initials = parts.length >= 2 ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase() : displayName.slice(0, 2).toUpperCase();
    }
    img.onerror = null;
    img.src = avatarFallbackSvg(initials, 128);
  }

  function parseViewedUserId() {
    try {
      var q = new URLSearchParams(window.location.search);
      var raw = q.get('id') || q.get('user') || q.get('userId');
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
    if (u.bio != null && String(u.bio).trim()) return String(u.bio).trim();
    if (u.profileBio != null && String(u.profileBio).trim()) return String(u.profileBio).trim();
    return '';
  }

  function compressImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1200;
    quality = quality == null ? 0.82 : quality;
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('invalid_type'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) {
            reject(new Error('invalid_image'));
            return;
          }
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas'));
            return;
          }
          ctx.drawImage(img, 0, 0, cw, ch);
          var mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          try {
            resolve(canvas.toDataURL(mime, quality));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = function () {
          reject(new Error('load_failed'));
        };
        img.src = reader.result;
      };
      reader.onerror = function () {
        reject(new Error('read_failed'));
      };
      reader.readAsDataURL(file);
    });
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
  var toolbarEl = document.querySelector('.profile-toolbar');
  var editToggle = null;
  var shareBtn = document.getElementById('profile-share-btn');
  var previewBtn = null;
  var previewBanner = null;
  var followBtn = document.getElementById('profile-follow-btn');
  var avatarChangeLabel = document.getElementById('profile-avatar-change-label');
  var avatarInput = document.getElementById('profile-avatar-input');
  var heroCard = document.querySelector('.profile-card');
  var bioEditWrap = document.getElementById('profile-bio-edit');
  var bioInput = document.getElementById('profile-bio-input');
  var bioCharcount = document.getElementById('profile-bio-charcount');
  var bioSaveBtn = document.getElementById('profile-bio-save');
  var bioCancelBtn = document.getElementById('profile-bio-cancel');
  var saveStatusEl = document.getElementById('profile-save-status');
  var heroActions = document.getElementById('profile-hero-actions');
  var canEditProfile = false;
  var editModeOpen = false;
  var isViewingOtherProfile = false;
  var previewAsVisitor = false;
  var displayedProfileUserId = null;
  var highlightsList = document.getElementById('profile-highlights-list');
  var highlightsEmpty = document.getElementById('profile-highlights-empty');
  var highlightsWrap = document.getElementById('profile-highlights-wrap');
  var showcaseOverlay = document.getElementById('profile-showcase-overlay');
  var showcaseGrid = document.getElementById('profile-showcase-grid');
  var showcaseCountEl = document.getElementById('profile-showcase-count');
  var showcaseSubtitleEl = document.getElementById('profile-showcase-subtitle');
  var experienceTagEl = document.getElementById('profile-experience-tag');
  var experienceTextEl = document.getElementById('profile-experience-text');
  var badgeCountEl = document.getElementById('profile-badge-count');
  var levelValueEl = document.getElementById('profile-level-value');
  var levelStatEl = document.getElementById('profile-level-stat');
  var athleteWrap = document.getElementById('profile-athlete-wrap');
  var athleteGrid = document.getElementById('profile-athlete-grid');
  var sportsWrap = document.getElementById('profile-sports-wrap');
  var sportsChips = document.getElementById('profile-sports-chips');
  var radarMount = document.getElementById('profile-radar-mount');
  var radarEmpty = document.getElementById('profile-radar-empty');
  var radarWrap = document.getElementById('profile-radar-wrap');
  var hexOverlay = document.getElementById('profile-hex-overlay');
  var hexDetailMount = document.getElementById('profile-hex-detail-mount');
  var hexScoresEl = document.getElementById('profile-hex-scores');
  var hexSubtitleEl = document.getElementById('profile-hex-subtitle');
  var lastHexLifts = [];
  var lastHexViewingOther = false;
  var ownerTools = null;
  var userSettingsCta = document.getElementById('profile-user-settings-cta');
  var userSettingsBtn = userSettingsCta;
  var metaRow = document.getElementById('profile-meta-row');
  var SHOWCASE_SLOTS = 3;
  var draftShowcaseIds = [];
  var viewingShowcaseOwnerId = null;

  function setError(msg) {
    if (!errorBanner) return;
    if (!msg) {
      errorBanner.hidden = true;
      errorBanner.textContent = '';
      errorBanner.innerHTML = '';
      return;
    }
    errorBanner.hidden = false;
    errorBanner.textContent = msg;
    errorBanner.innerHTML = '';
  }

  function setSaveStatus(msg, isError) {
    if (!saveStatusEl) return;
    if (!msg) {
      saveStatusEl.hidden = true;
      saveStatusEl.textContent = '';
      saveStatusEl.classList.remove('profile-save-status--error');
      return;
    }
    saveStatusEl.hidden = false;
    saveStatusEl.textContent = msg;
    saveStatusEl.classList.toggle('profile-save-status--error', !!isError);
  }

  function updateBioCharcount() {
    if (!bioCharcount || !bioInput) return;
    var len = bioInput.value ? bioInput.value.length : 0;
    bioCharcount.textContent = len + ' / ' + MAX_BIO_LENGTH;
  }

  function bindBanner() {
    /* Decorative mesh strip only — cover upload removed */
  }

  function setBioDisplay(text) {
    if (!bioEl) return;
    var trimmed = text != null ? String(text).trim() : '';
    if (!trimmed) {
      bioEl.textContent = EMPTY_BIO_TEXT;
      bioEl.classList.add('profile-bio--empty');
    } else {
      bioEl.textContent = trimmed;
      bioEl.classList.remove('profile-bio--empty');
    }
  }

  function isOwnProfileView(viewerUser, targetUserId) {
    if (targetUserId == null) return false;
    if (!viewerUser || viewerUser.id == null) return false;
    return Number(viewerUser.id) === Number(targetUserId);
  }

  function resolveViewedUserId() {
    var fromQuery = parseViewedUserId();
    if (fromQuery != null) return fromQuery;
    var viewerUser = window.getCurrentUser();
    return viewerUser && viewerUser.id != null ? Number(viewerUser.id) : null;
  }

  function setEditMode(open) {
    if (isViewingOtherProfile || !canEditProfile || previewAsVisitor) {
      editModeOpen = false;
      open = false;
    } else {
      editModeOpen = !!open;
    }
    document.body.classList.toggle('profile-is-editing', editModeOpen);
    if (heroCard) heroCard.classList.toggle('profile-card--editing', editModeOpen);
    if (bioEditWrap) {
      bioEditWrap.hidden = !editModeOpen;
      bioEditWrap.setAttribute('aria-hidden', editModeOpen ? 'false' : 'true');
    }
    // Camera control stays available for owners — not only while editing bio.
    if (avatarChangeLabel) avatarChangeLabel.hidden = !canEditProfile || isViewingOtherProfile;
    if (editModeOpen && bioInput) {
      var vu = window.getCurrentUser();
      var raw =
        vu && vu.bio != null && String(vu.bio).trim() ? String(vu.bio).trim() : '';
      bioInput.value = raw === EMPTY_BIO_TEXT ? '' : raw;
      updateBioCharcount();
    }
    if (!editModeOpen && canEditProfile) {
      var cur = window.getCurrentUser();
      if (cur) setBioDisplay(bioFromUser(cur));
    }
  }

  function syncProfileViewState(ownProfile) {
    isViewingOtherProfile = !ownProfile;
    canEditProfile = !!ownProfile && !previewAsVisitor;
    document.body.classList.toggle('profile-is-owner', !!ownProfile);
    document.body.classList.toggle('profile-is-visitor', !ownProfile);
    if (avatarInput) avatarInput.disabled = !ownProfile || previewAsVisitor;
    if (avatarChangeLabel) avatarChangeLabel.hidden = !ownProfile || previewAsVisitor;
    if (previewBtn) {
      previewBtn.hidden = !ownProfile;
    }
    if (!ownProfile) {
      setVisitorPreview(false);
      setEditMode(false);
      if (saveStatusEl) {
        saveStatusEl.hidden = true;
        saveStatusEl.textContent = '';
        saveStatusEl.classList.remove('profile-save-status--error');
      }
      if (bioEditWrap) {
        bioEditWrap.hidden = true;
        bioEditWrap.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function setVisitorPreview(on) {
    if (!canEditProfile && !previewAsVisitor && on) return;
    if (isViewingOtherProfile) on = false;
    previewAsVisitor = !!on;
    document.body.classList.toggle('profile-preview-visitor', previewAsVisitor);
    if (previewBtn) {
      previewBtn.setAttribute('aria-pressed', previewAsVisitor ? 'true' : 'false');
      previewBtn.title = previewAsVisitor ? 'Exit visitor preview' : 'Preview as visitor';
      previewBtn.setAttribute(
        'aria-label',
        previewAsVisitor
          ? 'Exit visitor preview'
          : 'Preview how your profile looks to others'
      );
      var eye = previewBtn.querySelector('.pf-preview-icon--eye');
      var off = previewBtn.querySelector('.pf-preview-icon--off');
      if (eye) eye.hidden = !!previewAsVisitor;
      if (off) off.hidden = !previewAsVisitor;
    }
    if (previewBanner) previewBanner.hidden = !previewAsVisitor;
    if (previewAsVisitor) {
      setEditMode(false);
      if (avatarChangeLabel) avatarChangeLabel.hidden = true;
      if (userSettingsBtn) userSettingsBtn.hidden = true;
      if (toolbarEl) toolbarEl.hidden = false;
      if (followBtn) {
        followBtn.hidden = false;
        followBtn.disabled = true;
        followBtn.textContent = 'Follow';
        followBtn.classList.add('profile-btn--primary');
        followBtn.classList.remove('profile-btn--ghost');
        followBtn.onclick = null;
      }
      if (competeBtn) {
        competeBtn.hidden = false;
        competeBtn.disabled = true;
      }
      if (highlightsWrap) {
        highlightsWrap.classList.remove('pf-card-trophies--editable');
      }
    } else {
      if (avatarChangeLabel) avatarChangeLabel.hidden = !document.body.classList.contains('profile-is-owner');
      if (userSettingsBtn) userSettingsBtn.hidden = !document.body.classList.contains('profile-is-owner');
      if (toolbarEl) toolbarEl.hidden = true;
      if (followBtn) {
        followBtn.disabled = false;
        followBtn.hidden = true;
      }
      if (competeBtn) {
        competeBtn.disabled = false;
        competeBtn.hidden = true;
      }
      if (highlightsWrap && document.body.classList.contains('profile-is-owner')) {
        highlightsWrap.classList.add('pf-card-trophies--editable');
      }
      canEditProfile = document.body.classList.contains('profile-is-owner');
      if (avatarChangeLabel) {
        avatarChangeLabel.hidden = !canEditProfile;
      }
    }
  }

  function profileShareUrl() {
    var id =
      displayedProfileUserId != null
        ? displayedProfileUserId
        : window.getCurrentUser() && window.getCurrentUser().id;
    if (id == null) return window.location.origin + '/profile';
    return window.location.origin + '/profile?id=' + encodeURIComponent(String(id));
  }

  function shareProfileCard() {
    var url = profileShareUrl();
    var name =
      (usernameEl && usernameEl.textContent) ||
      displayNameFromUser(window.getCurrentUser()) ||
      'Strongman AI';
    var title = name + ' on Strongman AI';
    var text = 'Check out ' + name + "'s athlete card on Strongman AI";
    if (navigator.share) {
      navigator
        .share({ title: title, text: text, url: url })
        .catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () {
          setSaveStatus('Profile link copied');
        },
        function () {
          window.prompt('Copy profile link', url);
        }
      );
      return;
    }
    window.prompt('Copy profile link', url);
  }

  function configureProfileEditing(enabled, user) {
    var viewerUser = window.getCurrentUser();
    var targetId =
      displayedProfileUserId != null ? displayedProfileUserId : resolveViewedUserId();
    var isOwn = !!enabled && isOwnProfileView(viewerUser, targetId);
    syncProfileViewState(isOwn);
    if (!isOwn) setEditMode(false);
    // Owner camera stays on the photo always — never gated on bio edit mode.
    if (avatarChangeLabel) avatarChangeLabel.hidden = !isOwn;
    if (canEditProfile && user && bioInput && !editModeOpen) {
      var draft = bioFromUser(user);
      bioInput.value = draft === EMPTY_BIO_TEXT ? '' : draft;
      updateBioCharcount();
    }
  }

  function mergeViewerWithApi(viewer, apiUser) {
    if (!viewer || !apiUser) return apiUser || viewer;
    var merged = Object.assign({}, viewer, apiUser);
    if (apiUser.token) merged.token = apiUser.token;
    else if (viewer.token) merged.token = viewer.token;
    return merged;
  }

  function persistProfilePatch(patch) {
    if (isViewingOtherProfile || !canEditProfile) {
      return Promise.resolve(false);
    }
    var viewer = window.getCurrentUser();
    if (!viewer || !viewer.id || !viewer.token) {
      setError('Log in to update your profile.');
      return Promise.resolve(false);
    }
    if (displayedProfileUserId != null && Number(viewer.id) !== Number(displayedProfileUserId)) {
      return Promise.resolve(false);
    }
    if (profileSaveInFlight) return Promise.resolve(false);
    profileSaveInFlight = true;
    setSaveStatus('Saving…', false);
    return window
      .apiPut('/users/' + viewer.id, patch)
      .then(function (res) {
        return res.json().then(function (body) {
          profileSaveInFlight = false;
          if (!res.ok) {
            var policyHit =
              window.NamePolicy && window.NamePolicy.responseToViolation(body);
            if (policyHit && errorBanner) {
              window.NamePolicy.showPolicyError(errorBanner, policyHit);
              setSaveStatus('', true);
            } else {
              setSaveStatus((body && body.error) || 'Could not save.', true);
            }
            return false;
          }
          var merged = mergeViewerWithApi(viewer, body);
          window.setCurrentUser(merged);
          setSaveStatus('Saved.', false);
          setError('');
          setTimeout(function () {
            setSaveStatus('');
          }, 2200);
          return merged;
        });
      })
      .catch(function () {
        profileSaveInFlight = false;
        setSaveStatus('Network error. Try again.', true);
        return false;
      });
  }

  function handleImagePick(file, field, maxDim) {
    if (!file || isViewingOtherProfile || !canEditProfile) return;
    setSaveStatus('Processing image…', false);
    compressImageFile(file, maxDim, 0.82)
      .then(function (dataUrl) {
        var patch = {};
        patch[field] = dataUrl;
        return persistProfilePatch(patch);
      })
      .then(function (updated) {
        if (!updated) return;
        if (field === 'avatarUrl') bindAvatar(avatarImg, displayNameFromUser(updated), updated.avatarUrl);
        renderProfile(updated, { viewingOther: isViewingOtherProfile, skipEditConfigure: true });
      })
      .catch(function () {
        setSaveStatus('Could not use that image. Try JPEG or PNG.', true);
      });
  }

  function syncToolbarVisibility(viewingOther) {
    if (!toolbarEl) return;
    var show = !!viewingOther;
    toolbarEl.hidden = !show;
  }

  function applyFollowButtonState(targetUserId, viewer, viewingOther, followOpts) {
    followOpts = followOpts || {};
    var followBtnEl = document.getElementById('profile-follow-btn');
    if (!followBtnEl) return;
    followBtnEl.onclick = null;
    followBtnEl.disabled = false;

    if (!viewingOther || targetUserId == null) {
      followBtnEl.hidden = true;
      syncToolbarVisibility(false);
      return;
    }

    followBtnEl.hidden = false;
    syncToolbarVisibility(true);

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
              setStatCount(followersEl, data.followersCount);
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

  function renderExperienceTag() {
    if (experienceTagEl) experienceTagEl.hidden = true;
    if (metaRow && sportsChips) {
      metaRow.hidden = !!sportsChips.hidden;
    }
  }

  function renderSportsChips(u) {
    if (!sportsChips) return;
    var AC = window.AthleteContext;
    var ctx = AC && u ? AC.loadAthleteContext(u) : null;
    var sports = ctx && AC.getSports ? AC.getSports(ctx) : [];
    sportsChips.innerHTML = '';
    var count = 0;
    sports.forEach(function (entry) {
      var name = (entry && entry.sport) || '';
      if (!name) return;
      var li = document.createElement('li');
      li.className = 'pf-sport-chip';
      li.textContent = name;
      sportsChips.appendChild(li);
      count += 1;
    });
    sportsChips.hidden = count === 0;
    if (sportsWrap) sportsWrap.hidden = true;
    if (experienceTagEl) experienceTagEl.hidden = true;
    if (metaRow) metaRow.hidden = count === 0;
  }

  function collectRecentLifts() {
    if (!window.WorkoutLog || typeof window.WorkoutLog.getSessions !== 'function') return [];
    var recent = (window.WorkoutLog.getSessions() || []).slice().reverse().slice(0, 48);
    var lifts = [];
    recent.forEach(function (s) {
      if (!s) return;
      var list = s.exercises || s.lifts || [];
      if (!Array.isArray(list)) return;
      list.forEach(function (ex) {
        if (ex) lifts.push(ex);
      });
    });
    // Fold PR log into the same pool when available (often stronger than recent sets).
    if (window.PRLog && typeof window.PRLog.getRecords === 'function') {
      (window.PRLog.getRecords() || []).forEach(function (pr) {
        if (!pr) return;
        var name = pr.eventLabel || pr.exercise || pr.name;
        if (!name) return;
        var w = null;
        var r = 1;
        if (pr.discipline === 'weightlifting' || pr.weight != null) {
          w = Number(pr.weight);
          if (!Number.isFinite(w) || w <= 0) {
            var vd = String(pr.valueDisplay || '');
            var m = vd.match(/([\d.]+)\s*(lb|kg)?/i);
            if (m) {
              w = parseFloat(m[1]);
              if (m[2] && m[2].toLowerCase() === 'kg') w *= 2.2046226218;
            }
          } else if (pr.unit === 'kg') {
            w *= 2.2046226218;
          }
          r = pr.reps != null ? Number(pr.reps) : 1;
        }
        if (w && w > 0) {
          lifts.push({ name: name, weight: w, reps: r || 1, sets: [{ weight: w, reps: r || 1 }] });
        }
      });
    }
    return lifts;
  }

  function fallbackHexHtml() {
    // Hardcoded baseline hex so the card never shows an empty muscle map.
    var size = 340;
    var cx = 170;
    var cy = 170;
    var r = 112;
    var labels = ['Legs', 'Abs', 'Shoulders', 'Chest', 'Back', 'Arms'];
    var n = 6;
    var rings = [0.33, 0.66, 1]
      .map(function (t) {
        var pts = [];
        for (var k = 0; k < n; k++) {
          var a = (k * 2 * Math.PI) / n - Math.PI / 2;
          pts.push((cx + r * t * Math.cos(a)).toFixed(1) + ',' + (cy + r * t * Math.sin(a)).toFixed(1));
        }
        return '<polygon fill="none" stroke="#ff4d0d" stroke-opacity="0.35" stroke-width="1.35" points="' + pts.join(' ') + '"/>';
      })
      .join('');
    var spokes = '';
    var labs = '';
    var fill = [];
    for (var i = 0; i < n; i++) {
      var ang = (i * 2 * Math.PI) / n - Math.PI / 2;
      var tx = cx + r * Math.cos(ang);
      var ty = cy + r * Math.sin(ang);
      var lx = cx + (r + 28) * Math.cos(ang);
      var ly = cy + (r + 28) * Math.sin(ang);
      var fx = cx + r * 0.1 * Math.cos(ang);
      var fy = cy + r * 0.1 * Math.sin(ang);
      spokes +=
        '<line x1="' +
        cx +
        '" y1="' +
        cy +
        '" x2="' +
        tx.toFixed(1) +
        '" y2="' +
        ty.toFixed(1) +
        '" stroke="#ff4d0d" stroke-opacity="0.4" stroke-width="1.25"/>';
      labs +=
        '<text x="' +
        lx.toFixed(1) +
        '" y="' +
        ly.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="middle" fill="#c8c8d0" font-size="11" font-weight="700" font-family="DM Sans,sans-serif">' +
        labels[i] +
        '</text>';
      fill.push(fx.toFixed(1) + ',' + fy.toFixed(1));
    }
    return (
      '<div class="mm-radar mm-radar--hex" role="img" aria-label="Muscle skills">' +
      '<svg class="mm-radar-svg" viewBox="0 0 ' +
      size +
      ' ' +
      size +
      '" width="100%" style="color:#ff4d0d">' +
      rings +
      spokes +
      '<polygon fill="#ff4d0d" fill-opacity="0.28" stroke="#ff4d0d" stroke-width="2.75" points="' +
      fill.join(' ') +
      '"/>' +
      labs +
      '</svg></div>'
    );
  }

  function renderMuscleHex(viewingOther) {
    if (!radarMount) return;
    if (radarWrap) radarWrap.hidden = false;
    if (radarEmpty) radarEmpty.hidden = true;

    var lifts = [];
    try {
      lifts = viewingOther ? [] : collectRecentLifts();
    } catch (e) {
      lifts = [];
    }
    lastHexLifts = lifts;
    lastHexViewingOther = !!viewingOther;

    var html = '';
    try {
      if (window.MuscleMap && typeof window.MuscleMap.renderRadar === 'function') {
        html = window.MuscleMap.renderRadar(lifts, {
          hex: true,
          title: '',
          spectrum: false,
          user: window.getCurrentUser && window.getCurrentUser(),
        });
      }
    } catch (err) {
      html = '';
    }

    radarMount.innerHTML = html && String(html).indexOf('mm-radar') !== -1 ? html : fallbackHexHtml();

    if (radarEmpty) {
      if (viewingOther) {
        radarEmpty.hidden = false;
        radarEmpty.textContent = 'Baseline map — lift data stays private for now.';
      } else if (!lifts.length) {
        radarEmpty.hidden = false;
        radarEmpty.textContent = 'Log heavy lifts — map uses est. 1RM vs strong standards.';
      } else {
        radarEmpty.hidden = true;
      }
    }
  }

  function formatLb(n) {
    if (!n || !Number.isFinite(n) || n <= 0) return '—';
    return Math.round(n) + ' lb';
  }

  function closeHexDetail() {
    if (!hexOverlay) return;
    hexOverlay.hidden = true;
  }

  function openHexDetail() {
    if (!hexOverlay || !hexDetailMount || !hexScoresEl) return;
    if (!window.MuscleMap) return;

    var lifts = lastHexLifts || [];
    var user = window.getCurrentUser && window.getCurrentUser();
    var html = '';
    try {
      html = window.MuscleMap.renderRadar(lifts, {
        hex: true,
        title: '',
        spectrum: false,
        size: 380,
        user: user,
      });
    } catch (e) {
      html = '';
    }
    hexDetailMount.innerHTML =
      html && String(html).indexOf('mm-radar') !== -1 ? html : fallbackHexHtml();

    var scored =
      typeof window.MuscleMap.collectHexE1rmScores === 'function'
        ? window.MuscleMap.collectHexE1rmScores(lifts, { user: user })
        : { best: {}, values: {} };
    var axes = window.MuscleMap.HEX_AXES || [];
    var targets = window.MuscleMap.HEX_E1RM_TARGETS_LB || {};
    var bits = axes.map(function (axis) {
      var e1 = scored.best[axis.id] || 0;
      var fill = scored.values[axis.id] || 0;
      var pct = Math.round(fill * 100);
      var target = targets[axis.id] || 0;
      var meta = e1
        ? 'Est. 1RM ' + formatLb(e1) + ' · target ' + formatLb(target)
        : lastHexViewingOther
          ? 'No shared lift data'
          : 'No matching lifts logged yet';
      return (
        '<li class="pf-hex-score">' +
        '<span class="pf-hex-score-label">' +
        String(axis.label || axis.id) +
        '</span>' +
        '<span class="pf-hex-score-pct">' +
        pct +
        '%</span>' +
        '<span class="pf-hex-score-meta">' +
        meta +
        '</span></li>'
      );
    });
    hexScoresEl.innerHTML = bits.join('');

    if (hexSubtitleEl) {
      if (lastHexViewingOther) {
        hexSubtitleEl.textContent = 'Visitor view — detailed lift scores stay private';
      } else if (!lifts.length) {
        hexSubtitleEl.textContent = 'Log lifts to fill scores · targets are advanced standards';
      } else {
        hexSubtitleEl.textContent = 'Est. 1RM vs advanced standards';
      }
    }

    hexOverlay.hidden = false;
    var closeBtn = document.getElementById('profile-hex-close');
    if (closeBtn) closeBtn.focus();
  }

  function renderAthleteSnapshot(u, viewingOther) {
    renderSportsChips(u);
    renderMuscleHex(!!viewingOther);
    if (athleteWrap) athleteWrap.hidden = true;
  }

  function showcaseStorageKey(userId) {
    return 'strongman_trophy_showcase_v1_' + String(userId || 'guest');
  }

  function loadShowcaseIds(userId) {
    if (userId == null) return [];
    try {
      var raw = localStorage.getItem(showcaseStorageKey(userId));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(function (id) {
          return String(id || '').trim();
        })
        .filter(Boolean)
        .slice(0, SHOWCASE_SLOTS);
    } catch (e) {
      return [];
    }
  }

  function saveShowcaseIds(userId, ids) {
    if (userId == null) return;
    try {
      localStorage.setItem(
        showcaseStorageKey(userId),
        JSON.stringify((ids || []).slice(0, SHOWCASE_SLOTS))
      );
    } catch (e) {}
  }

  function resolveShowcaseAchievements(unlocked, userId) {
    var list = Array.isArray(unlocked) ? unlocked.slice() : [];
    var byId = {};
    list.forEach(function (ach) {
      if (ach && ach.id != null) byId[String(ach.id)] = ach;
    });
    var picked = [];
    var seen = {};
    loadShowcaseIds(userId).forEach(function (id) {
      if (byId[id] && !seen[id]) {
        picked.push(byId[id]);
        seen[id] = true;
      }
    });
    list.forEach(function (ach) {
      if (picked.length >= SHOWCASE_SLOTS) return;
      var id = ach && ach.id != null ? String(ach.id) : '';
      if (!id || seen[id]) return;
      picked.push(ach);
      seen[id] = true;
    });
    return picked.slice(0, SHOWCASE_SLOTS);
  }

  function paintShowcaseSlots(featured) {
    if (!highlightsList) return;
    highlightsList.innerHTML = '';
    for (var i = 0; i < SHOWCASE_SLOTS; i++) {
      if (featured[i]) {
        highlightsList.appendChild(buildTrophyCard(featured[i]));
      } else {
        highlightsList.appendChild(buildTrophyCard(null, { empty: true }));
      }
    }
  }

  function updateShowcaseCountUi() {
    if (showcaseCountEl) {
      showcaseCountEl.textContent =
        draftShowcaseIds.length + ' / ' + SHOWCASE_SLOTS + ' selected';
    }
    if (showcaseSubtitleEl) {
      showcaseSubtitleEl.textContent =
        draftShowcaseIds.length >= SHOWCASE_SLOTS
          ? 'Card is full — tap a trophy to swap'
          : 'Pick up to ' + SHOWCASE_SLOTS + ' for your card';
    }
  }

  function renderShowcasePicker() {
    if (!showcaseGrid || !currentAchievementState) return;
    var unlocked = currentAchievementState.unlocked || [];
    showcaseGrid.innerHTML = '';
    if (!unlocked.length) {
      var empty = document.createElement('li');
      empty.className = 'pf-showcase-empty';
      empty.textContent = 'Unlock achievements to showcase them here.';
      showcaseGrid.appendChild(empty);
      updateShowcaseCountUi();
      return;
    }
    unlocked.forEach(function (ach) {
      var id = String(ach.id);
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'pf-showcase-pick' +
        (draftShowcaseIds.indexOf(id) !== -1 ? ' pf-showcase-pick--on' : '') +
        ' pf-showcase-pick--tier-' +
        (ach.tier || 'bronze');
      btn.setAttribute('aria-pressed', draftShowcaseIds.indexOf(id) !== -1 ? 'true' : 'false');
      btn.innerHTML =
        '<span class="pf-showcase-pick-icon">' +
        badgeIconMarkup(ach.kind) +
        '</span>' +
        '<span class="pf-showcase-pick-text">' +
        '<span class="pf-showcase-pick-title"></span>' +
        '<span class="pf-showcase-pick-tier"></span>' +
        '</span>' +
        '<span class="pf-showcase-pick-check" aria-hidden="true">✓</span>';
      btn.querySelector('.pf-showcase-pick-title').textContent = ach.title;
      btn.querySelector('.pf-showcase-pick-tier').textContent = tierLabel(ach.tier);
      btn.addEventListener('click', function () {
        var idx = draftShowcaseIds.indexOf(id);
        if (idx !== -1) {
          draftShowcaseIds.splice(idx, 1);
        } else if (draftShowcaseIds.length < SHOWCASE_SLOTS) {
          draftShowcaseIds.push(id);
        } else {
          // Swap oldest selection for the new pick.
          draftShowcaseIds.shift();
          draftShowcaseIds.push(id);
        }
        renderShowcasePicker();
      });
      li.appendChild(btn);
      showcaseGrid.appendChild(li);
    });
    updateShowcaseCountUi();
  }

  function openShowcasePicker() {
    if (!showcaseOverlay || !currentAchievementState) return;
    var ownerId =
      viewingShowcaseOwnerId != null
        ? viewingShowcaseOwnerId
        : displayedProfileUserId;
    draftShowcaseIds = resolveShowcaseAchievements(
      currentAchievementState.unlocked || [],
      ownerId
    ).map(function (ach) {
      return String(ach.id);
    });
    renderShowcasePicker();
    showcaseOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = document.getElementById('profile-showcase-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeShowcasePicker() {
    if (!showcaseOverlay) return;
    showcaseOverlay.hidden = true;
    if (
      !document.getElementById('profile-ach-overlay') ||
      document.getElementById('profile-ach-overlay').hidden
    ) {
      document.body.style.overflow = '';
    }
  }

  function saveShowcasePicker() {
    var ownerId =
      viewingShowcaseOwnerId != null
        ? viewingShowcaseOwnerId
        : displayedProfileUserId;
    saveShowcaseIds(ownerId, draftShowcaseIds.slice());
    var featured = resolveShowcaseAchievements(
      (currentAchievementState && currentAchievementState.unlocked) || [],
      ownerId
    );
    paintShowcaseSlots(featured);
    closeShowcasePicker();
  }

  function renderAchievements(user, viewingOther) {
    if (!highlightsList) return;
    viewingShowcaseOwnerId = user && user.id != null ? Number(user.id) : null;
    if (!user || !user.id) {
      if (highlightsWrap) highlightsWrap.hidden = true;
      currentAchievementState = evaluateAchievements(null);
      if (badgeCountEl) badgeCountEl.textContent = '0';
      return;
    }
    if (highlightsWrap) highlightsWrap.hidden = false;

    function paint() {
      currentAchievementState = evaluateAchievements(user, viewingOther);
      updateAchievementStats(currentAchievementState);
      var unlocked = currentAchievementState.unlocked || [];
      if (highlightsEmpty) {
        highlightsEmpty.hidden = unlocked.length > 0;
      }
      if (unlocked.length > 0) {
        paintShowcaseSlots(resolveShowcaseAchievements(unlocked, user.id));
        highlightsList.hidden = false;
      } else {
        highlightsList.innerHTML = '';
        highlightsList.hidden = true;
      }
      if (highlightsWrap) {
        highlightsWrap.classList.toggle('pf-card-trophies--editable', !viewingOther);
        highlightsWrap.setAttribute(
          'aria-label',
          viewingOther ? 'Trophy case' : 'Trophy case — tap to choose showcase'
        );
      }
      if (
        !viewingOther &&
        window.Achievements &&
        typeof window.Achievements.celebrateNewUnlocks === 'function'
      ) {
        window.Achievements.celebrateNewUnlocks(user);
      }
      renderMuscleHex(!!viewingOther);
    }

    if (viewingOther) {
      paint();
      return;
    }

    syncTrainingDataThen(paint);
  }

  var viewedId = parseViewedUserId();
  var viewer = window.getCurrentUser();
  var viewingOther =
    viewedId != null && (!viewer || Number(viewer.id) !== Number(viewedId));

  syncProfileViewState(!viewingOther && !!viewer);
  configureProfileEditing(!viewingOther && !!viewer, viewer);

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
    syncToolbarVisibility(viewingOther);
    if (viewingOther) {
      competeBtn.addEventListener('click', function () {
        window.location.href = '/leaderboard';
      });
    }
  }

  if (bioInput) {
    bioInput.addEventListener('input', updateBioCharcount);
  }

  if (bioCancelBtn) {
    bioCancelBtn.addEventListener('click', function () {
      setEditMode(false);
      setSaveStatus('');
    });
  }

  if (bioSaveBtn) {
    bioSaveBtn.addEventListener('click', function () {
      if (!canEditProfile || isViewingOtherProfile) return;
      var text = bioInput ? bioInput.value.trim() : '';
      if (text.length > MAX_BIO_LENGTH) {
        setSaveStatus('Bio is too long.', true);
        return;
      }
      if (window.NamePolicy && text) {
        var bioHit = window.NamePolicy.findNamePolicyViolation(text);
        if (bioHit) {
          setSaveStatus('', true);
          if (errorBanner) window.NamePolicy.showPolicyError(errorBanner, bioHit);
          return;
        }
      }
      persistProfilePatch({ bio: text }).then(function (updated) {
        if (!updated) return;
        setEditMode(false);
        renderProfile(updated, { viewingOther: isViewingOtherProfile });
      });
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', function () {
      if (isViewingOtherProfile || !canEditProfile) return;
      var file = avatarInput.files && avatarInput.files[0];
      avatarInput.value = '';
      handleImagePick(file, 'avatarUrl', 512);
    });
  }

  if (highlightsWrap) {
    highlightsWrap.addEventListener('click', function () {
      if (previewAsVisitor) {
        openAchievementModal();
        return;
      }
      if (isViewingOtherProfile || !canEditProfile) {
        openAchievementModal();
        return;
      }
      openShowcasePicker();
    });
    highlightsWrap.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      highlightsWrap.click();
    });
  }

  if (previewBtn) {
    previewBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isViewingOtherProfile) return;
      if (!document.body.classList.contains('profile-is-owner')) return;
      setVisitorPreview(!previewAsVisitor);
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      if (previewAsVisitor) return;
      shareProfileCard();
    });
  }

  var showcaseClose = document.getElementById('profile-showcase-close');
  var showcaseSave = document.getElementById('profile-showcase-save');
  var showcaseViewAll = document.getElementById('profile-showcase-view-all');
  if (showcaseClose) {
    showcaseClose.addEventListener('click', closeShowcasePicker);
  }
  if (showcaseSave) {
    showcaseSave.addEventListener('click', saveShowcasePicker);
  }
  if (showcaseViewAll) {
    showcaseViewAll.addEventListener('click', function () {
      closeShowcasePicker();
      openAchievementModal();
    });
  }
  if (showcaseOverlay) {
    showcaseOverlay.addEventListener('click', function (e) {
      if (e.target === showcaseOverlay) closeShowcasePicker();
    });
  }

  var achOverlay = document.getElementById('profile-ach-overlay');
  var achClose = document.getElementById('profile-ach-close');
  if (achClose) {
    achClose.addEventListener('click', closeAchievementModal);
  }
  if (achOverlay) {
    achOverlay.addEventListener('click', function (e) {
      if (e.target === achOverlay) closeAchievementModal();
    });
  }

  var hexClose = document.getElementById('profile-hex-close');
  if (hexClose) {
    hexClose.addEventListener('click', closeHexDetail);
  }
  if (hexOverlay) {
    hexOverlay.addEventListener('click', function (e) {
      if (e.target === hexOverlay) closeHexDetail();
    });
  }
  if (radarWrap) {
    radarWrap.addEventListener('click', function () {
      openHexDetail();
    });
    radarWrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openHexDetail();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (hexOverlay && !hexOverlay.hidden) {
      closeHexDetail();
      return;
    }
    if (showcaseOverlay && !showcaseOverlay.hidden) {
      closeShowcasePicker();
      return;
    }
    if (achOverlay && !achOverlay.hidden) {
      closeAchievementModal();
    }
  });
  renderAchievementFilters();

  function renderProfile(u, opts) {
    opts = opts || {};
    displayedProfileUserId = u && u.id != null ? Number(u.id) : null;
    var displayName = displayNameFromUser(u);
    if (usernameEl) usernameEl.textContent = displayName;
    document.title = displayName + ' · Profile — Strongman AI';

    if (eyebrowEl) {
      eyebrowEl.textContent = opts.viewingOther ? 'Athlete card' : 'Your card';
    }

    var fc = u && u.followingCount != null ? u.followingCount : null;
    var fwc = u && u.followersCount != null ? u.followersCount : null;
    if (statsRow) {
      var showStats = fc != null || fwc != null;
      statsRow.hidden = !showStats;
      if (followingEl && fc != null) setStatCount(followingEl, fc);
      if (followersEl && fwc != null) setStatCount(followersEl, fwc);
    }

    setBioDisplay(bioFromUser(u));
    var bioWrap = document.getElementById('profile-bio-wrap');
    if (bioWrap) {
      // Calling card: bio is hidden from the face of the card.
      bioWrap.hidden = true;
    }
    renderExperienceTag(u);
    renderAthleteSnapshot(u, !!opts.viewingOther);
    renderProfileXp(u, !!opts.viewingOther);
    var athleteEdit = document.getElementById('profile-athlete-edit');
    if (athleteEdit) athleteEdit.hidden = !!opts.viewingOther;
    if (ownerTools) ownerTools.hidden = !!opts.viewingOther;
    if (userSettingsCta) userSettingsCta.hidden = !!opts.viewingOther || previewAsVisitor;
    if (previewBtn) previewBtn.hidden = !!opts.viewingOther;

    bindAvatar(avatarImg, displayName, u && u.avatarUrl);
    bindBanner();

    if (!opts.skipEditConfigure) {
      configureProfileEditing(!opts.viewingOther && !!window.getCurrentUser(), u);
    }

    renderAchievements(u, !!opts.viewingOther);
  }

  document.addEventListener('strongman:xp-updated', function () {
    if (!isViewingOtherProfile) {
      renderProfileXp(window.getCurrentUser && window.getCurrentUser(), false);
    }
  });

  function bootstrapOwnXp() {
    if (!window.StrongmanXp || typeof window.StrongmanXp.pullFromServer !== 'function') {
      renderProfileXp(window.getCurrentUser && window.getCurrentUser(), false);
      return;
    }
    window.StrongmanXp.pullFromServer().then(function () {
      renderProfileXp(window.getCurrentUser && window.getCurrentUser(), false);
    });
  }

  if (viewedId == null) {
    if (!viewer) {
      syncProfileViewState(false);
      if (eyebrowEl) eyebrowEl.textContent = 'Your profile';
      if (usernameEl) usernameEl.textContent = 'Guest';
      setBioDisplay('');
      renderExperienceTag(null);
      renderAthleteSnapshot(null);
      if (statsRow) statsRow.hidden = true;
      bindAvatar(avatarImg, 'Guest', null);
      bindBanner();
      applyFollowButtonState(null, null, false);
      renderAchievements(null, true);
      document.title = 'Profile — Strongman AI';
      return;
    }

    renderProfile(viewer, { viewingOther: false });
    applyFollowButtonState(viewer.id, viewer, false);
    bootstrapOwnXp();
    loadPublicProfile(viewer.id).then(function (fresh) {
      if (!fresh) return;
      var merged = mergeViewerWithApi(viewer, fresh);
      window.setCurrentUser(merged);
      renderProfile(merged, { viewingOther: false });
    });
    return;
  }

  if (viewer && Number(viewer.id) === Number(viewedId)) {
    renderProfile(viewer, { viewingOther: false });
    applyFollowButtonState(viewedId, viewer, false);
    bootstrapOwnXp();
    loadPublicProfile(viewedId).then(function (fresh) {
      if (!fresh) return;
      var merged = mergeViewerWithApi(viewer, fresh);
      window.setCurrentUser(merged);
      renderProfile(merged, { viewingOther: false });
    });
    return;
  }

  loadPublicProfile(viewedId)
    .then(function (remote) {
      if (!remote) {
        setError('That user could not be found.');
        if (usernameEl) usernameEl.textContent = 'Unknown user';
        setBioDisplay('');
        renderExperienceTag(null);
        renderAthleteSnapshot(null);
        if (statsRow) statsRow.hidden = true;
        bindAvatar(avatarImg, 'Unknown', null);
        bindBanner();
        configureTabs(false);
        applyFollowButtonState(null, viewer, false);
        syncProfileViewState(false);
        document.title = 'Profile — Strongman AI';
        renderAchievements(null, true);
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
      syncProfileViewState(false);
      renderAchievements(null, true);
    });
})();
