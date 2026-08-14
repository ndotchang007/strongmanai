(function () {
  var root = document.getElementById('post-root');
  if (!root || !window.BLOG_CATALOG) return;

  var slug = getSlugFromPath();
  var post = window.BLOG_CATALOG.get(slug);

  if (!post) {
    renderNotFound();
    return;
  }

  document.title = post.title + ' – Strongman AI';
  renderPost(post);

  function getSlugFromPath() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    if (parts[0] === 'blog' && parts[1]) {
      return decodeURIComponent(parts[1]).toLowerCase();
    }
    return '';
  }

  function renderNotFound() {
    root.innerHTML =
      '<div class="blog-not-found">' +
      '<h1 class="blog-not-found-title">Post not found</h1>' +
      '<p class="blog-not-found-text">This article may have moved or is not published yet.</p>' +
      '<a href="/blog" class="blog-article-back">← All writing</a>' +
      '</div>';
  }

  function renderSection(section, index, slugSafe) {
    if (!section) return '';
    var headingId = 'blog-section-' + slugSafe + '-' + index;
    var body = '';

    if (section.diagram) {
      body +=
        '<figure class="blog-diagram" role="img" aria-label="' +
        escapeHtml(section.diagramLabel || section.heading || 'Diagram') +
        '">' +
        section.diagram +
        (section.diagramCaption
          ? '<figcaption class="blog-diagram-caption">' +
            escapeHtml(section.diagramCaption) +
            '</figcaption>'
          : '') +
        '</figure>';
    }

    if (section.formula) {
      body +=
        '<pre class="blog-formula"><code>' +
        escapeHtml(section.formula) +
        '</code></pre>';
    }

    if (section.tree) {
      body += '<div class="blog-tree">' + section.tree + '</div>';
    }

    var paragraphs = (section.paragraphs || [])
      .map(function (p) {
        return '<p class="blog-post-paragraph">' + escapeHtml(p) + '</p>';
      })
      .join('');
    var bullets = '';
    if (section.bullets && section.bullets.length) {
      bullets =
        '<ul class="blog-article-list">' +
        section.bullets
          .map(function (item) {
            return '<li>' + escapeHtml(item) + '</li>';
          })
          .join('') +
        '</ul>';
    }
    body += paragraphs + bullets;
    if (!body) return '';
    return (
      '<section class="blog-article-section" aria-labelledby="' +
      headingId +
      '">' +
      '<h2 class="blog-article-heading" id="' +
      headingId +
      '">' +
      escapeHtml(section.heading || 'Update') +
      '</h2>' +
      body +
      '</section>'
    );
  }

  function renderPost(data) {
    var slugSafe = String(data.slug || 'post').replace(/[^a-z0-9-]/gi, '');
    var sections = (data.sections || [])
      .map(function (section, index) {
        return renderSection(section, index, slugSafe);
      })
      .join('');

    root.innerHTML =
      '<a href="/blog" class="blog-article-back">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
      '</svg>All writing</a>' +
      '<article class="blog-article">' +
      '<div class="blog-feature-meta">' +
      '<span class="blog-kicker">' +
      escapeHtml(data.category || data.eyebrow || 'Feature') +
      '</span>' +
      '<span class="blog-meta-sep" aria-hidden="true"></span>' +
      '<time class="blog-meta-text" datetime="' +
      escapeHtml(toIsoDate(data.date)) +
      '">' +
      escapeHtml(data.date) +
      '</time>' +
      '<span class="blog-meta-sep" aria-hidden="true"></span>' +
      '<span class="blog-meta-text">' +
      escapeHtml(String(data.readMinutes || 5)) +
      ' min read</span>' +
      '</div>' +
      '<h1 class="blog-article-title">' +
      escapeHtml(data.title) +
      '</h1>' +
      '<p class="blog-article-summary">' +
      escapeHtml(data.summary) +
      '</p>' +
      '<hr class="blog-article-divider" />' +
      sections +
      '</article>';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toIsoDate(displayDate) {
    var parsed = Date.parse(displayDate);
    if (Number.isNaN(parsed)) return '';
    return new Date(parsed).toISOString().slice(0, 10);
  }
})();
