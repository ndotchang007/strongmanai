(function () {
  var INIT_DATA_KEY = 'strongmanai_init';
  var SLIDE_COUNT = 5;
  var HOMEPAGE_PATH = '/home';
  var LOGIN_PATH = '/';

  // If not logged in (e.g. opened init directly), go to login
  var currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
  if (!currentUser || !currentUser.id) {
    try { window.location.replace(LOGIN_PATH); } catch (e) { window.location.href = LOGIN_PATH; }
    throw new Error('Redirecting to login');
  }

  var slideshow = document.getElementById('slideshow');
  var slides = slideshow.querySelectorAll('.slide');
  var currentIndex = 0;

  var floatingHeader = document.getElementById('floating-header');
  var slide2Content = document.getElementById('slide2-content');
  var slide3Content = document.getElementById('slide3-content');
  var slide4Body = document.getElementById('slide4-body');
  var slide4Title = document.getElementById('slide4-title');
  var slide4ThanksSubtitle = document.getElementById('slide4-thanks-subtitle');

  function getInitData() {
    try {
      var raw = localStorage.getItem(INIT_DATA_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setInitData(data) {
    var prev = getInitData();
    var next = Object.assign({}, prev, data);
    localStorage.setItem(INIT_DATA_KEY, JSON.stringify(next));
  }

  function showSlide(index) {
    if (index < 0 || index >= SLIDE_COUNT) return;
    currentIndex = index;
    slides.forEach(function (slide, i) {
      slide.classList.toggle('active', i === index);
    });

    if (floatingHeader) {
      floatingHeader.classList.remove('hidden');
      if (index === 0) floatingHeader.classList.remove('float-up');
      if (index === 1 || index === 2) floatingHeader.classList.add('float-up');
      if (index >= 3) floatingHeader.classList.add('hidden');
    }
    if (slide2Content) { slide2Content.classList.remove('fade-in', 'fade-out'); }
    if (slide3Content) { slide3Content.classList.remove('fade-in', 'fade-out'); }
    if (slide4Body) { slide4Body.classList.remove('fade-in', 'fade-out'); slide4Body.hidden = false; }
    if (slide4Title) slide4Title.classList.remove('thanks-mode');
    if (slide4ThanksSubtitle) slide4ThanksSubtitle.hidden = true;

    if (index === 1) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { if (slide2Content) slide2Content.classList.add('fade-in'); });
      });
    } else if (index === 2) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { if (slide3Content) slide3Content.classList.add('fade-in'); });
      });
    } else if (index === 3) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { if (slide4Body) slide4Body.classList.add('fade-in'); });
      });
      var data = getInitData();
      var nameEl = document.getElementById('welcomeName');
      if (nameEl) nameEl.textContent = data.firstName || '[name]';
      restoreFields();
      updateUnits();
    }
  }

  function goNext() {
    if (currentIndex < SLIDE_COUNT - 1) showSlide(currentIndex + 1);
  }

  function updateUnits() {
    var data = getInitData();
    var isMetric = (data.measurement || 'metric') === 'metric';
    var weightUnit = document.getElementById('weightUnit');
    var heightUnit = document.getElementById('heightUnit');
    if (weightUnit) weightUnit.textContent = isMetric ? 'kg' : 'lbs.';
    if (heightUnit) heightUnit.textContent = isMetric ? 'cm' : 'in.';
  }

  var slide1Advancing = false;

  // Slide 1: space or tap → title + continue prompt move up together, then slide 2 appears
  function advanceFromSlide1() {
    if (currentIndex !== 0 || slide1Advancing) return;
    slide1Advancing = true;
    floatingHeader.classList.add('float-up');
    setTimeout(function () {
      showSlide(1);
      slide1Advancing = false;
    }, 600);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ') return;
    var tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    e.preventDefault();
    if (currentIndex === 0) {
      advanceFromSlide1();
      return;
    }
    // Only slide 1 advances with space; slides 2 and 3 require form submit
    if (currentIndex === 1 || currentIndex === 2) return;
    if (currentIndex >= SLIDE_COUNT - 1) return;
    goNext();
  });

  slideshow.addEventListener('click', function (e) {
    if (currentIndex !== 0) return;
    var tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'a') return;
    advanceFromSlide1();
  });

  // Form: basic info (required fields) – show red "Required" if empty, then next
  var formBasic = document.getElementById('form-basic');
  var formBasicError = document.getElementById('form-basic-error');
  formBasic.addEventListener('submit', function (e) {
    e.preventDefault();
    var username = document.getElementById('username').value.trim();
    var firstName = document.getElementById('firstName').value.trim();
    var lastName = document.getElementById('lastName').value.trim();
    var allFilled = username && firstName && lastName;
    if (!allFilled) {
      if (formBasicError) {
        formBasicError.hidden = false;
      }
      return;
    }
    if (formBasicError) formBasicError.hidden = true;
    setInitData({ username: username, firstName: firstName, lastName: lastName });
    slide2Content.classList.remove('fade-in');
    slide2Content.classList.add('fade-out');
    setTimeout(function () {
      showSlide(2);
    }, 500);
  });
  [document.getElementById('username'), document.getElementById('firstName'), document.getElementById('lastName')].forEach(function (input) {
    if (input) input.addEventListener('input', function () { if (formBasicError) formBasicError.hidden = true; });
  });

  // Form: DOB – required; show red "Required" if any field empty
  var formDob = document.getElementById('form-dob');
  var formDobError = document.getElementById('form-dob-error');
  formDob.addEventListener('submit', function (e) {
    e.preventDefault();
    var month = document.getElementById('dobMonth').value.trim();
    var day = document.getElementById('dobDay').value.trim();
    var year = document.getElementById('dobYear').value.trim();
    var allFilled = month && day && year;
    if (!allFilled) {
      if (formDobError) formDobError.hidden = false;
      return;
    }
    if (formDobError) formDobError.hidden = true;
    setInitData({ dobMonth: month, dobDay: day, dobYear: year });
    slide3Content.classList.remove('fade-in');
    slide3Content.classList.add('fade-out');
    setTimeout(function () {
      showSlide(3);
    }, 500);
  });
  [document.getElementById('dobMonth'), document.getElementById('dobDay'), document.getElementById('dobYear')].forEach(function (input) {
    if (input) input.addEventListener('input', function () { if (formDobError) formDobError.hidden = true; });
  });

  // Option toggles (For you / For us)
  document.querySelectorAll('.init-options').forEach(function (group) {
    var field = group.getAttribute('data-field');
    group.querySelectorAll('.init-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        group.querySelectorAll('.init-opt').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var data = getInitData();
        data[field] = btn.getAttribute('data-value');
        setInitData(data);
        if (field === 'measurement') updateUnits();
      });
    });
  });

  var weightEl = document.getElementById('weight');
  var heightEl = document.getElementById('height');
  if (weightEl) {
    weightEl.addEventListener('change', function () { setInitData({ weight: weightEl.value.trim() }); });
    weightEl.addEventListener('blur', function () { setInitData({ weight: weightEl.value.trim() }); });
  }
  if (heightEl) {
    heightEl.addEventListener('change', function () { setInitData({ height: heightEl.value.trim() }); });
    heightEl.addEventListener('blur', function () { setInitData({ height: heightEl.value.trim() }); });
  }

  // Build backend payload from init data (field names match backend User)
  function buildProfilePayload() {
    var data = getInitData();
    var month = (data.dobMonth || '').trim();
    var day = (data.dobDay || '').trim();
    var year = (data.dobYear || '').trim();
    var dateOfBirth = (year && month && day) ? year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0') : null;
    var weightStr = (weightEl && weightEl.value.trim()) || data.weight;
    var heightStr = (heightEl && heightEl.value.trim()) || data.height;
    var weight = weightStr ? parseInt(weightStr, 10) : null;
    var height = heightStr ? parseInt(heightStr, 10) : null;
    if (isNaN(weight)) weight = null;
    if (isNaN(height)) height = null;
    var payload = {
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
      source: data.source || null
    };
    return payload;
  }

  // Proceed: send profile to backend, then body fades out, thank you, redirect
  var proceedErrorEl = document.getElementById('proceed-error');
  document.getElementById('btn-proceed').addEventListener('click', function () {
    var data = getInitData();
    data.weight = (weightEl && weightEl.value.trim()) || data.weight;
    data.height = (heightEl && heightEl.value.trim()) || data.height;
    setInitData(data);

    var payload = buildProfilePayload();
    var userId = currentUser.id;
    if (proceedErrorEl) proceedErrorEl.hidden = true;

    window.apiPut('/users/' + userId, payload).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          if (proceedErrorEl) {
            proceedErrorEl.textContent = body.error || 'Could not save. Try again.';
            proceedErrorEl.hidden = false;
          }
          return;
        }
        if (body && typeof window.setCurrentUser === 'function') window.setCurrentUser(body);
        slide4Body.classList.remove('fade-in');
        slide4Body.classList.add('fade-out');
        setTimeout(function () {
          slide4Body.hidden = true;
          slide4Title.classList.add('proceed-step1');
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              slide4Title.classList.add('move-to-center');
            });
          });
          setTimeout(function () {
            slide4Title.classList.remove('proceed-step1', 'move-to-center');
            slide4Title.classList.add('thanks-mode');
            slide4ThanksSubtitle.hidden = false;
            requestAnimationFrame(function () {
              slide4ThanksSubtitle.classList.add('visible');
            });
            setTimeout(function () {
              try {
                window.location.assign(HOMEPAGE_PATH);
              } catch (e) {
                window.location.href = HOMEPAGE_PATH;
              }
            }, 3000);
          }, 650);
        }, 500);
      });
    }).catch(function () {
      if (proceedErrorEl) {
        proceedErrorEl.textContent = 'Network error. Is the backend running?';
        proceedErrorEl.hidden = false;
      }
    });
  });

  document.getElementById('link-skip').addEventListener('click', function (e) {
    e.preventDefault();
    showSlide(SLIDE_COUNT - 1);
  });
  document.getElementById('link-settings').addEventListener('click', function (e) {
    e.preventDefault();
  });
  document.getElementById('link-tutorial').addEventListener('click', function (e) {
    e.preventDefault();
  });

  function restoreFields() {
    var data = getInitData();
    var u = document.getElementById('username');
    var f = document.getElementById('firstName');
    var l = document.getElementById('lastName');
    if (u) u.value = data.username || '';
    if (f) f.value = data.firstName || '';
    if (l) l.value = data.lastName || '';
    document.getElementById('dobMonth').value = data.dobMonth || '';
    document.getElementById('dobDay').value = data.dobDay || '';
    document.getElementById('dobYear').value = data.dobYear || '';
    if (weightEl) weightEl.value = data.weight || '';
    if (heightEl) heightEl.value = data.height || '';
    document.querySelectorAll('.init-options').forEach(function (group) {
      var field = group.getAttribute('data-field');
      var value = data[field];
      if (value != null) {
        group.querySelectorAll('.init-opt').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-value') === value);
        });
      }
    });
  }

  showSlide(0);
  restoreFields();
})();
