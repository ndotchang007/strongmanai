(function () {
  if (!window.BLOG_CATALOG) return;

  var updatesRoot = document.getElementById('blog-updates');
  var gallery = document.getElementById('blog-gallery');
  var countEl = document.getElementById('blog-count');
  var posts = window.BLOG_CATALOG.list();
  var updates = typeof window.BLOG_CATALOG.updates === 'function'
    ? window.BLOG_CATALOG.updates()
    : posts.filter(isUpdate);

  if (updatesRoot) {
    if (!updates.length) {
      updatesRoot.closest('.blog-updates').hidden = true;
    } else {
      var uFrag = document.createDocumentFragment();
      updates.forEach(function (post) {
        uFrag.appendChild(renderUpdate(post));
      });
      updatesRoot.appendChild(uFrag);
    }
  }

  if (countEl) {
    countEl.textContent = posts.length + ' pieces';
  }

  if (gallery) {
    var fragment = document.createDocumentFragment();
    var index = 0;
    posts.forEach(function (post) {
      index += 1;
      fragment.appendChild(renderStory(post, index));
    });
    gallery.appendChild(fragment);
    observeStories(gallery);
  }

  function isUpdate(post) {
    var cat = String(post.category || post.eyebrow || '').toLowerCase();
    return cat === 'release' || cat === 'update' || cat === 'journal';
  }

  function renderUpdate(post) {
    var a = document.createElement('a');
    a.className = 'blog-update-card';
    a.href = '/blog/' + encodeURIComponent(post.slug);
    a.setAttribute('aria-label', 'Read update: ' + post.title);
    a.innerHTML =
      '<span class="blog-update-badge">' +
      escapeHtml(post.category || post.eyebrow || 'Update') +
      '</span>' +
      '<h3 class="blog-update-title">' +
      escapeHtml(post.title) +
      '</h3>' +
      '<p class="blog-update-summary">' +
      escapeHtml(post.summary) +
      '</p>' +
      '<p class="blog-update-meta">' +
      escapeHtml(post.date) +
      ' · ' +
      escapeHtml(String(post.readMinutes || 5)) +
      ' min</p>';
    return a;
  }

  function renderStory(post, index) {
    var link = document.createElement('a');
    link.className = 'blog-story';
    link.href = '/blog/' + encodeURIComponent(post.slug);
    link.setAttribute('aria-label', 'Read: ' + post.title);
    link.innerHTML =
      '<span class="blog-story-index">' +
      padIndex(index) +
      '</span>' +
      '<div class="blog-story-body">' +
      '<div class="blog-story-kicker">' +
      '<span class="blog-story-cat">' +
      escapeHtml(post.category || post.eyebrow || 'Feature') +
      '</span>' +
      '<span class="blog-story-meta">' +
      escapeHtml(post.date) +
      ' · ' +
      escapeHtml(String(post.readMinutes || 5)) +
      ' min</span>' +
      '</div>' +
      '<h2 class="blog-story-title">' +
      escapeHtml(post.title) +
      '</h2>' +
      '<p class="blog-story-summary">' +
      escapeHtml(post.summary) +
      '</p>' +
      '</div>' +
      '<span class="blog-story-go" aria-hidden="true">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
    return link;
  }

  function observeStories(root) {
    var items = root.querySelectorAll('.blog-story');
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  function padIndex(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
