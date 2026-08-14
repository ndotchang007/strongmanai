(function () {
  var POINT_STYLES = {
    action: 1,
    tip: 1,
    warning: 1,
    highlight: 1,
  };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function expandCard(opts) {
    var EC = window.CoachExpandCard;
    if (EC && typeof EC.renderExpandCard === 'function') {
      return EC.renderExpandCard(opts);
    }
    var el = document.createElement('div');
    el.className = 'coach-advice-point coach-advice-point--' + (opts.variant || 'action');
    el.textContent = opts.text || '';
    return el;
  }

  function normalizeAdvice(advice) {
    if (!advice) {
      return {
        title: '',
        summary: '',
        summaryMedicalOverview: '',
        summaryCitation: '',
        points: [],
        closing: '',
      };
    }

    var points = [];
    if (Array.isArray(advice.points)) {
      advice.points.forEach(function (p) {
        if (!p) return;
        if (typeof p === 'string') {
          points.push({
            text: p.trim(),
            style: 'action',
            medicalOverview: '',
            citation: '',
          });
          return;
        }
        var text = typeof p.text === 'string' ? p.text.trim() : '';
        if (!text) return;
        var style = POINT_STYLES[p.style] ? p.style : 'action';
        points.push({
          text: text,
          style: style,
          medicalOverview:
            typeof p.medicalOverview === 'string' ? p.medicalOverview.trim() : '',
          citation: typeof p.citation === 'string' ? p.citation.trim() : '',
        });
      });
    } else if (Array.isArray(advice.bullets)) {
      advice.bullets.forEach(function (b) {
        var text = String(b || '').trim();
        if (text) {
          points.push({
            text: text,
            style: 'action',
            medicalOverview: '',
            citation: '',
          });
        }
      });
    }

    return {
      title: advice.title || 'Coach note',
      summary: advice.summary || '',
      summaryMedicalOverview:
        typeof advice.summaryMedicalOverview === 'string'
          ? advice.summaryMedicalOverview.trim()
          : '',
      summaryCitation:
        typeof advice.summaryCitation === 'string'
          ? advice.summaryCitation.trim()
          : '',
      points: points,
      closing: advice.closing || '',
    };
  }

  function detailOrEmpty(value) {
    var s = typeof value === 'string' ? value.trim() : '';
    return s || '';
  }

  function createWarningEl(point) {
    return expandCard({
      variant: 'warning',
      text: point.text || point,
      medicalOverview: detailOrEmpty(point.medicalOverview),
      citation: detailOrEmpty(point.citation),
      forceExpand: false,
    });
  }

  function createPointEl(point) {
    return expandCard({
      variant: point.style || 'action',
      text: point.text,
      medicalOverview: detailOrEmpty(point.medicalOverview),
      citation: detailOrEmpty(point.citation),
      forceExpand: false,
    });
  }

  function renderAdviceCard(advice) {
    var data = normalizeAdvice(advice);
    var wrap = document.createElement('div');
    wrap.className = 'coach-advice-card';

    if (data.title) {
      var title = document.createElement('h3');
      title.className = 'coach-advice-title';
      title.textContent = data.title;
      wrap.appendChild(title);
    }

    if (data.summary) {
      var summaryDetail = detailOrEmpty(data.summaryMedicalOverview);
      // Don't expand when overview is just a copy of the summary text.
      if (summaryDetail && summaryDetail === String(data.summary).trim()) {
        summaryDetail = '';
      }
      wrap.appendChild(
        expandCard({
          variant: 'summary',
          text: data.summary,
          medicalOverview: summaryDetail,
          citation: detailOrEmpty(data.summaryCitation),
          forceExpand: false,
        })
      );
    }

    var warnings = data.points.filter(function (p) {
      return p.style === 'warning';
    });
    var rest = data.points.filter(function (p) {
      return p.style !== 'warning';
    });

    if (warnings.length) {
      var warnWrap = document.createElement('div');
      warnWrap.className = 'coach-advice-warnings';
      warnings.forEach(function (p) {
        warnWrap.appendChild(createWarningEl(p));
      });
      wrap.appendChild(warnWrap);
    }

    if (rest.length) {
      var grid = document.createElement('div');
      grid.className = 'coach-advice-points';
      rest.forEach(function (p) {
        grid.appendChild(createPointEl(p));
      });
      wrap.appendChild(grid);
    }

    if (data.closing) {
      var closing = document.createElement('p');
      closing.className = 'coach-advice-closing';
      closing.textContent = data.closing;
      wrap.appendChild(closing);
    }

    return wrap;
  }

  function renderPlainMessage(text) {
    var wrap = document.createElement('div');
    wrap.className = 'coach-advice-card coach-advice-card--plain';

    var chunks = String(text || '')
      .split(/\n{2,}/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);

    if (!chunks.length) {
      wrap.textContent = text || '';
      return wrap;
    }

    chunks.forEach(function (chunk, i) {
      var lower = chunk.toLowerCase();
      var isWarning =
        /^(warning|caution|stop|don't|do not|see a doctor|seek medical|if (you|pain|fever))/i.test(
          chunk
        ) ||
        /\b(see a doctor|medical attention|stop training|don't train)\b/i.test(lower);

      if (isWarning) {
        wrap.appendChild(
          expandCard({
            variant: 'warning',
            text: chunk,
            medicalOverview: chunk,
            forceExpand: true,
          })
        );
        return;
      }

      if (i === 0 && chunks.length > 1) {
        wrap.appendChild(
          expandCard({
            variant: 'summary',
            text: chunk,
            medicalOverview: chunk,
            forceExpand: true,
          })
        );
        return;
      }

      wrap.appendChild(
        expandCard({
          variant: i === chunks.length - 1 ? 'highlight' : 'action',
          text: chunk,
          medicalOverview: chunk,
          forceExpand: true,
        })
      );
    });

    return wrap;
  }

  window.CoachAdviceCard = {
    normalizeAdvice: normalizeAdvice,
    renderAdviceCard: renderAdviceCard,
    renderPlainMessage: renderPlainMessage,
  };
})();
