(function () {
  var INIT_DATA_KEY = 'strongmanai_init';
  var SLIDE_COUNT = 5;
  var HOMEPAGE_PATH = '/home';
  var LOGIN_PATH = '/';
  var MIN_AGE = 16;
  var MAX_AGE = 110;
  var USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

  var currentUser =
    typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  if (!currentUser || !currentUser.id) {
    try {
      window.location.replace(LOGIN_PATH);
    } catch (e) {
      window.location.href = LOGIN_PATH;
    }
    return;
  }

  var slideshow = document.getElementById('slideshow');
  var slides = slideshow ? slideshow.querySelectorAll('.init-slide') : [];
  var progressNav = document.getElementById('init-progress');
  var currentIndex = 0;
  var proceedInFlight = false;

  var welcomeContinueBtn = document.getElementById('btn-welcome-continue');
  var slide4Body = document.getElementById('slide4-body');
  var proceedErrorEl = document.getElementById('proceed-error');
  var weightEl = document.getElementById('weight');
  var heightEl = document.getElementById('height');
  var dobInput = document.getElementById('dob');
  var eligibilityCheckbox = document.getElementById('eligibility-confirm');

  function getInitData() {
    try {
      var raw = localStorage.getItem(INIT_DATA_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setInitData(data) {
    var next = Object.assign({}, getInitData(), data);
    localStorage.setItem(INIT_DATA_KEY, JSON.stringify(next));
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function isoFromParts(year, month, day) {
    if (!year || !month || !day) return '';
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  function partsFromIso(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var p = iso.split('-');
    return { year: p[0], month: p[1], day: p[2] };
  }

  function formatIsoDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function configureDobInputLimits() {
    if (!dobInput) return;
    var today = new Date();
    var maxDob = new Date(
      today.getFullYear() - MIN_AGE,
      today.getMonth(),
      today.getDate()
    );
    var minDob = new Date(
      today.getFullYear() - MAX_AGE,
      today.getMonth(),
      today.getDate()
    );
    dobInput.max = formatIsoDate(maxDob);
    dobInput.min = formatIsoDate(minDob);
  }

  function ageFromIso(iso) {
    var parts = partsFromIso(iso);
    if (!parts) return null;
    var y = parseInt(parts.year, 10);
    var m = parseInt(parts.month, 10);
    var d = parseInt(parts.day, 10);
    if (!y || !m || !d) return null;
    var birth = new Date(y, m - 1, d);
    if (
      birth.getFullYear() !== y ||
      birth.getMonth() !== m - 1 ||
      birth.getDate() !== d
    ) {
      return null;
    }
    var today = new Date();
    var age = today.getFullYear() - y;
    var hadBirthday =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hadBirthday) age -= 1;
    return age;
  }

  function validateDob(iso) {
    if (!iso) {
      return { ok: false, message: 'Enter your date of birth.' };
    }
    var parts = partsFromIso(iso);
    if (!parts) {
      return { ok: false, message: 'Enter a valid date of birth.' };
    }
    var age = ageFromIso(iso);
    if (age == null) {
      return { ok: false, message: 'Enter a valid date of birth.' };
    }
    if (age < MIN_AGE) {
      return {
        ok: false,
        message:
          'You must be at least ' +
          MIN_AGE +
          ' years old to use Strongman AI. If you are under ' +
          MIN_AGE +
          ', ask a parent or coach to help you find age-appropriate training resources.',
      };
    }
    if (age > MAX_AGE) {
      return { ok: false, message: 'Please enter a realistic date of birth.' };
    }
    return { ok: true, age: age };
  }

  function validateUsername(value) {
    var u = (value || '').trim();
    if (!u) return 'Choose a username.';
    if (u.length < 3) return 'Username must be at least 3 characters.';
    if (u.length > 30) return 'Username must be 30 characters or fewer.';
    if (!USERNAME_RE.test(u)) {
      return 'Use only letters, numbers, and underscores (no spaces).';
    }
    return '';
  }

  function updateProgress(index) {
    if (!progressNav) return;
    progressNav.hidden = index === 0;
    document.querySelectorAll('.init-progress-step').forEach(function (step) {
      var n = parseInt(step.getAttribute('data-step'), 10);
      step.classList.toggle('is-active', n === index + 1);
      step.classList.toggle('is-done', n < index + 1);
    });
  }

  function showSlide(index) {
    if (index < 0 || index >= SLIDE_COUNT) return;
    currentIndex = index;
    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === index);
    });
    updateProgress(index);

    if (index === 3) {
      var data = getInitData();
      var nameEl = document.getElementById('welcomeName');
      if (nameEl) nameEl.textContent = data.firstName || 'athlete';
      restoreFields();
      updateUnits();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    if (currentIndex < SLIDE_COUNT - 1) showSlide(currentIndex + 1);
  }

  function updateUnits() {
    var data = getInitData();
    var isMetric = (data.measurement || 'metric') === 'metric';
    var weightUnit = document.getElementById('weightUnit');
    var heightUnit = document.getElementById('heightUnit');
    if (weightUnit) weightUnit.textContent = isMetric ? 'kg' : 'lb';
    if (heightUnit) heightUnit.textContent = isMetric ? 'cm' : 'in';
  }

  function advanceFromWelcome() {
    if (currentIndex !== 0) return;
    goNext();
  }

  if (welcomeContinueBtn) {
    welcomeContinueBtn.addEventListener('click', function (e) {
      e.preventDefault();
      advanceFromWelcome();
    });
  }

  var slide1 = slideshow && slideshow.querySelector('[data-slide="1"]');
  if (slide1) {
    slide1.addEventListener('click', function (e) {
      if (currentIndex !== 0) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'a') return;
      advanceFromWelcome();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.key !== 'Spacebar') return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (currentIndex === 0) {
      e.preventDefault();
      advanceFromWelcome();
    }
  });

  var formBasic = document.getElementById('form-basic');
  var formBasicError = document.getElementById('form-basic-error');

  if (formBasic) {
    formBasic.addEventListener('submit', function (e) {
      e.preventDefault();
      var username = document.getElementById('username').value.trim();
      var firstName = document.getElementById('firstName').value.trim();
      var lastName = document.getElementById('lastName').value.trim();

      var userErr = validateUsername(username);
      if (userErr) {
        if (formBasicError) {
          formBasicError.textContent = userErr;
          formBasicError.hidden = false;
        }
        return;
      }
      if (!firstName || !lastName) {
        if (formBasicError) {
          formBasicError.textContent = 'First and last name are required.';
          formBasicError.hidden = false;
        }
        return;
      }
      if (firstName.length > 64 || lastName.length > 64) {
        if (formBasicError) {
          formBasicError.textContent = 'Names must be 64 characters or fewer.';
          formBasicError.hidden = false;
        }
        return;
      }

      if (formBasicError) formBasicError.hidden = true;
      setInitData({ username: username, firstName: firstName, lastName: lastName });
      goNext();
    });
  }

  ['username', 'firstName', 'lastName'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', function () {
        if (formBasicError) formBasicError.hidden = true;
      });
    }
  });

  var formDob = document.getElementById('form-dob');
  var formDobError = document.getElementById('form-dob-error');

  if (formDob) {
    formDob.addEventListener('submit', function (e) {
      e.preventDefault();
      var iso = dobInput ? dobInput.value : '';
      var dobCheck = validateDob(iso);

      if (!dobCheck.ok) {
        if (formDobError) {
          formDobError.textContent = dobCheck.message;
          formDobError.hidden = false;
        }
        return;
      }

      if (!eligibilityCheckbox || !eligibilityCheckbox.checked) {
        if (formDobError) {
          formDobError.textContent =
            'Please confirm you meet the minimum age requirement.';
          formDobError.hidden = false;
        }
        return;
      }

      var parts = partsFromIso(iso);
      if (formDobError) formDobError.hidden = true;
      setInitData({
        dobIso: iso,
        dobMonth: parts.month,
        dobDay: parts.day,
        dobYear: parts.year,
      });
      goNext();
    });
  }

  if (dobInput) {
    dobInput.addEventListener('change', function () {
      if (formDobError) formDobError.hidden = true;
    });
  }
  if (eligibilityCheckbox) {
    eligibilityCheckbox.addEventListener('change', function () {
      if (formDobError) formDobError.hidden = true;
    });
  }

  document.querySelectorAll('.init-chip-row').forEach(function (group) {
    var field = group.getAttribute('data-field');
    group.querySelectorAll('.init-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        group.querySelectorAll('.init-chip').forEach(function (b) {
          b.classList.remove('is-selected');
        });
        btn.classList.add('is-selected');
        var patch = {};
        patch[field] = btn.getAttribute('data-value');
        setInitData(patch);
        if (field === 'measurement') updateUnits();
      });
    });
  });

  if (weightEl) {
    weightEl.addEventListener('change', function () {
      setInitData({ weight: weightEl.value.trim() });
    });
    weightEl.addEventListener('blur', function () {
      setInitData({ weight: weightEl.value.trim() });
    });
  }
  if (heightEl) {
    heightEl.addEventListener('change', function () {
      setInitData({ height: heightEl.value.trim() });
    });
    heightEl.addEventListener('blur', function () {
      setInitData({ height: heightEl.value.trim() });
    });
  }

  function buildProfilePayload() {
    var data = getInitData();
    var iso =
      (data.dobIso && String(data.dobIso).trim()) ||
      isoFromParts(data.dobYear, data.dobMonth, data.dobDay);
    var dateOfBirth = iso || null;

    var weightStr = (weightEl && weightEl.value.trim()) || data.weight;
    var heightStr = (heightEl && heightEl.value.trim()) || data.height;
    var weight = weightStr ? parseInt(weightStr, 10) : null;
    var height = heightStr ? parseInt(heightStr, 10) : null;
    if (isNaN(weight)) weight = null;
    if (isNaN(height)) height = null;

    return {
      username: data.username || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      dateOfBirth: dateOfBirth,
      weight: weight,
      height: height,
      measurement: data.measurement || null,
      experience: data.experience || null,
      equipment: data.equipment || null,
      timeAvailable: data.time || null,
      reason: data.reason || null,
      source: data.source || null,
    };
  }

  function finishAndRedirect() {
    showSlide(4);
    setTimeout(function () {
      try {
        window.location.assign(HOMEPAGE_PATH);
      } catch (e) {
        window.location.href = HOMEPAGE_PATH;
      }
    }, 2200);
  }

  function handleProceed(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentIndex !== 3 || proceedInFlight) return;

    var data = getInitData();
    var dobCheck = validateDob(
      data.dobIso || isoFromParts(data.dobYear, data.dobMonth, data.dobDay)
    );
    if (!dobCheck.ok) {
      if (proceedErrorEl) {
        proceedErrorEl.textContent = dobCheck.message;
        proceedErrorEl.hidden = false;
      }
      showSlide(2);
      return;
    }

    proceedInFlight = true;
    data.weight = (weightEl && weightEl.value.trim()) || data.weight;
    data.height = (heightEl && heightEl.value.trim()) || data.height;
    setInitData(data);

    var payload = buildProfilePayload();
    if (proceedErrorEl) proceedErrorEl.hidden = true;

    var btnProceed = document.getElementById('btn-proceed');
    var btnSkip = document.getElementById('link-skip');
    if (btnProceed) btnProceed.disabled = true;
    if (btnSkip) btnSkip.disabled = true;

    window
      .apiPut('/users/' + currentUser.id, payload)
      .then(function (res) {
        return res.json().then(function (body) {
          proceedInFlight = false;
          if (btnProceed) btnProceed.disabled = false;
          if (btnSkip) btnSkip.disabled = false;

          if (!res.ok) {
            if (proceedErrorEl) {
              proceedErrorEl.textContent =
                (body && body.error) || 'Could not save. Try again.';
              proceedErrorEl.hidden = false;
            }
            return;
          }
          if (body && typeof window.setCurrentUser === 'function') {
            window.setCurrentUser(body);
          }
          finishAndRedirect();
        });
      })
      .catch(function () {
        proceedInFlight = false;
        if (btnProceed) btnProceed.disabled = false;
        if (btnSkip) btnSkip.disabled = false;
        if (proceedErrorEl) {
          proceedErrorEl.textContent =
            'Network error. Check your connection and try again.';
          proceedErrorEl.hidden = false;
        }
      });
  }

  var btnProceed = document.getElementById('btn-proceed');
  if (btnProceed) {
    btnProceed.addEventListener('click', handleProceed);
  }

  var linkSkip = document.getElementById('link-skip');
  if (linkSkip) {
    linkSkip.addEventListener('click', handleProceed);
  }

  var linkSettings = document.getElementById('link-settings');
  if (linkSettings) {
    linkSettings.addEventListener('click', function (e) {
      e.preventDefault();
    });
  }

  function restoreFields() {
    var data = getInitData();
    var u = document.getElementById('username');
    var f = document.getElementById('firstName');
    var l = document.getElementById('lastName');
    if (u) u.value = data.username || '';
    if (f) f.value = data.firstName || '';
    if (l) l.value = data.lastName || '';

    if (dobInput) {
      dobInput.value =
        (data.dobIso && String(data.dobIso).trim()) ||
        isoFromParts(data.dobYear, data.dobMonth, data.dobDay) ||
        '';
    }

    if (weightEl) weightEl.value = data.weight || '';
    if (heightEl) heightEl.value = data.height || '';

    document.querySelectorAll('.init-chip-row').forEach(function (group) {
      var field = group.getAttribute('data-field');
      var value = data[field];
      if (value != null) {
        group.querySelectorAll('.init-chip').forEach(function (b) {
          b.classList.toggle(
            'is-selected',
            b.getAttribute('data-value') === value
          );
        });
      }
    });
  }

  configureDobInputLimits();
  showSlide(0);
  restoreFields();
})();
