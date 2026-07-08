(function () {
  var gallery = document.getElementById('surveys-gallery');
  if (!gallery || !window.SURVEYS_CATALOG) return;

  var surveys = window.SURVEYS_CATALOG.list();
  surveys.sort(function (a, b) {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  var fragment = document.createDocumentFragment();

  surveys.forEach(function (survey) {
    var link = document.createElement('a');
    link.className = 'survey-card';
    link.href = '/survey/' + encodeURIComponent(survey.slug);
    link.setAttribute('aria-label', 'Open survey: ' + survey.title);

    link.innerHTML =
      '<div class="survey-card-top">' +
      '<span class="survey-card-eyebrow">' +
      escapeHtml(survey.eyebrow || 'Survey') +
      '</span>' +
      '<time class="survey-card-date" datetime="' +
      escapeHtml(toIsoDate(survey.date)) +
      '">' +
      escapeHtml(survey.date) +
      '</time>' +
      '</div>' +
      '<h2 class="survey-card-title">' +
      escapeHtml(survey.title) +
      '</h2>' +
      '<p class="survey-card-summary">' +
      escapeHtml(survey.summary) +
      '</p>' +
      '<span class="survey-card-cta">Take survey' +
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
