(function () {
  var SLIDES = ['welcome', 'whats-new', 'setup', 'done'];
  var currentIndex = 0;
  var saving = false;

  var slideshow = document.getElementById('catchup-slideshow');
  var progressFill = document.getElementById('catchup-progress-fill');
  var progressLabel = document.getElementById('catchup-progress-label');
  var featureList = document.getElementById('catchup-feature-list');
  var unitsSelect = document.getElementById('catchup-units');
  var errorEl = document.getElementById('catchup-error');
  var btnStart = document.getElementById('catchup-btn-start');
  var btnFinish = document.getElementById('catchup-btn-finish');

  var currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  if (!currentUser || !currentUser.id) return;

  populateFeatures();
  populateUnits();

  function currentVersion() {
    return (window.VERSION_CATALOG && window.VERSION_CATALOG.current) || 'v1.2';
  }

  function populateFeatures() {
    if (!featureList || !window.VERSION_CATALOG) return;
    var release = window.VERSION_CATALOG.get(currentVersion());
    if (!release) return;
    var items = release.majorFeatures || release.highlights || [];
    featureList.innerHTML = items
      .map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      })
      .join('');
  }

  function populateUnits() {
    if (!unitsSelect) return;
    var units = 'imperial';
    if (currentUser.measurement === 'metric') units = 'metric';
    else if (window.Units && typeof window.Units.getUnits === 'function') {
      units = window.Units.getUnits();
    }
    unitsSelect.value = units === 'metric' ? 'metric' : 'imperial';
  }

  function slideElements() {
    if (!slideshow) return [];
    return SLIDES.map(function (key) {
      return slideshow.querySelector('[data-slide="' + key + '"]');
    }).filter(Boolean);
  }

  function showSlide(index) {
    var slides = slideElements();
    if (!slides.length) return;
    currentIndex = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach(function (el, i) {
      el.classList.toggle('is-active', i === currentIndex);
    });
    var pct = ((currentIndex + 1) / slides.length) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressLabel) {
      progressLabel.textContent = 'Step ' + (currentIndex + 1) + ' of ' + slides.length;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showError(msg) {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  function finishCatchup() {
    if (saving) return;
    saving = true;
    showError('');
    if (btnFinish) btnFinish.disabled = true;

    var payload = {
      lastSeenVersion: currentVersion(),
    };
    if (unitsSelect) {
      payload.measurement = unitsSelect.value === 'metric' ? 'metric' : 'imperial';
    }

    window
      .apiPut('/users/' + currentUser.id, payload)
      .then(function (res) {
        return res.json().then(function (body) {
          saving = false;
          if (btnFinish) btnFinish.disabled = false;
          if (!res.ok) {
            showError((body && body.error) || 'Could not save. Try again.');
            return;
          }
          if (body && typeof window.setCurrentUser === 'function') {
            window.setCurrentUser(body);
          } else if (typeof window.setCurrentUser === 'function') {
            window.setCurrentUser(Object.assign({}, currentUser, payload));
          }
          window.location.href = '/home';
        });
      })
      .catch(function () {
        saving = false;
        if (btnFinish) btnFinish.disabled = false;
        showError('Network error. Check your connection and try again.');
      });
  }

  if (btnStart) {
    btnStart.addEventListener('click', function () {
      showSlide(1);
    });
  }

  document.querySelectorAll('[data-catchup-next]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showSlide(currentIndex + 1);
    });
  });

  document.querySelectorAll('[data-catchup-back]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showSlide(currentIndex - 1);
    });
  });

  if (btnFinish) {
    btnFinish.addEventListener('click', finishCatchup);
  }

  showSlide(0);
})();
