(function () {
  var DISCLAIMER =
    'Educational info only — not medical advice, diagnosis, or treatment. Talk to a doctor, athletic trainer, or qualified coach for your situation.';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hasExpandDetail(item) {
    if (!item) return false;
    return !!(
      (item.medicalOverview && String(item.medicalOverview).trim()) ||
      (item.citation && String(item.citation).trim()) ||
      (item.detail && String(item.detail).trim())
    );
  }

  function resolveOverview(item, fallbackFields) {
    fallbackFields = fallbackFields || ['medicalOverview', 'detail', 'why', 'text'];
    for (var i = 0; i < fallbackFields.length; i++) {
      var val = item && item[fallbackFields[i]];
      if (val && String(val).trim()) return String(val).trim();
    }
    return '';
  }

  function renderExpandBody(item, opts) {
    opts = opts || {};
    var body = document.createElement('div');
    body.className = 'coach-expand-body';

    if (opts.subtitle) {
      var sub = document.createElement('p');
      sub.className = 'coach-expand-subtitle';
      sub.textContent = opts.subtitle;
      body.appendChild(sub);
    }

    var overview = resolveOverview(item, opts.fallbackFields);
    var overviewWrap = document.createElement('div');
    overviewWrap.className = 'coach-expand-section';
    overviewWrap.innerHTML =
      '<h4 class="coach-expand-section-title">Scientific overview</h4>';
    var overviewP = document.createElement('p');
    overviewP.className = 'coach-expand-overview';
    overviewP.textContent =
      overview ||
      'No extended overview was saved for this note. Ask Rocky a follow-up if you want the full breakdown.';
    overviewWrap.appendChild(overviewP);
    body.appendChild(overviewWrap);

    if (item && item.citation && String(item.citation).trim()) {
      var citeWrap = document.createElement('blockquote');
      citeWrap.className = 'coach-expand-citation';
      citeWrap.innerHTML =
        '<span class="coach-expand-citation-label">Research reference</span>' +
        escapeHtml(String(item.citation).trim());
      body.appendChild(citeWrap);
    }

    var disc = document.createElement('p');
    disc.className = 'coach-expand-disclaimer';
    disc.textContent = DISCLAIMER;
    body.appendChild(disc);

    return body;
  }

  /**
   * @param {object} opts
   * @param {string} opts.variant - action|tip|warning|highlight|exercise|note|fyi|summary
   * @param {string} opts.text - primary label shown in summary
   * @param {string} [opts.meta] - secondary line (e.g. prescription)
   * @param {string} [opts.subtitle] - shown inside expanded panel
   * @param {string} [opts.medicalOverview]
   * @param {string} [opts.citation]
   * @param {string} [opts.why]
   * @param {boolean} [opts.forceExpand] - always use details even without backend detail
   */
  function renderExpandCard(opts) {
    opts = opts || {};
    var item = {
      text: opts.text,
      medicalOverview: opts.medicalOverview,
      citation: opts.citation,
      detail: opts.detail,
      why: opts.why,
    };
    var variant = opts.variant || 'action';
    var force = opts.forceExpand !== false;
    var expandable = force || hasExpandDetail(item);

    if (!expandable) {
      var staticEl = document.createElement('div');
      staticEl.className =
        'coach-advice-point coach-advice-point--' +
        (variant === 'warning' ? 'warning-static' : variant);
      if (variant === 'warning') {
        staticEl.className = 'coach-advice-warning';
        staticEl.innerHTML =
          '<span class="coach-advice-warning-icon" aria-hidden="true">!</span>' +
          '<span class="coach-advice-warning-text">' +
          escapeHtml(opts.text || '') +
          '</span>';
      } else {
        staticEl.textContent = opts.text || '';
      }
      return staticEl;
    }

    var details = document.createElement('details');
    details.className = 'coach-expand-card coach-expand-card--' + variant;

    var summary = document.createElement('summary');
    summary.className = 'coach-expand-summary';

    if (variant === 'warning') {
      summary.innerHTML =
        '<span class="coach-advice-warning-icon" aria-hidden="true">!</span>' +
        '<span class="coach-expand-summary-text">' +
        escapeHtml(opts.text || '') +
        '</span>' +
        '<span class="coach-expand-chevron" aria-hidden="true"></span>';
    } else if (variant === 'exercise') {
      summary.innerHTML =
        '<span class="coach-expand-ex-main">' +
        '<span class="coach-expand-ex-name">' +
        escapeHtml(opts.text || '') +
        '</span>' +
        (opts.meta
          ? '<span class="coach-expand-ex-rx">' + escapeHtml(opts.meta) + '</span>'
          : '') +
        '</span>' +
        '<span class="coach-expand-hint">Tap for overview</span>' +
        '<span class="coach-expand-chevron" aria-hidden="true"></span>';
    } else {
      summary.innerHTML =
        '<span class="coach-expand-summary-text">' +
        escapeHtml(opts.text || '') +
        '</span>' +
        '<span class="coach-expand-hint">Tap for overview</span>' +
        '<span class="coach-expand-chevron" aria-hidden="true"></span>';
    }

    details.appendChild(summary);
    details.appendChild(
      renderExpandBody(item, {
        subtitle: opts.subtitle || opts.why || '',
        fallbackFields: opts.fallbackFields || ['medicalOverview', 'detail', 'why', 'text'],
      })
    );

    return details;
  }

  window.CoachExpandCard = {
    hasExpandDetail: hasExpandDetail,
    renderExpandCard: renderExpandCard,
    DISCLAIMER: DISCLAIMER,
  };
})();
