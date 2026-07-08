(function () {
  var root = document.getElementById('version-root');
  if (!root || !window.VERSION_CATALOG) return;

  var slug = getSlugFromPath();
  var release = window.VERSION_CATALOG.get(slug);

  if (!release) {
    renderNotFound();
    return;
  }

  document.title = release.title + ' – Strongman AI';
  renderRelease(release);

  function getSlugFromPath() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    if (parts[0] === 'versions' && parts[1]) {
      return decodeURIComponent(parts[1]).toLowerCase();
    }
    return '';
  }

  function renderNotFound() {
    root.innerHTML =
      '<div class="survey-not-found">' +
      '<h1 class="survey-not-found-title">Release not found</h1>' +
      '<p class="survey-not-found-text">This version may have moved or is not listed yet.</p>' +
      '<a href="/versions" class="survey-detail-back">← All versions</a>' +
      '</div>';
  }

  function renderPatchSection(title, items, headingId) {
    if (!items || !items.length) return '';
    var list = items
      .map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      })
      .join('');
    return (
      '<section class="version-patch-section" aria-labelledby="' +
      headingId +
      '">' +
      '<h2 class="version-patch-heading" id="' +
      headingId +
      '">' +
      escapeHtml(title) +
      '</h2>' +
      '<ul class="version-patch-list">' +
      list +
      '</ul>' +
      '</section>'
    );
  }

  function patchItems(data, key) {
    if (Array.isArray(data[key]) && data[key].length) return data[key];
    if (key === 'majorFeatures' && Array.isArray(data.highlights)) return data.highlights;
    return [];
  }

  function renderRelease(data) {
    var slugSafe = String(data.slug || 'release').replace(/[^a-z0-9-]/gi, '');
    var sections =
      renderPatchSection('Major features', patchItems(data, 'majorFeatures'), 'version-major-' + slugSafe) +
      renderPatchSection('Minor fixes', patchItems(data, 'minorFixes'), 'version-fixes-' + slugSafe) +
      renderPatchSection('Minor changes', patchItems(data, 'minorChanges'), 'version-changes-' + slugSafe);

    root.innerHTML =
      '<a href="/versions" class="survey-detail-back">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
      '</svg>All versions</a>' +
      '<article class="survey-detail-card">' +
      '<div class="survey-detail-meta">' +
      '<span class="survey-card-eyebrow">' +
      escapeHtml(data.eyebrow || 'Release') +
      '</span>' +
      '<time class="survey-detail-date" datetime="' +
      escapeHtml(toIsoDate(data.date)) +
      '">' +
      escapeHtml(data.date) +
      '</time>' +
      '</div>' +
      '<h1 class="survey-detail-title">' +
      escapeHtml(data.title) +
      '</h1>' +
      '<p class="survey-detail-summary">' +
      escapeHtml(data.summary) +
      '</p>' +
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
