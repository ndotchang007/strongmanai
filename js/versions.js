(function () {
  var gallery = document.getElementById('versions-gallery');
  if (!gallery || !window.VERSION_CATALOG) return;

  var versions = window.VERSION_CATALOG.list();
  var current = window.VERSION_CATALOG.current || 'v1.2';
  var fragment = document.createDocumentFragment();

  versions.forEach(function (release) {
    var link = document.createElement('a');
    link.className = 'survey-card';
    if (release.slug === current) link.classList.add('survey-card--current');
    link.href = '/versions/' + encodeURIComponent(release.slug);
    link.setAttribute('aria-label', 'View patch notes for ' + release.title);

    link.innerHTML =
      '<div class="survey-card-top">' +
      '<span class="survey-card-eyebrow">' +
      escapeHtml(release.eyebrow || 'Release') +
      '</span>' +
      '<time class="survey-card-date" datetime="' +
      escapeHtml(toIsoDate(release.date)) +
      '">' +
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

    fragment.appendChild(link);
  });

  gallery.appendChild(fragment);

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
