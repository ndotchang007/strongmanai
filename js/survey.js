(function () {
  var root = document.getElementById('survey-root');
  if (!root || !window.SURVEYS_CATALOG) return;

  var slug = getSlugFromPath();
  var survey = window.SURVEYS_CATALOG.get(slug);

  if (!survey) {
    renderNotFound();
    return;
  }

  document.title = survey.title + ' – Strongman AI Survey';

  if (hasSubmitted(slug)) {
    renderThanks(false);
    return;
  }

  renderSurvey(survey);

  function getSlugFromPath() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    if (parts[0] === 'survey' && parts[1]) {
      return decodeURIComponent(parts[1]);
    }
    return '';
  }

  function hasSubmitted(surveySlug) {
    try {
      return window.localStorage.getItem('strongman_survey_' + surveySlug) === '1';
    } catch (e) {
      return false;
    }
  }

  function markSubmitted(surveySlug) {
    try {
      window.localStorage.setItem('strongman_survey_' + surveySlug, '1');
    } catch (e) {}
  }

  function renderNotFound() {
    root.innerHTML =
      '<div class="survey-not-found">' +
      '<h1 class="survey-not-found-title">Survey not found</h1>' +
      '<p class="survey-not-found-text">This survey may have moved or is no longer available.</p>' +
      '<a href="/surveys" class="survey-detail-back">← Back to surveys</a>' +
      '</div>';
  }

  function renderThanks(justSubmitted) {
    var message = justSubmitted
      ? 'Your answers were saved on this device. We review every response when planning what to build next.'
      : 'You already completed this survey. Thanks again — your input helps us prioritize the right work.';

    root.innerHTML =
      '<div class="survey-thanks">' +
      '<div class="survey-thanks-icon" aria-hidden="true">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M20 6L9 17l-5-5"/>' +
      '</svg></div>' +
      '<h1 class="survey-thanks-title">Thank you</h1>' +
      '<p class="survey-thanks-text">' +
      escapeHtml(message) +
      '</p>' +
      '<a href="/surveys" class="survey-thanks-link">Browse more surveys</a>' +
      '</div>';
  }

  function renderSurvey(data) {
    var html =
      '<a href="/surveys" class="survey-detail-back">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
      '</svg>All surveys</a>' +
      '<article class="survey-detail-card">' +
      '<div class="survey-detail-meta">' +
      '<span class="survey-card-eyebrow">' +
      escapeHtml(data.eyebrow || 'Survey') +
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
      '<form class="survey-form" id="survey-form" novalidate>';

    data.questions.forEach(function (question) {
      html += renderField(question);
    });

    html +=
      '<p class="survey-error" id="survey-form-error" role="alert" hidden></p>' +
      '<div class="survey-form-actions">' +
      '<button type="submit" class="survey-submit">Submit responses</button>' +
      '<p class="survey-form-note">Responses are stored locally for now and help our team prioritize product decisions.</p>' +
      '</div></form></article>';

    root.innerHTML = html;

    var form = document.getElementById('survey-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!validateForm(form, data)) return;
      markSubmitted(data.slug);
      renderThanks(true);
    });
  }

  function renderField(question) {
    var requiredMark = question.required ? '<span class="survey-required" aria-hidden="true">*</span>' : '';
    var requiredAttr = question.required ? ' required' : '';
    var field =
      '<div class="survey-field">' +
      '<label for="' +
      escapeHtml(question.id) +
      '">' +
      escapeHtml(question.label) +
      requiredMark +
      '</label>';

    if (question.type === 'textarea') {
      field +=
        '<textarea class="survey-textarea" id="' +
        escapeHtml(question.id) +
        '" name="' +
        escapeHtml(question.id) +
        '" rows="4"' +
        (question.placeholder ? ' placeholder="' + escapeHtml(question.placeholder) + '"' : '') +
        requiredAttr +
        '></textarea>';
    } else if (question.type === 'select') {
      field +=
        '<select class="survey-select" id="' +
        escapeHtml(question.id) +
        '" name="' +
        escapeHtml(question.id) +
        '"' +
        requiredAttr +
        '>' +
        '<option value="" disabled selected>Select an option</option>';
      (question.options || []).forEach(function (option) {
        field += '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + '</option>';
      });
      field += '</select>';
    } else {
      field +=
        '<input class="survey-input" type="text" id="' +
        escapeHtml(question.id) +
        '" name="' +
        escapeHtml(question.id) +
        '"' +
        (question.placeholder ? ' placeholder="' + escapeHtml(question.placeholder) + '"' : '') +
        requiredAttr +
        '>';
    }

    field += '</div>';
    return field;
  }

  function validateForm(form, data) {
    var errorEl = document.getElementById('survey-form-error');
    if (!form.checkValidity()) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = 'Please complete all required questions before submitting.';
      }
      form.reportValidity();
      return false;
    }

    if (errorEl) errorEl.hidden = true;
    return true;
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
