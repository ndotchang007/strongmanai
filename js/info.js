(function () {
  var SEEN_KEY = 'strongman-info-seen';

  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch (e) {}

  window.strongmanInfo = {
    hasSeen: function () {
      try {
        return localStorage.getItem(SEEN_KEY) === '1';
      } catch (e2) {
        return false;
      }
    },
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderFeaturedVersion() {
    var mount = document.getElementById('info-versions-mount');
    if (!mount || !window.VERSION_CATALOG) return;

    var currentSlug = window.VERSION_CATALOG.current || 'v1.3';
    var release = window.VERSION_CATALOG.get(currentSlug);
    if (!release) return;

    var link = document.createElement('a');
    link.className = 'survey-card survey-card--current';
    link.href = '/versions/' + encodeURIComponent(currentSlug);
    link.setAttribute('aria-label', 'Read patch notes for ' + (release.title || currentSlug));

    link.innerHTML =
      '<div class="survey-card-top">' +
      '<span class="survey-card-eyebrow">' +
      escapeHtml(release.eyebrow || 'Release') +
      '</span>' +
      '<time class="survey-card-date">' +
      escapeHtml(release.date) +
      '</time>' +
      '</div>' +
      '<h2 class="survey-card-title">' +
      escapeHtml(release.title) +
      '</h2>' +
      '<p class="survey-card-summary">' +
      escapeHtml(release.summary) +
      '</p>' +
      '<span class="survey-card-cta">Read patch notes' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M5 12h14M13 6l6 6-6 6"/>' +
      '</svg></span>';

    mount.appendChild(link);

    var allLink = document.getElementById('info-versions-all');
    if (allLink) allLink.href = '/versions';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFeaturedVersion);
  } else {
    renderFeaturedVersion();
  }
})();
