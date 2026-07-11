(function () {
  var INIT_DATA_KEY = 'strongmanai_init';
  var HOMEPAGE_PATH = '/home';
  var LOGIN_PATH = '/';
  var MIN_AGE = 16;
  var MAX_AGE = 110;
  var USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
  var QUESTIONNAIRE_STEPS = 9;
  var REFINE_MODE = /(?:^|[?&])refine=1(?:&|$)/.test(window.location.search || '');
  var REFINE_RETURN_PATH = '/customize';
  var REFINE_SLIDE_KEYS = [
    'small-goals',
    'big-goals',
    'discomfort',
    'machines',
    'sliders',
    'favorite-exercises',
    'least-favorite-exercises',
    'try-reason',
    'thanks',
  ];

  var EXPERIENCE_VALUES = ['beginner', 'intermediate', 'advanced'];
  var EXPERIENCE_LABELS = ['Beginner', 'Intermediate', 'Advanced'];
  var WEEKNIGHT_VALUES = ['30', '45', '60'];
  var WEEKNIGHT_LABELS = ['30 min', '45 min', '60 min'];
  var WEEKEND_VALUES = ['60', '90', '120'];
  var WEEKEND_LABELS = ['60 min', '90 min', '2 hr'];

  var BUBBLE_PRESETS = {
    smallGoals: [
      'Stay consistent',
      'Build muscle',
      'Get stronger',
      'Improve endurance',
      'Move better',
      'Sleep better',
      'More energy',
      'Reduce stress',
      'Hit PRs',
      'Eat healthier',
    ],
    bigGoals: [
      'Make varsity',
      'Win a championship',
      'College recruitment',
      'Transform my physique',
      'Compete at state',
      'Max out my lifts',
      'Become team captain',
      'Qualify for nationals',
      'Play at the next level',
      'Stay injury-free all season',
    ],
    discomforts: [
      'Knee pain',
      'Ankle pain',
      'Wrist pain',
      'Back pain',
      'Shoulder pain',
      'Hip pain',
      'Elbow pain',
      'Neck pain',
      'Shin splints',
      'None / feeling good',
    ],
    machines: [
      'Full gym',
      'Barbells',
      'Dumbbells',
      'Squat rack',
      'Bench press',
      'Cable machine',
      'Smith machine',
      'Leg press',
      'Pull-up bar',
      'Kettlebells',
      'Resistance bands',
      'Cardio machines',
      'Minimal equipment',
    ],
    favoriteExercises: [
      'Back squat',
      'Deadlift',
      'Bench press',
      'Pull-ups',
      'Overhead press',
      'Romanian deadlift',
      'Barbell row',
      'Dumbbell curls',
      'Leg press',
      'Lat pulldown',
      'Hip thrust',
      'Farmer carry',
    ],
    leastFavoriteExercises: [
      'Burpees',
      'Running',
      'Bulgarian split squats',
      'Front squats',
      'Overhead press',
      'Lunges',
      'Cardio machines',
      'Skull crushers',
      'Box jumps',
      'Nothing — I like it all',
    ],
    tryReason: [
      'Sport performance',
      'Get stronger for my sport',
      'Physique / aesthetics',
      'General health',
      'Friend recommended it',
      'Coach told me to',
      'Strongman / lifting interest',
      'Better workout planning',
      'Track progress',
      'Curious to try AI coaching',
    ],
  };

  var SLIDE_ORDER = [
    'welcome',
    'basic',
    'dob',
    'small-goals',
    'big-goals',
    'discomfort',
    'machines',
    'sliders',
    'favorite-exercises',
    'least-favorite-exercises',
    'try-reason',
    'sports',
    'thanks',
  ];

  var ACTIVE_SLIDE_ORDER = REFINE_MODE ? REFINE_SLIDE_KEYS : SLIDE_ORDER;
  var ACTIVE_QUESTIONNAIRE_STEPS = REFINE_MODE ? 8 : QUESTIONNAIRE_STEPS;

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

  if (
    !REFINE_MODE &&
    typeof window.needsProfileInit === 'function' &&
    !window.needsProfileInit(currentUser)
  ) {
    try {
      window.location.replace(HOMEPAGE_PATH);
    } catch (e2) {
      window.location.href = HOMEPAGE_PATH;
    }
    return;
  }

  var slideshow = document.getElementById('slideshow');
  var slides = slideshow
    ? Array.prototype.slice.call(slideshow.querySelectorAll('.init-slide'))
    : [];
  var segBar = document.getElementById('init-seg-bar');
  var segBarFill = document.getElementById('init-seg-bar-fill');
  var currentIndex = 0;
  var proceedInFlight = false;
  var bubbleMountsReady = false;

  var welcomeContinueBtn = document.getElementById('btn-welcome-continue');
  var dobInput = document.getElementById('dob');
  var eligibilityCheckbox = document.getElementById('eligibility-confirm');

  var sliderExperience = document.getElementById('slider-experience');
  var sliderWeeknight = document.getElementById('slider-weeknight');
  var sliderWeekend = document.getElementById('slider-weekend');
  var experienceLabel = document.getElementById('experience-label');
  var weeknightLabel = document.getElementById('weeknight-label');
  var weekendLabel = document.getElementById('weekend-label');

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
    if (window.NamePolicy) {
      var policyHit = window.NamePolicy.findNamePolicyViolation(u);
      if (policyHit) return policyHit;
    }
    return '';
  }

  function showNamePolicyOnEl(el, hit) {
    if (!el || !hit || !window.NamePolicy) return;
    window.NamePolicy.showPolicyError(el, hit);
  }

  function apiBodyPolicyHit(body) {
    return window.NamePolicy ? window.NamePolicy.responseToViolation(body) : null;
  }

  function slideKeyAt(index) {
    return ACTIVE_SLIDE_ORDER[index] || null;
  }

  function slideElForKey(key) {
    if (!slideshow || !key) return null;
    return slideshow.querySelector('.init-slide[data-slide="' + key + '"]');
  }

  function questionnaireIndex(index) {
    var key = slideKeyAt(index);
    var qStart = ACTIVE_SLIDE_ORDER.indexOf('small-goals');
    var qEndKey = REFINE_MODE ? 'try-reason' : 'sports';
    var qEnd = ACTIVE_SLIDE_ORDER.indexOf(qEndKey);
    var slideIdx = ACTIVE_SLIDE_ORDER.indexOf(key);
    if (slideIdx < qStart || slideIdx > qEnd) return -1;
    return slideIdx - qStart;
  }

  function updateSegProgress(index) {
    if (!segBar || !segBarFill) return;
    var qIdx = questionnaireIndex(index);
    var onQuestionnaire = qIdx >= 0;
    segBar.hidden = !onQuestionnaire && slideKeyAt(index) !== 'thanks';

    var fillPct = 0;
    if (onQuestionnaire) {
      fillPct = ((qIdx + 1) / ACTIVE_QUESTIONNAIRE_STEPS) * 100;
    } else if (slideKeyAt(index) === 'thanks') {
      fillPct = 100;
    }
    segBarFill.style.width = fillPct + '%';

    var activeSeg = null;
    var slide = slides[index];
    if (slide) activeSeg = slide.getAttribute('data-seg');

    document.querySelectorAll('.init-seg-bar-label').forEach(function (label) {
      var seg = label.getAttribute('data-seg');
      var segOrder = { goals: 0, setup: 1, optional: 2, sports: 3 };
      var activeOrder = activeSeg ? segOrder[activeSeg] : -1;
      var labelOrder = segOrder[seg];
      label.classList.toggle('is-active', seg === activeSeg);
      label.classList.toggle('is-done', labelOrder < activeOrder);
    });
  }

  function showSlide(index) {
    if (index < 0 || index >= ACTIVE_SLIDE_ORDER.length) return;
    currentIndex = index;
    var activeKey = slideKeyAt(index);
    slides.forEach(function (slide) {
      slide.classList.toggle('is-active', slide.getAttribute('data-slide') === activeKey);
    });
    updateSegProgress(index);

    if (slideKeyAt(index) === 'sliders') {
      restoreSliders();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    if (currentIndex < ACTIVE_SLIDE_ORDER.length - 1) showSlide(currentIndex + 1);
  }

  function goBack() {
    if (currentIndex > 0) showSlide(currentIndex - 1);
  }

  function advanceFromWelcome() {
    if (slideKeyAt(currentIndex) !== 'welcome') return;
    goNext();
  }

  if (welcomeContinueBtn) {
    welcomeContinueBtn.addEventListener('click', function (e) {
      e.preventDefault();
      advanceFromWelcome();
    });
  }

  var welcomeSlide = slideshow && slideshow.querySelector('[data-slide="welcome"]');
  if (welcomeSlide) {
    welcomeSlide.addEventListener('click', function (e) {
      if (slideKeyAt(currentIndex) !== 'welcome') return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'a') return;
      advanceFromWelcome();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.key !== 'Spacebar') return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (slideKeyAt(currentIndex) === 'welcome') {
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
          if (typeof userErr === 'string') {
            formBasicError.textContent = userErr;
          } else {
            showNamePolicyOnEl(formBasicError, userErr);
          }
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
      if (window.NamePolicy) {
        var nameHit = window.NamePolicy.checkAccountNameFields({
          firstName: firstName,
          lastName: lastName,
        });
        if (nameHit) {
          if (formBasicError) {
            showNamePolicyOnEl(formBasicError, nameHit);
            formBasicError.hidden = false;
          }
          return;
        }
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
        if (formBasicError) {
          formBasicError.hidden = true;
          formBasicError.textContent = '';
          formBasicError.innerHTML = '';
        }
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

  function getSportPresetOptions() {
    if (!window.SportDatabase || typeof window.SportDatabase.listAllNames !== 'function') {
      return [];
    }
    return window.SportDatabase.listAllNames({ excludeGeneral: false });
  }

  function isSportFocusedReason(reason) {
    return reason === 'sports';
  }

  function mountBubbleField(mountEl) {
    if (!mountEl || mountEl.getAttribute('data-mounted') === 'true') return;
    var field = mountEl.getAttribute('data-field');
    var isMulti = mountEl.getAttribute('data-multi') === 'true';
    var presets =
      field === 'sportSelections'
        ? getSportPresetOptions()
        : BUBBLE_PRESETS[field] || [];

    var grid = document.createElement('div');
    grid.className = 'init-bubble-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', field);

    var searchPanel = document.createElement('div');
    searchPanel.className = 'init-bubble-search-panel';
    searchPanel.hidden = true;

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'init-bubble-search-input';
    searchInput.placeholder = 'Type and press Enter to search/create';
    searchInput.setAttribute('aria-label', 'Search or add custom option');
    searchPanel.appendChild(searchInput);

    var customValues = [];

    function allValues() {
      return presets.concat(customValues);
    }

    function renderBubbles() {
      grid.innerHTML = '';
      allValues().forEach(function (label) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'init-bubble';
        btn.setAttribute('data-value', label);
        btn.textContent = label;
        var data = getInitData();
        var selected = data[field];
        if (isMulti && Array.isArray(selected)) {
          btn.classList.toggle('is-selected', selected.indexOf(label) !== -1);
        } else if (!isMulti && selected === label) {
          btn.classList.add('is-selected');
        }
        btn.addEventListener('click', function () {
          if (isMulti) {
            btn.classList.toggle('is-selected');
            var next = [];
            grid.querySelectorAll('.init-bubble.is-selected:not(.init-bubble--search)').forEach(function (b) {
              next.push(b.getAttribute('data-value'));
            });
            var patch = {};
            patch[field] = next;
            setInitData(patch);
          } else {
            grid.querySelectorAll('.init-bubble:not(.init-bubble--search)').forEach(function (b) {
              b.classList.remove('is-selected');
            });
            btn.classList.add('is-selected');
            var patchSingle = {};
            patchSingle[field] = label;
            setInitData(patchSingle);
          }
        });
        grid.appendChild(btn);
      });

      var searchBtn = document.createElement('button');
      searchBtn.type = 'button';
      searchBtn.className = 'init-bubble init-bubble--search';
      searchBtn.setAttribute('data-action', 'search');
      var searchText = document.createElement('span');
      searchText.className = 'init-bubble-search-text';
      searchText.textContent = 'search/create';
      searchBtn.appendChild(searchText);
      searchBtn.addEventListener('click', function () {
        var open = !searchPanel.hidden;
        searchPanel.hidden = open;
        searchBtn.classList.toggle('is-active', !open);
        if (!open) {
          searchInput.focus();
        } else {
          searchInput.value = '';
        }
      });
      grid.appendChild(searchBtn);
    }

    function addCustomValue(raw) {
      var val = (raw || '').trim();
      if (!val) return;
      if (window.NamePolicy) {
        var hit = window.NamePolicy.findNamePolicyViolation(val);
        if (hit) return;
      }
      if (allValues().some(function (v) {
        return v.toLowerCase() === val.toLowerCase();
      })) {
        val = allValues().find(function (v) {
          return v.toLowerCase() === val.toLowerCase();
        });
      } else {
        customValues.push(val);
      }
      renderBubbles();
      var data = getInitData();
      var selected = data[field];
      if (isMulti) {
        var next = Array.isArray(selected) ? selected.slice() : [];
        if (next.indexOf(val) === -1) next.push(val);
        var patch = {};
        patch[field] = next;
        setInitData(patch);
      } else {
        var patchSingle = {};
        patchSingle[field] = val;
        setInitData(patchSingle);
      }
      var matchBtn = null;
      grid.querySelectorAll('.init-bubble[data-value]').forEach(function (b) {
        if (b.getAttribute('data-value') === val) matchBtn = b;
      });
      if (matchBtn) matchBtn.classList.add('is-selected');
      searchPanel.hidden = true;
      searchBtn.classList.remove('is-active');
      searchInput.value = '';
    }

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomValue(searchInput.value);
      }
      if (e.key === 'Escape') {
        searchPanel.hidden = true;
        grid.querySelector('.init-bubble--search').classList.remove('is-active');
        searchInput.value = '';
      }
    });

    var data = getInitData();
    var existing = data[field];
    if (Array.isArray(existing)) {
      existing.forEach(function (val) {
        if (
          val &&
          !presets.some(function (p) {
            return p.toLowerCase() === String(val).toLowerCase();
          }) &&
          !customValues.some(function (c) {
            return c.toLowerCase() === String(val).toLowerCase();
          })
        ) {
          customValues.push(String(val));
        }
      });
    }

    renderBubbles();
    mountEl.appendChild(grid);
    mountEl.appendChild(searchPanel);
    mountEl.setAttribute('data-mounted', 'true');
  }

  function initBubbleMounts() {
    if (bubbleMountsReady) return;
    document.querySelectorAll('.init-bubble-mount').forEach(mountBubbleField);
    bubbleMountsReady = true;
  }

  function syncSliderLabels() {
    if (sliderExperience && experienceLabel) {
      var ei = parseInt(sliderExperience.value, 10) || 0;
      experienceLabel.textContent = EXPERIENCE_LABELS[ei] || EXPERIENCE_LABELS[0];
      sliderExperience.setAttribute('aria-valuetext', experienceLabel.textContent);
    }
    if (sliderWeeknight && weeknightLabel) {
      var wi = parseInt(sliderWeeknight.value, 10) || 0;
      weeknightLabel.textContent = WEEKNIGHT_LABELS[wi] || WEEKNIGHT_LABELS[1];
      sliderWeeknight.setAttribute('aria-valuetext', weeknightLabel.textContent);
    }
    if (sliderWeekend && weekendLabel) {
      var vi = parseInt(sliderWeekend.value, 10) || 0;
      weekendLabel.textContent = WEEKEND_LABELS[vi] || WEEKEND_LABELS[1];
      sliderWeekend.setAttribute('aria-valuetext', weekendLabel.textContent);
    }
  }

  function persistSliders() {
    var patch = {};
    if (sliderExperience) {
      var ei = parseInt(sliderExperience.value, 10) || 0;
      patch.experience = EXPERIENCE_VALUES[ei] || 'beginner';
    }
    if (sliderWeeknight) {
      var wi = parseInt(sliderWeeknight.value, 10) || 1;
      patch.schoolNightMax = WEEKNIGHT_VALUES[wi] || '45';
    }
    if (sliderWeekend) {
      var vi = parseInt(sliderWeekend.value, 10) || 1;
      patch.weekendMax = WEEKEND_VALUES[vi] || '90';
    }
    setInitData(patch);
  }

  function restoreSliders() {
    var data = getInitData();
    if (sliderExperience) {
      var ei = EXPERIENCE_VALUES.indexOf(data.experience || 'beginner');
      sliderExperience.value = String(ei >= 0 ? ei : 0);
    }
    if (sliderWeeknight) {
      var wi = WEEKNIGHT_VALUES.indexOf(String(data.schoolNightMax || '45'));
      sliderWeeknight.value = String(wi >= 0 ? wi : 1);
    }
    if (sliderWeekend) {
      var vi = WEEKEND_VALUES.indexOf(String(data.weekendMax || '90'));
      sliderWeekend.value = String(vi >= 0 ? vi : 1);
    }
    syncSliderLabels();
  }

  [sliderExperience, sliderWeeknight, sliderWeekend].forEach(function (slider) {
    if (!slider) return;
    slider.addEventListener('input', function () {
      syncSliderLabels();
      persistSliders();
    });
  });

  function hideStepError(key) {
    var el = document.getElementById('error-' + key);
    if (el) {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function showStepError(key, message) {
    var el = document.getElementById('error-' + key);
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  function validateQuestionStep(key) {
    var slide = slideElForKey(key);
    if (slide && slide.getAttribute('data-optional') === 'true') {
      return '';
    }
    var data = getInitData();
    if (key === 'small-goals') {
      if (!data.smallGoals || !data.smallGoals.length) {
        return 'Pick at least one small goal (or use search to add your own).';
      }
    }
    if (key === 'big-goals') {
      if (!data.bigGoals || !data.bigGoals.length) {
        return 'Pick at least one big goal (or use search to add your own).';
      }
    }
    if (key === 'discomfort') {
      if (!data.discomforts || !data.discomforts.length) {
        return 'Select any discomfort you feel, or choose “None / feeling good”.';
      }
    }
    if (key === 'machines') {
      if (!data.machines || !data.machines.length) {
        return 'Select at least one option for equipment access.';
      }
    }
    if (key === 'sports') {
      if (data.noSports) return '';
      if (
        isSportFocusedReason(inferReasonFromGoals(data)) &&
        (!data.sportSelections || !data.sportSelections.length)
      ) {
        return 'Select at least one sport you play, or tap “No sport — general fitness”.';
      }
    }
    return '';
  }

  document.querySelectorAll('[data-action="next"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = slideKeyAt(currentIndex);
      if (!key) return;
      var err = validateQuestionStep(key);
      if (err) {
        showStepError(key, err);
        return;
      }
      hideStepError(key);
      if (key === 'sliders') persistSliders();
      if (REFINE_MODE && key === 'try-reason') {
        handleRefineFinish();
        return;
      }
      goNext();
    });
  });

  document.querySelectorAll('[data-action="skip"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goNext();
    });
  });

  document.querySelectorAll('[data-action="back"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = slideKeyAt(currentIndex);
      if (key) hideStepError(key);
      goBack();
    });
  });

  function machinesToEquipment(machines) {
    if (!machines || !machines.length) return 'home';
    var lower = machines.map(function (m) {
      return String(m).toLowerCase();
    });
    if (lower.indexOf('minimal equipment') !== -1 && machines.length === 1) return 'none';
    if (lower.indexOf('full gym') !== -1 || machines.length >= 4) return 'local';
    return 'home';
  }

  function inferReasonFromGoals(data) {
    var tryReason = (data.tryReason || []).join(' ').toLowerCase();
    if (/physique|aesthetic|look/.test(tryReason)) return 'aesthetics';
    if (/strongman|lift|stronger|max/.test(tryReason)) return 'strength';
    if (/health|track|curious/.test(tryReason)) return 'health';
    if (/sport|coach|performance|planning/.test(tryReason)) return 'sports';

    var all = []
      .concat(data.bigGoals || [])
      .concat(data.smallGoals || [])
      .join(' ')
      .toLowerCase();
    if (/varsity|championship|state|national|recruit|next level|captain/.test(all)) {
      return 'sports';
    }
    if (/physique|muscle|transform/.test(all)) return 'aesthetics';
    if (/max|pr|lift|stronger/.test(all)) return 'strength';
    if (/health|injury|sleep|stress|energy|consistent|habit/.test(all)) return 'health';
    return 'health';
  }

  function buildNotes(data) {
    var parts = [];
    if (data.smallGoals && data.smallGoals.length) {
      parts.push('Small goals: ' + data.smallGoals.join(', '));
    }
    if (data.bigGoals && data.bigGoals.length) {
      parts.push('Big goals: ' + data.bigGoals.join(', '));
    }
    if (data.discomforts && data.discomforts.length) {
      parts.push('Discomforts: ' + data.discomforts.join(', '));
    }
    if (data.machines && data.machines.length) {
      parts.push('Equipment access: ' + data.machines.join(', '));
    }
    if (data.favoriteExercises && data.favoriteExercises.length) {
      parts.push('Favorite exercises: ' + data.favoriteExercises.join(', '));
    }
    if (data.leastFavoriteExercises && data.leastFavoriteExercises.length) {
      parts.push('Least favorite exercises: ' + data.leastFavoriteExercises.join(', '));
    }
    if (data.tryReason && data.tryReason.length) {
      parts.push('Reason for trying Strongman AI: ' + data.tryReason.join(', '));
    }
    return parts.length ? parts.join('\n') : null;
  }

  function sportsFromSelections(selections) {
    var AC = window.AthleteContext;
    if (!AC) return [];
    return (selections || []).map(function (name, index) {
      var sp = window.SportDatabase
        ? window.SportDatabase.resolveSport(name) ||
          window.SportDatabase.search(name, 1)[0]
        : null;
      return AC.defaultSport({
        sport: sp ? sp.name : String(name).trim(),
        sportId: sp ? sp.id : null,
        isPrimary: index === 0,
        seasonPhase: 'in_season',
        practiceDays: [{ weekday: 1 }],
        gameDays: [],
      });
    });
  }

  function mergeScheduleFromSports(sports) {
    var practice = [];
    var games = [];
    (sports || []).forEach(function (s) {
      (s.practiceDays || []).forEach(function (p) {
        practice.push(p);
      });
      (s.gameDays || []).forEach(function (g) {
        games.push(g);
      });
    });
    return { practiceDays: practice, gameDays: games };
  }

  function schoolNightToTimeAvailable(minutes) {
    var n = parseInt(minutes, 10);
    if (n <= 30) return '1hr';
    if (n <= 60) return '2hr';
    return '2hr';
  }

  function buildAthleteContextPayload(data) {
    var AC = window.AthleteContext;
    var reason = inferReasonFromGoals(data);
    var sportFocused = isSportFocusedReason(reason) && !data.noSports;
    var hasSportSelections = !!(data.sportSelections && data.sportSelections.length);
    var sports =
      !data.noSports && (sportFocused || hasSportSelections)
        ? sportsFromSelections(data.sportSelections)
        : [];
    var first = sports[0] || null;
    var schedule = mergeScheduleFromSports(sports);
    var primaryGoal = AC ? AC.reasonToPrimaryGoal(reason) : 'general_health';
    return {
      sports: sports,
      sport: first ? first.sport : null,
      sportId: first ? first.sportId : null,
      position: first ? first.position : null,
      gradeLevel: sportFocused ? data.gradeLevel || null : null,
      seasonPhase: first ? first.seasonPhase : null,
      primaryGoal: primaryGoal,
      schoolDays: [1, 2, 3, 4, 5],
      practiceDays: schedule.practiceDays,
      gameDays: schedule.gameDays,
      schoolNightMaxMinutes: parseInt(data.schoolNightMax, 10) || 45,
      weekendMaxMinutes: parseInt(data.weekendMax, 10) || 90,
      knownNotes: buildNotes(data),
      notes: null,
    };
  }

  function buildProfilePayload() {
    var data = getInitData();
    var iso =
      (data.dobIso && String(data.dobIso).trim()) ||
      isoFromParts(data.dobYear, data.dobMonth, data.dobDay);
    var dateOfBirth = iso || null;
    var schoolNightMax = data.schoolNightMax || '45';
    var timeAvailable = data.time || schoolNightToTimeAvailable(schoolNightMax);

    return {
      username: data.username || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      dateOfBirth: dateOfBirth,
      weight: null,
      height: null,
      measurement: data.measurement || 'metric',
      experience: data.experience || 'beginner',
      equipment: machinesToEquipment(data.machines),
      timeAvailable: timeAvailable,
      reason: inferReasonFromGoals(data),
      source: data.source || (data.tryReason && data.tryReason[0]) || null,
      profileInitialized: true,
      lastSeenVersion:
        (window.VERSION_CATALOG && window.VERSION_CATALOG.current) || 'v1.2',
      athleteContext: buildAthleteContextPayload(data),
    };
  }

  function finishAndRedirect() {
    showSlide(ACTIVE_SLIDE_ORDER.indexOf('thanks'));
    var data = getInitData();
    var sportFocused = isSportFocusedReason(inferReasonFromGoals(data)) && !data.noSports;
    var dest = REFINE_MODE ? REFINE_RETURN_PATH : HOMEPAGE_PATH;
    var thanksSubtitle = document.getElementById('thanks-subtitle');
    if (!REFINE_MODE) {
      if (sportFocused) {
        dest = '/customize?setup=1';
        if (thanksSubtitle) {
          thanksSubtitle.textContent =
            'Next up: set your practice nights and game days so Rocky can coach around your real schedule…';
        }
      } else {
        dest = '/home';
        if (thanksSubtitle) {
          thanksSubtitle.textContent =
            'You\'re ready to log workouts, chat with Rocky, and build your daily habit…';
        }
      }
    } else if (thanksSubtitle) {
      thanksSubtitle.textContent = 'Taking you back to your settings…';
    }
    setTimeout(function () {
      try {
        window.location.assign(dest);
      } catch (e) {
        window.location.href = dest;
      }
    }, 1800);
  }

  function loadRefineBootstrap() {
    if (!REFINE_MODE || !window.AthleteContext) return;
    var ctx = window.AthleteContext.loadAthleteContext(currentUser);
    var parsed =
      window.KnownNotes && window.KnownNotes.parseToInitData
        ? window.KnownNotes.parseToInitData(ctx.knownNotes)
        : {};
    parsed.experience = currentUser.experience || parsed.experience || 'beginner';
    parsed.schoolNightMax = String(ctx.schoolNightMaxMinutes || 45);
    parsed.weekendMax = String(ctx.weekendMaxMinutes || 90);
    setInitData(parsed);
  }

  function handleRefineFinish() {
    if (proceedInFlight) return;
    var err = validateQuestionStep('try-reason');
    if (err) {
      showStepError('try-reason', err);
      return;
    }
    hideStepError('try-reason');
    persistSliders();
    proceedInFlight = true;

    var data = getInitData();
    var ctx =
      window.AthleteContext && currentUser
        ? window.AthleteContext.loadAthleteContext(currentUser)
        : {};
    var athleteContext = Object.assign({}, ctx, {
      knownNotes: buildNotes(data),
      schoolNightMaxMinutes: parseInt(data.schoolNightMax, 10) || ctx.schoolNightMaxMinutes || 45,
      weekendMaxMinutes: parseInt(data.weekendMax, 10) || ctx.weekendMaxMinutes || 90,
    });

    var payload = {
      experience: data.experience || currentUser.experience || 'beginner',
      equipment: machinesToEquipment(data.machines) || currentUser.equipment || 'home',
      reason: inferReasonFromGoals(data),
      athleteContext: athleteContext,
    };

    window
      .apiPut('/users/' + currentUser.id, payload)
      .then(function (res) {
        return res.json().then(function (body) {
          proceedInFlight = false;
          if (!res.ok) {
            showStepError('try-reason', (body && body.error) || 'Could not save. Try again.');
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
        showStepError('try-reason', 'Network error. Check your connection and try again.');
      });
  }

  function handleFinish(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (slideKeyAt(currentIndex) !== 'sports' || proceedInFlight) return;

    var err = validateQuestionStep('sports');
    if (err) {
      showStepError('sports', err);
      return;
    }
    hideStepError('sports');

    var data = getInitData();
    var dobCheck = validateDob(
      data.dobIso || isoFromParts(data.dobYear, data.dobMonth, data.dobDay)
    );
    if (!dobCheck.ok) {
      showSlide(SLIDE_ORDER.indexOf('dob'));
      if (formDobError) {
        formDobError.textContent = dobCheck.message;
        formDobError.hidden = false;
      }
      return;
    }

    proceedInFlight = true;
    persistSliders();
    setInitData(data);

    var payload = buildProfilePayload();
    var btnFinish = document.getElementById('btn-finish');
    if (btnFinish) btnFinish.disabled = true;

    window
      .apiPut('/users/' + currentUser.id, payload)
      .then(function (res) {
        return res.json().then(function (body) {
          proceedInFlight = false;
          if (btnFinish) btnFinish.disabled = false;

          if (!res.ok) {
            var errEl = document.getElementById('error-sports');
            var policyHit = apiBodyPolicyHit(body);
            if (policyHit && errEl) {
              showNamePolicyOnEl(errEl, policyHit);
              errEl.hidden = false;
            } else {
              showStepError(
                'sports',
                (body && body.error) || 'Could not save. Try again.'
              );
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
        if (btnFinish) btnFinish.disabled = false;
        showStepError('sports', 'Network error. Check your connection and try again.');
      });
  }

  var btnFinish = document.getElementById('btn-finish');
  if (btnFinish) {
    btnFinish.addEventListener('click', handleFinish);
  }

  var btnSkipSports = document.getElementById('btn-skip-sports');
  if (btnSkipSports) {
    btnSkipSports.addEventListener('click', function () {
      if (slideKeyAt(currentIndex) !== 'sports' || proceedInFlight) return;
      var data = getInitData();
      data.noSports = true;
      data.sportSelections = [];
      data.gradeLevel = null;
      setInitData(data);
      hideStepError('sports');
      handleFinish();
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

    document.querySelectorAll('.init-grade-pill').forEach(function (btn) {
      var grade = btn.getAttribute('data-grade');
      btn.classList.toggle('is-selected', grade === String(data.gradeLevel || ''));
      btn.setAttribute('aria-pressed', grade === String(data.gradeLevel || '') ? 'true' : 'false');
    });

    restoreSliders();
  }

  function bindGradePills() {
    document.querySelectorAll('.init-grade-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var grade = btn.getAttribute('data-grade');
        document.querySelectorAll('.init-grade-pill').forEach(function (other) {
          other.classList.remove('is-selected');
          other.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
        setInitData({ gradeLevel: grade });
      });
    });
  }

  configureDobInputLimits();
  initBubbleMounts();
  bindGradePills();
  loadRefineBootstrap();
  restoreFields();
  if (REFINE_MODE) {
    document.body.classList.add('init-page--refine');
    var brandLink = document.querySelector('.init-brand');
    if (brandLink) brandLink.setAttribute('href', REFINE_RETURN_PATH);
  }
  showSlide(0);
})();
