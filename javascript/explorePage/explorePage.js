(function () {
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

  /** Blob URLs from VideoArchive; revoked on refresh / unload. */
  var exploreBlobUrls = [];

  function revokeExploreBlobUrls() {
    exploreBlobUrls.forEach(function (u) {
      try {
        URL.revokeObjectURL(u);
      } catch (e) {}
    });
    exploreBlobUrls = [];
  }

  function bindShellMedia(shell, videoEl, url) {
    if (!shell || !videoEl) return;
    shell.classList.remove('is-loaded', 'is-error');
    videoEl.removeAttribute('src');
    if (videoEl.srcObject) {
      try {
        videoEl.srcObject = null;
      } catch (e) {}
    }
    videoEl.load();

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

  var searchForm = document.getElementById('explore-search-form');
  var searchInput = document.getElementById('explore-search-input');
  var searchResultsEl = document.getElementById('explore-search-results');
  var searchStatusEl = document.getElementById('explore-search-status');
  var userListEl = document.getElementById('explore-user-list');
  var usersCache = null;
  var usersLoadPromise = null;
  var searchDebounceTimer = null;

  function displayNameForUser(u) {
    if (!u) return 'Member';
    var full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    if (full) return u.username ? u.username + ' — ' + full : full;
    return u.username || 'Member';
  }

  function matchesUserQuery(u, q) {
    var needle = String(q || '')
      .toLowerCase()
      .trim();
    if (!needle) return false;
    var hay = [
      u.username,
      u.firstName,
      u.lastName,
      [u.firstName, u.lastName].filter(Boolean).join(' ')
    ];
    for (var i = 0; i < hay.length; i++) {
      if (hay[i] && String(hay[i]).toLowerCase().indexOf(needle) >= 0) return true;
    }
    return false;
  }

  function filterUsers(users, q) {
    if (!Array.isArray(users)) return [];
    var out = [];
    for (var i = 0; i < users.length; i++) {
      if (matchesUserQuery(users[i], q)) out.push(users[i]);
    }
    return out.slice(0, 25);
  }

  function loadAllUsers() {
    if (usersCache) return Promise.resolve(usersCache);
    if (usersLoadPromise) return usersLoadPromise;
    if (typeof window.apiGet !== 'function') {
      return Promise.resolve([]);
    }
    usersLoadPromise = window
      .apiGet('/users')
      .then(function (res) {
        if (!res.ok) return [];
        return res.json();
      })
      .then(function (users) {
        usersCache = Array.isArray(users) ? users : [];
        usersLoadPromise = null;
        return usersCache;
      })
      .catch(function () {
        usersLoadPromise = null;
        return [];
      });
    return usersLoadPromise;
  }

  function renderUserSearchResults(q) {
    if (!searchResultsEl || !userListEl) return;
    var query = String(q || '').trim();
    if (!query) {
      searchResultsEl.hidden = true;
      userListEl.innerHTML = '';
      if (searchStatusEl) searchStatusEl.textContent = '';
      return;
    }

    loadAllUsers().then(function (users) {
      if (!searchResultsEl || !userListEl) return;
      var match = filterUsers(users, query);
      userListEl.innerHTML = '';
      if (searchStatusEl) {
        if (!users.length) {
          searchStatusEl.textContent = 'Could not load members. Is the backend running?';
        } else if (!match.length) {
          searchStatusEl.textContent = 'No members match “' + query + '”.';
        } else {
          searchStatusEl.textContent = match.length + ' result' + (match.length === 1 ? '' : 's');
        }
      }
      match.forEach(function (u) {
        if (!u || u.id == null) return;
        var li = document.createElement('li');
        li.className = 'explore-user-hit';
        var a = document.createElement('a');
        a.className = 'explore-user-hit-link';
        a.href = '/profile?id=' + encodeURIComponent(String(u.id));
        a.textContent = displayNameForUser(u);
        li.appendChild(a);
        userListEl.appendChild(li);
      });
      searchResultsEl.hidden = false;
    });
  }

  function scheduleUserSearch() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function () {
      searchDebounceTimer = null;
      var q = searchInput && searchInput.value ? searchInput.value.trim() : '';
      renderUserSearchResults(q);
    }, 220);
  }

  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = searchInput.value ? searchInput.value.trim() : '';
      renderUserSearchResults(q);
    });
    searchInput.addEventListener('input', scheduleUserSearch);
  }

  try {
    var u0 = new URLSearchParams(window.location.search).get('q');
    if (u0 && searchInput) {
      searchInput.value = u0;
      renderUserSearchResults(u0);
    }
  } catch (e) {}

  var trendingSlotArticles = document.querySelectorAll('.explore-trending .explore-video-slot');
  var grid = document.getElementById('explore-thumb-grid');
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

  function attachArchiveViewOnPlay(videoEl, archiveId) {
    if (!videoEl || archiveId == null) return;
    if (!window.VideoArchive || typeof window.VideoArchive.recordPlaybackView !== 'function') return;
    if (videoEl._strongmanExploreViewHandler) {
      videoEl.removeEventListener('play', videoEl._strongmanExploreViewHandler);
      videoEl._strongmanExploreViewHandler = null;
    }
    videoEl._strongmanExploreViewHandler = function () {
      window.VideoArchive.recordPlaybackView(archiveId);
    };
    videoEl.addEventListener('play', videoEl._strongmanExploreViewHandler, { passive: true });
  }

  if (grid) {
    var count = 15;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var cell = document.createElement('div');
      cell.className = 'explore-thumb-cell';
      var inner = document.createElement('div');
      inner.className = 'explore-thumb-inner explore-media-shell';
      var fb = document.createElement('div');
      fb.className = 'explore-media-fallback';
      fb.setAttribute('aria-hidden', 'true');
      var thumb = document.createElement('video');
      thumb.className = 'explore-thumb-el';
      thumb.setAttribute('muted', '');
      thumb.setAttribute('playsinline', '');
      thumb.setAttribute('preload', 'metadata');
      thumb.setAttribute('aria-label', 'Saved clip ' + (i + 1));
      inner.appendChild(fb);
      inner.appendChild(thumb);
      cell.appendChild(inner);
      frag.appendChild(cell);
    }
    grid.appendChild(frag);
  }

  var exploreVideoOverlay = document.getElementById('explore-video-overlay');
  var exploreVideoDialogVideo = document.getElementById('explore-video-dialog-video');
  var exploreVideoDialogTitle = document.getElementById('explore-video-dialog-title');
  var exploreVideoDialogUser = document.getElementById('explore-video-dialog-user');
  var exploreVideoDialogClose = document.getElementById('explore-video-dialog-close');

  function formatUploaderRow(row) {
    if (!row) return '@Member';
    var dn = row.uploaderDisplayName ? String(row.uploaderDisplayName).trim() : '';
    if (dn.charAt(0) === '@') dn = dn.slice(1);
    return dn ? '@' + dn : '@Member';
  }

  function detachExploreArticleClick(article) {
    if (!article) return;
    if (article._exploreSlotClick) {
      article.removeEventListener('click', article._exploreSlotClick);
      article._exploreSlotClick = null;
    }
    article.style.cursor = '';
  }

  function detachExploreInnerClick(inner) {
    if (!inner) return;
    if (inner._exploreSlotClick) {
      inner.removeEventListener('click', inner._exploreSlotClick);
      inner._exploreSlotClick = null;
    }
    inner.style.cursor = '';
  }

  function closeExploreVideoDialog() {
    if (!exploreVideoOverlay) return;
    if (exploreVideoDialogVideo) {
      try {
        exploreVideoDialogVideo.pause();
      } catch (e) {}
      if (exploreVideoDialogVideo._exploreDlgPlay) {
        exploreVideoDialogVideo.removeEventListener('play', exploreVideoDialogVideo._exploreDlgPlay);
        exploreVideoDialogVideo._exploreDlgPlay = null;
      }
      exploreVideoDialogVideo.removeAttribute('src');
    }
    exploreVideoOverlay.hidden = true;
    exploreVideoOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openExploreVideoDialog(opts) {
    if (!exploreVideoOverlay || !exploreVideoDialogVideo) return;
    var src = opts && opts.src ? String(opts.src).trim() : '';
    if (!src) return;
    closeExploreVideoDialog();
    if (exploreVideoDialogTitle) exploreVideoDialogTitle.textContent = (opts && opts.title) || 'Clip';
    if (exploreVideoDialogUser) exploreVideoDialogUser.textContent = (opts && opts.user) || '';
    exploreVideoDialogVideo.src = src;
    if (opts && opts.archiveId != null && window.VideoArchive && typeof window.VideoArchive.recordPlaybackView === 'function') {
      var aid = opts.archiveId;
      exploreVideoDialogVideo._exploreDlgPlay = function () {
        window.VideoArchive.recordPlaybackView(aid);
      };
      exploreVideoDialogVideo.addEventListener('play', exploreVideoDialogVideo._exploreDlgPlay, { passive: true });
    }
    exploreVideoOverlay.hidden = false;
    exploreVideoOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    try {
      exploreVideoDialogVideo.load();
    } catch (e2) {}
    if (exploreVideoDialogClose) exploreVideoDialogClose.focus();
  }

  if (exploreVideoDialogClose) {
    exploreVideoDialogClose.addEventListener('click', function (e) {
      e.preventDefault();
      closeExploreVideoDialog();
    });
  }
  if (exploreVideoOverlay) {
    exploreVideoOverlay.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-explore-video-close') != null) {
        closeExploreVideoDialog();
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && exploreVideoOverlay && !exploreVideoOverlay.hidden) {
      closeExploreVideoDialog();
    }
  });

  function hydrateExploreFromArchive() {
    if (!window.VideoArchive || typeof window.VideoArchive.getAll !== 'function') {
      trendingSlotArticles.forEach(function (article) {
        detachExploreArticleClick(article);
        var shell = article.querySelector('.explore-media-shell');
        var videoEl = shell && shell.querySelector('.explore-video-el');
        if (videoEl && videoEl._strongmanExploreViewHandler) {
          videoEl.removeEventListener('play', videoEl._strongmanExploreViewHandler);
          videoEl._strongmanExploreViewHandler = null;
        }
        if (shell && videoEl) bindShellMedia(shell, videoEl, '');
        var cap = article.querySelector('.explore-trending-caption');
        if (cap) cap.hidden = true;
      });
      if (grid) {
        grid.querySelectorAll('.explore-thumb-inner').forEach(function (inner) {
          detachExploreInnerClick(inner);
          var thumb = inner.querySelector('.explore-thumb-el');
          if (thumb && thumb._strongmanExploreViewHandler) {
            thumb.removeEventListener('play', thumb._strongmanExploreViewHandler);
            thumb._strongmanExploreViewHandler = null;
          }
          bindShellMedia(inner, thumb, '');
        });
      }
      return Promise.resolve();
    }
    return window.VideoArchive.getAll().then(function (rows) {
      revokeExploreBlobUrls();
      var vids = sortArchiveByViewsThenDate(rows);

      var urlByIndex = {};
      function urlForVidIndex(i) {
        if (!vids[i] || !vids[i].videoBlob) return '';
        if (!urlByIndex[i]) {
          urlByIndex[i] = URL.createObjectURL(vids[i].videoBlob);
          exploreBlobUrls.push(urlByIndex[i]);
        }
        return urlByIndex[i];
      }

      var trendingUrls = ['', '', ''];
      for (var ti = 0; ti < 3; ti++) {
        trendingUrls[ti] = urlForVidIndex(ti);
      }

      var gridUrls = [];
      for (var gi = 0; gi < 15; gi++) {
        gridUrls[gi] = urlForVidIndex(gi);
      }

      trendingSlotArticles.forEach(function (article, i) {
        var shell = article.querySelector('.explore-media-shell');
        var videoEl = shell && shell.querySelector('.explore-video-el');
        if (videoEl && videoEl._strongmanExploreViewHandler) {
          videoEl.removeEventListener('play', videoEl._strongmanExploreViewHandler);
          videoEl._strongmanExploreViewHandler = null;
        }
        var cap = article.querySelector('.explore-trending-caption');
        var capUser = cap && cap.querySelector('.explore-trending-caption-user');
        var capTitle = cap && cap.querySelector('.explore-trending-caption-title');
        var row = vids[i];
        detachExploreArticleClick(article);
        if (shell && videoEl) {
          bindShellMedia(shell, videoEl, trendingUrls[i] || '');
          if (row && row.id != null) {
            attachArchiveViewOnPlay(videoEl, row.id);
          }
        }
        if (cap && capUser && capTitle) {
          if (row && row.videoBlob) {
            cap.hidden = false;
            var dn = row.uploaderDisplayName ? String(row.uploaderDisplayName).trim() : '';
            if (dn.charAt(0) === '@') dn = dn.slice(1);
            capUser.textContent = dn ? '@' + dn : '@Member';
            capTitle.textContent = row.title || 'Untitled clip';
          } else {
            cap.hidden = true;
            capUser.textContent = '';
            capTitle.textContent = '';
          }
        }
        var tUrl = trendingUrls[i] || '';
        if (tUrl && row && row.videoBlob) {
          article._exploreSlotClick = function (e) {
            if (e.target.closest && e.target.closest('a')) return;
            openExploreVideoDialog({
              src: tUrl,
              title: row.title || 'Untitled clip',
              user: formatUploaderRow(row),
              archiveId: row.id,
            });
          };
          article.style.cursor = 'pointer';
          article.addEventListener('click', article._exploreSlotClick);
        }
      });

      if (grid) {
        var inners = grid.querySelectorAll('.explore-thumb-inner');
        inners.forEach(function (inner, j) {
          detachExploreInnerClick(inner);
          var thumb = inner.querySelector('.explore-thumb-el');
          if (thumb && thumb._strongmanExploreViewHandler) {
            thumb.removeEventListener('play', thumb._strongmanExploreViewHandler);
            thumb._strongmanExploreViewHandler = null;
          }
          bindShellMedia(inner, thumb, gridUrls[j] || '');
          var gRow = vids[j];
          if (thumb && gRow && gRow.id != null) {
            attachArchiveViewOnPlay(thumb, gRow.id);
          }
          var gUrl = gridUrls[j] || '';
          if (gUrl && gRow && gRow.videoBlob) {
            inner._exploreSlotClick = function (e) {
              if (e.target.closest && e.target.closest('a')) return;
              openExploreVideoDialog({
                src: gUrl,
                title: gRow.title || 'Untitled clip',
                user: formatUploaderRow(gRow),
                archiveId: gRow.id,
              });
            };
            inner.style.cursor = 'pointer';
            inner.addEventListener('click', inner._exploreSlotClick);
          }
        });
      }
    }).catch(function () {
      revokeExploreBlobUrls();
      trendingSlotArticles.forEach(function (article) {
        detachExploreArticleClick(article);
        var shell = article.querySelector('.explore-media-shell');
        var videoEl = shell && shell.querySelector('.explore-video-el');
        if (videoEl && videoEl._strongmanExploreViewHandler) {
          videoEl.removeEventListener('play', videoEl._strongmanExploreViewHandler);
          videoEl._strongmanExploreViewHandler = null;
        }
        if (shell && videoEl) bindShellMedia(shell, videoEl, '');
        var cap = article.querySelector('.explore-trending-caption');
        if (cap) cap.hidden = true;
      });
      if (grid) {
        grid.querySelectorAll('.explore-thumb-inner').forEach(function (inner) {
          detachExploreInnerClick(inner);
          var thumb = inner.querySelector('.explore-thumb-el');
          if (thumb && thumb._strongmanExploreViewHandler) {
            thumb.removeEventListener('play', thumb._strongmanExploreViewHandler);
            thumb._strongmanExploreViewHandler = null;
          }
          bindShellMedia(inner, thumb, '');
        });
      }
    });
  }

  hydrateExploreFromArchive();

  window.addEventListener('strongman-video-archive-changed', function () {
    hydrateExploreFromArchive();
  });

  window.addEventListener('pagehide', revokeExploreBlobUrls);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.body.getAttribute('data-current-page') === 'explore') {
      hydrateExploreFromArchive();
    }
  });
})();
