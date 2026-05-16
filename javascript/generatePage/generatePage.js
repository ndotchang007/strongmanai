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

  var form = document.getElementById('generate-form');
  var promptInput = document.getElementById('generate-prompt');
  var resultEl = document.getElementById('generate-result');
  var errorEl = document.getElementById('generate-error');
  var quotaEl = document.getElementById('generate-quota');
  var submitBtn = form ? form.querySelector('.generate-submit') : null;

  function resolveAiLogoUrl() {
    try {
      return new URL('../../assets/logo.png', window.location.href).href;
    } catch (e) {
      return '../../assets/logo.png';
    }
  }

  function aiGeneratingMarkup() {
    var src = resolveAiLogoUrl();
    return (
      '<div class="ai-generating" role="status" aria-live="polite" aria-busy="true">' +
      '<div class="ai-generating-inner">' +
      '<div class="ai-generating-arm">' +
      '<img src="' +
      src +
      '" alt="" class="ai-generating-logo" width="88" height="88">' +
      '</div>' +
      '<p class="ai-generating-caption">Generating your workout</p>' +
      '<p class="ai-generating-sub">Hang tight — programming your session…</p>' +
      '</div></div>'
    );
  }

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
  }

  function hideError() {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  function setQuotaText(q) {
    if (!quotaEl) return;
    if (!q || typeof q.used !== 'number') {
      quotaEl.textContent = '';
      return;
    }
    quotaEl.textContent =
      'AI uses today: ' + q.used + ' / ' + q.limit + ' · ' + q.remaining + ' left';
  }

  function fetchQuota() {
    if (typeof apiGet !== 'function') return;
    apiGet('/generate/quota')
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error('x');
          return body;
        });
      })
      .then(function (body) {
        if (body && body.quota) setQuotaText(body.quota);
      })
      .catch(function () {
        setQuotaText(null);
      });
  }
  fetchQuota();

  function formatArchiveDateLabel() {
    var d = new Date();
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideError();
      var prompt = promptInput && promptInput.value ? promptInput.value.trim() : '';
      if (!prompt) {
        showError('Enter a description for your workout.');
        return;
      }
      if (typeof apiPost !== 'function') {
        showError('Could not reach the API. Reload the page and try again.');
        return;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      if (resultEl) {
        resultEl.innerHTML = aiGeneratingMarkup();
      }
      apiPost('/generate', { prompt: prompt })
        .then(function (res) {
          return res.json().then(function (body) {
            if (res.status === 429) {
              setQuotaText(body && body.quota ? body.quota : null);
              throw new Error(
                (body && body.error) ||
                  'Daily AI limit reached (3 per day). Try again tomorrow.'
              );
            }
            if (!res.ok) {
              var fallback =
                res.status === 503
                  ? 'Workout generation is not set up on the server yet.'
                  : res.status === 404
                    ? 'Generate API not found. Check that the backend is running and deployed.'
                    : res.status === 502
                      ? 'The AI service is temporarily unavailable. Try again in a moment.'
                      : res.status === 500
                        ? 'Server error. Try again shortly.'
                        : 'Something went wrong. Try again.';
              throw new Error((body && body.error) || fallback);
            }
            return body;
          });
        })
        .then(function (data) {
          if (!resultEl) return;
          resultEl.innerHTML = '';
          if (data && typeof data.text === 'string' && data.text.length) {
            var pre = document.createElement('pre');
            pre.className = 'generate-result-text';
            pre.textContent = data.text;
            resultEl.appendChild(pre);
            if (data.quota) setQuotaText(data.quota);
            var WA = window.WorkoutArchive;
            if (WA && typeof WA.add === 'function') {
              WA.add({
                name: 'AI workout · ' + formatArchiveDateLabel(),
                bodyText: data.text,
                source: 'ai'
              });
            }
            if (typeof apiPost === 'function') {
              apiPost('/stats/workouts-made', {}).catch(function () {});
            }
          } else {
            resultEl.innerHTML =
              '<p class="generate-result-placeholder">No text was returned. Try a different prompt.</p>';
          }
        })
        .catch(function (err) {
          showError(err && err.message ? err.message : 'Request failed.');
          if (resultEl) {
            resultEl.innerHTML =
              '<p class="generate-result-placeholder">Your generated workout will appear here.</p>';
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
})();
