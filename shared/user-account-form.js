(function () {
  var UNITS_KEY = 'strongman-home-units';
  var USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

  var FORM_HTML =
    '<section class="user-account-section buddy-block" aria-labelledby="user-account-heading">' +
    '<p class="buddy-prompt" id="user-account-heading">Your account</p>' +
    '<p class="buddy-notes-hint">Username, name, and body metrics — used across the app and for coaching context.</p>' +
    '<div class="user-account-fields">' +
    '<label class="home-settings-field-label" for="user-account-username">Username</label>' +
    '<input type="text" id="user-account-username" class="home-settings-input buddy-input" maxlength="30" autocomplete="username" pattern="[A-Za-z0-9_]+">' +
    '<div class="settings-account-row">' +
    '<div class="settings-account-col">' +
    '<label class="home-settings-field-label" for="user-account-first">First name</label>' +
    '<input type="text" id="user-account-first" class="home-settings-input buddy-input" maxlength="64" autocomplete="given-name">' +
    '</div>' +
    '<div class="settings-account-col">' +
    '<label class="home-settings-field-label" for="user-account-last">Last name</label>' +
    '<input type="text" id="user-account-last" class="home-settings-input buddy-input" maxlength="64" autocomplete="family-name">' +
    '</div>' +
    '</div>' +
    '<label class="home-settings-field-label" for="user-account-dob">Date of birth</label>' +
    '<input type="date" id="user-account-dob" class="home-settings-input home-settings-input--date buddy-input">' +
    '<div class="settings-account-row settings-account-row--metrics">' +
    '<div class="settings-account-col">' +
    '<label class="home-settings-field-label" for="user-account-weight">Weight</label>' +
    '<div class="settings-account-metric">' +
    '<input type="number" id="user-account-weight" class="home-settings-input buddy-input" min="1" max="999" inputmode="decimal">' +
    '<span class="settings-account-unit" id="user-account-weight-unit">lb</span>' +
    '</div>' +
    '</div>' +
    '<div class="settings-account-col">' +
    '<label class="home-settings-field-label" for="user-account-height">Height</label>' +
    '<div class="settings-account-metric">' +
    '<input type="number" id="user-account-height" class="home-settings-input buddy-input" min="1" max="999" inputmode="decimal">' +
    '<span class="settings-account-unit" id="user-account-height-unit">in</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<p class="settings-account-status" id="user-account-status" role="status" aria-live="polite"></p>' +
    '</div>' +
    '</section>';

  var accountDirty = false;

  function el(id) {
    return document.getElementById(id);
  }

  function getUnits() {
    if (window.Units && typeof window.Units.getUnits === 'function') {
      return window.Units.getUnits();
    }
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (u && u.measurement) return u.measurement === 'metric' ? 'metric' : 'imperial';
    try {
      var stored = localStorage.getItem(UNITS_KEY);
      return stored === 'metric' ? 'metric' : 'imperial';
    } catch (e) {
      return 'imperial';
    }
  }

  function convertFormMetrics(fromUnits, toUnits) {
    if (!fromUnits || !toUnits || fromUnits === toUnits) return;
    if (!window.Units) return;
    var wEl = el('user-account-weight');
    var hEl = el('user-account-height');
    if (wEl && wEl.value) {
      var w = window.Units.convertWeight(wEl.value, fromUnits, toUnits);
      if (w != null) wEl.value = String(toUnits === 'metric' ? w : Math.round(w));
    }
    if (hEl && hEl.value) {
      var h = window.Units.convertHeight(hEl.value, fromUnits, toUnits);
      if (h != null) hEl.value = String(Math.round(h));
    }
    accountDirty = true;
  }

  function setStatus(msg, isError) {
    var statusEl = el('user-account-status');
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('settings-account-status--error', !!isError);
  }

  function updateUnitLabels() {
    var metric = getUnits() === 'metric';
    var wu = el('user-account-weight-unit');
    var hu = el('user-account-height-unit');
    if (wu) wu.textContent = metric ? 'kg' : 'lb';
    if (hu) hu.textContent = metric ? 'cm' : 'in';
  }

  function markDirty() {
    accountDirty = true;
    setStatus('');
  }

  function bindEvents(root) {
    [
      'user-account-username',
      'user-account-first',
      'user-account-last',
      'user-account-dob',
      'user-account-weight',
      'user-account-height',
    ].forEach(function (id) {
      var node = root.querySelector('#' + id);
      if (!node) return;
      node.addEventListener('input', markDirty);
      node.addEventListener('change', markDirty);
    });
  }

  function validatePayload(payload) {
    if (payload.username && !USERNAME_RE.test(payload.username)) {
      return 'Username: 3–30 characters, letters, numbers, and underscores only.';
    }
    if (window.NamePolicy) {
      return window.NamePolicy.checkAccountNameFields({
        username: payload.username,
        firstName: payload.firstName,
        lastName: payload.lastName,
      });
    }
    return null;
  }

  function loadFromUser() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u) return;
    if (el('user-account-username')) el('user-account-username').value = u.username || '';
    if (el('user-account-first')) el('user-account-first').value = u.firstName || '';
    if (el('user-account-last')) el('user-account-last').value = u.lastName || '';
    if (el('user-account-dob')) el('user-account-dob').value = u.dateOfBirth || '';
    if (el('user-account-weight')) {
      el('user-account-weight').value = u.weight != null && u.weight !== '' ? String(u.weight) : '';
    }
    if (el('user-account-height')) {
      el('user-account-height').value = u.height != null && u.height !== '' ? String(u.height) : '';
    }
    updateUnitLabels();
    accountDirty = false;
    setStatus('');
  }

  function saveIfDirty() {
    if (!accountDirty) return Promise.resolve();
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id || !u.token || typeof window.apiPut !== 'function') return Promise.resolve();

    var payload = {
      username: el('user-account-username') && el('user-account-username').value
        ? String(el('user-account-username').value).trim()
        : null,
      firstName: el('user-account-first') && el('user-account-first').value
        ? String(el('user-account-first').value).trim()
        : null,
      lastName: el('user-account-last') && el('user-account-last').value
        ? String(el('user-account-last').value).trim()
        : null,
      dateOfBirth: (el('user-account-dob') || {}).value || null,
      measurement: getUnits() === 'metric' ? 'metric' : 'imperial',
    };

    var weightRaw = el('user-account-weight') && el('user-account-weight').value;
    var heightRaw = el('user-account-height') && el('user-account-height').value;
    payload.weight = weightRaw ? parseInt(String(weightRaw).trim(), 10) : null;
    payload.height = heightRaw ? parseInt(String(heightRaw).trim(), 10) : null;
    if (payload.weight != null && isNaN(payload.weight)) payload.weight = null;
    if (payload.height != null && isNaN(payload.height)) payload.height = null;

    var validationErr = validatePayload(payload);
    if (validationErr) {
      if (typeof validationErr === 'string') {
        setStatus(validationErr, true);
      } else if (window.NamePolicy) {
        window.NamePolicy.showPolicyError(el('user-account-status'), validationErr);
      }
      return Promise.resolve();
    }

    setStatus('Saving account…', false);
    return window
      .apiPut('/users/' + u.id, payload)
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var policy = window.NamePolicy && window.NamePolicy.responseToViolation(body);
            if (policy) {
              window.NamePolicy.showPolicyError(el('user-account-status'), policy);
            } else {
              setStatus((body && body.error) || 'Could not save account info.', true);
            }
            return;
          }
          if (typeof window.setCurrentUser === 'function') {
            var merged = Object.assign({}, u, body);
            if (u.token) merged.token = u.token;
            window.setCurrentUser(merged);
          }
          accountDirty = false;
          setStatus('Account saved.', false);
          setTimeout(function () {
            if (!accountDirty) setStatus('');
          }, 2000);
        });
      })
      .catch(function () {
        setStatus('Network error. Try again.', true);
      });
  }

  function mount(containerId) {
    var mountEl = document.getElementById(containerId || 'user-account-mount');
    if (!mountEl || mountEl.dataset.mounted === '1') return;
    mountEl.dataset.mounted = '1';
    mountEl.innerHTML = FORM_HTML;
    bindEvents(mountEl);
    loadFromUser();
  }

  window.UserAccountForm = {
    mount: mount,
    loadFromUser: loadFromUser,
    saveIfDirty: saveIfDirty,
    updateUnitLabels: updateUnitLabels,
    convertFormMetrics: convertFormMetrics,
    getUnits: getUnits,
  };
})();
