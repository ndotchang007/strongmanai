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
  var AVATAR_FALLBACK_SVG =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
        '<rect fill="#ff8c00" width="256" height="256" rx="44"/>' +
        '<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#141414" font-family="DM Sans,sans-serif" font-size="88" font-weight="700">?</text>' +
        '</svg>'
    );

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

  function buildTrophyCard(ach) {
    var li = document.createElement('li');
    li.className = 'profile-chip-item';
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

  function updateAchievementStats(state) {
    if (!state) return;
    if (badgeCountEl) {
      badgeCountEl.textContent = state.unlockedCount + ' / ' + state.totalCount;
    }
    var sub = document.getElementById('profile-badges-subtitle');
    if (sub) {
      sub.textContent =
        state.unlockedCount +
        ' of ' +
        state.totalCount +
        ' achievements unlocked';
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
        img.src = AVATAR_FALLBACK_SVG;
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
    img.src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="#ff8c00" width="128" height="128" rx="22"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#141414" font-family="DM Sans,sans-serif" font-size="44" font-weight="700">' +
          initials +
          '</text></svg>'
      );
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
    var parts = [];
    if (u.experience) parts.push(String(u.experience));
    if (u.reason) parts.push(String(u.reason));
    return parts.join(' · ');
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
  var logoutWrap = document.getElementById('profile-logout-wrap');
  var logoutLink = document.getElementById('profile-logout');
  var editToggle = document.getElementById('profile-edit-toggle');
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
  var displayedProfileUserId = null;
  var highlightsList = document.getElementById('profile-highlights-list');
  var highlightsEmpty = document.getElementById('profile-highlights-empty');
  var highlightsWrap = document.getElementById('profile-highlights-wrap');
  var viewBadgesBtn = document.getElementById('profile-view-badges-btn');
  var experienceTagEl = document.getElementById('profile-experience-tag');
  var experienceTextEl = document.getElementById('profile-experience-text');
  var badgeCountEl = document.getElementById('profile-badge-count');
  var athleteWrap = document.getElementById('profile-athlete-wrap');
  var athleteGrid = document.getElementById('profile-athlete-grid');

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
    if (isViewingOtherProfile || !canEditProfile) {
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
    if (avatarChangeLabel) avatarChangeLabel.hidden = !editModeOpen || !canEditProfile;
    if (editToggle) editToggle.textContent = editModeOpen ? 'Done editing' : 'Edit profile';
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
    canEditProfile = !!ownProfile;
    document.body.classList.toggle('profile-is-owner', !!ownProfile);
    document.body.classList.toggle('profile-is-visitor', !ownProfile);
    if (avatarInput) avatarInput.disabled = !ownProfile;
    if (!ownProfile) {
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

  function configureProfileEditing(enabled, user) {
    var viewerUser = window.getCurrentUser();
    var targetId =
      displayedProfileUserId != null ? displayedProfileUserId : resolveViewedUserId();
    var isOwn = !!enabled && isOwnProfileView(viewerUser, targetId);
    syncProfileViewState(isOwn);
    if (!isOwn) setEditMode(false);
    if (avatarChangeLabel) avatarChangeLabel.hidden = !editModeOpen || !canEditProfile;
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

  function renderExperienceTag(u) {
    if (!experienceTagEl || !experienceTextEl) return;
    var exp = u && u.experience != null ? String(u.experience).trim() : '';
    if (!exp) {
      experienceTagEl.hidden = true;
      return;
    }
    experienceTagEl.hidden = false;
    experienceTextEl.textContent = exp;
  }

  function renderAthleteSnapshot(u) {
    if (!athleteWrap || !athleteGrid) return;
    var items = [];
    var AC = window.AthleteContext;
    var ctx = AC && u ? AC.loadAthleteContext(u) : null;

    if (ctx) {
      var sports = AC.getSports ? AC.getSports(ctx) : [];
      if (sports.length) {
        var sportsHtml = sports
          .map(function (entry) {
            var sp = AC.getSportRecordForEntry ? AC.getSportRecordForEntry(entry) : null;
            var line = entry.sport;
            if (entry.programType && AC.PROGRAM_LABELS && AC.PROGRAM_LABELS[entry.programType]) {
              line += ' · ' + AC.PROGRAM_LABELS[entry.programType];
            }
            if (entry.position) line += ' · ' + entry.position;
            var meta = [];
            var phase =
              AC.resolveSeasonPhase && entry
                ? AC.resolveSeasonPhase(entry)
                : entry.seasonPhase;
            if (phase && AC.SEASON_LABELS[phase]) {
              meta.push(AC.SEASON_LABELS[phase]);
            }
            var practice = AC.formatWeekdays ? AC.formatWeekdays(entry.practiceDays) : '';
            if (practice) meta.push('Practice ' + practice);
            var comp = AC.competitionLabelForEntry
              ? AC.competitionLabelForEntry(entry)
              : 'Game';
            var games = AC.formatWeekdays ? AC.formatWeekdays(entry.gameDays) : '';
            if (games) meta.push(comp + ' ' + games);
            if (entry.seasonStartDate) meta.push('Starts ' + entry.seasonStartDate);
            if (entry.nextEventDate) {
              meta.push(
                (entry.nextEventLabel || comp) + ' ' + entry.nextEventDate
              );
            }
            return (
              '<div class="profile-sport-row">' +
              '<div class="profile-sport-row-name">' +
              line +
              '</div>' +
              (meta.length
                ? '<div class="profile-sport-row-meta">' + meta.join(' · ') + '</div>'
                : '') +
              '</div>'
            );
          })
          .join('');
        items.push({
          label: sports.length > 1 ? 'Sports' : 'Sport',
          value: '<div class="profile-sports-list">' + sportsHtml + '</div>',
          html: true,
        });
      }
      var primary = AC.getPrimarySport ? AC.getPrimarySport(ctx) : null;
      var sp = primary && AC.getSportRecordForEntry
        ? AC.getSportRecordForEntry(primary)
        : AC.getSportRecord ? AC.getSportRecord(ctx) : null;
      if (sp && sp.liftingFocus) {
        items.push({ label: 'Lifting focus', labelTip: 'lifting_focus', value: sp.liftingFocus });
      }
      if (ctx.primaryGoal && AC.GOAL_LABELS[ctx.primaryGoal]) {
        items.push({ label: 'Goal', labelTip: 'main_goal', value: AC.GOAL_LABELS[ctx.primaryGoal] });
      }
      if (ctx.schoolNightMaxMinutes) {
        items.push({
          label: 'Weeknight cap',
          labelTip: 'weeknight_cap',
          value: ctx.schoolNightMaxMinutes + ' min',
        });
      }
    }

    if (u && u.equipment) items.push({ label: 'Equipment', value: String(u.equipment) });
    if (u && u.weight != null && String(u.weight).trim()) {
      var w = String(u.weight).trim();
      var unit = u.measurement === 'metric' ? ' kg' : ' lb';
      items.push({ label: 'Weight', value: w + (/\d/.test(w) && !/lb|kg/i.test(w) ? unit : '') });
    }
    if (u && u.height != null && String(u.height).trim()) {
      items.push({ label: 'Height', value: String(u.height).trim() });
    }
    if (u && u.timeAvailable && !ctx) items.push({ label: 'Training time', value: String(u.timeAvailable) });
    if (u && u.reason && !ctx) items.push({ label: 'Goal', value: String(u.reason) });
    if (!items.length) {
      athleteWrap.hidden = true;
      athleteGrid.innerHTML = '';
      return;
    }
    athleteWrap.hidden = false;
    athleteGrid.innerHTML = '';
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'pf-snap-item';
      var lbl = document.createElement('span');
      lbl.className = 'pf-snap-label';
      if (item.labelTip && window.InfoTip) {
        lbl.innerHTML = window.InfoTip.label(item.label, item.labelTip);
      } else {
        lbl.textContent = item.label;
      }
      var val = document.createElement('span');
      val.className = 'pf-snap-value';
      if (item.html) {
        val.innerHTML = item.value;
        div.classList.add('pf-snap-item--wide');
      } else {
        val.textContent = item.value;
      }
      div.appendChild(lbl);
      div.appendChild(val);
      athleteGrid.appendChild(div);
    });
  }

  function renderAchievements(user, viewingOther) {
    if (!highlightsList) return;
    if (!user || !user.id) {
      if (highlightsWrap) highlightsWrap.hidden = true;
      if (viewBadgesBtn) viewBadgesBtn.hidden = true;
      currentAchievementState = evaluateAchievements(null);
      if (badgeCountEl) badgeCountEl.textContent = '0';
      return;
    }
    if (highlightsWrap) highlightsWrap.hidden = false;

    function paint() {
      currentAchievementState = evaluateAchievements(user, viewingOther);
      updateAchievementStats(currentAchievementState);
      if (highlightsEmpty) {
        highlightsEmpty.hidden = currentAchievementState.unlockedCount > 0;
      }
      highlightsList.innerHTML = '';
      var featured = currentAchievementState.unlocked.slice(0, 8);
      featured.forEach(function (ach) {
        highlightsList.appendChild(buildTrophyCard(ach));
      });
      if (viewBadgesBtn) {
        viewBadgesBtn.hidden = false;
        viewBadgesBtn.textContent = viewingOther ? 'View badges' : 'View all badges';
      }
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

  if (logoutWrap) logoutWrap.hidden = !viewer;

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

  if (logoutLink && viewer) {
    logoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.setCurrentUser(null);
      window.location.href = '/';
    });
  }

  if (editToggle) {
    editToggle.addEventListener('click', function () {
      if (!canEditProfile || isViewingOtherProfile) return;
      setEditMode(!editModeOpen);
    });
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

  if (viewBadgesBtn) {
    viewBadgesBtn.addEventListener('click', function () {
      openAchievementModal();
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
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && achOverlay && !achOverlay.hidden) {
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
      eyebrowEl.textContent = opts.viewingOther ? 'Member profile' : 'Your profile';
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
      var bioRaw = bioFromUser(u);
      bioWrap.hidden = !!opts.viewingOther && (!bioRaw || !String(bioRaw).trim());
    }
    renderExperienceTag(u);
    renderAthleteSnapshot(u);
    var athleteEdit = document.getElementById('profile-athlete-edit');
    if (athleteEdit) athleteEdit.hidden = !!opts.viewingOther;

    bindAvatar(avatarImg, displayName, u && u.avatarUrl);
    bindBanner();

    if (!opts.skipEditConfigure) {
      configureProfileEditing(!opts.viewingOther && !!window.getCurrentUser(), u);
    }

    renderAchievements(u, !!opts.viewingOther);
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
