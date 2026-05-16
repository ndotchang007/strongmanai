(function () {
  var trigger = document.getElementById('sidebar-profile-trigger');
  var menu = document.getElementById('sidebar-profile-menu');
  var logoutBtn = document.getElementById('sidebar-profile-logout');
  if (!trigger || !menu) return;

  /* Popover is positioned to the right of the trigger. The sidebar uses
     overflow: hidden, which clips absolutely/fixed descendants — reparent
     the menu to body so it can paint outside the strip. */
  var placeholder = document.createComment('sidebar-profile-menu');
  if (menu.parentNode) {
    menu.parentNode.insertBefore(placeholder, menu);
    document.body.appendChild(menu);
  }

  function positionMenu() {
    var r = trigger.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.left = Math.round(r.right + 8) + 'px';
    menu.style.zIndex = '20000';
    var h = menu.offsetHeight;
    if (!h) h = 100;
    var top = Math.round(r.bottom - h);
    if (top < 8) top = 8;
    if (top + h > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - h - 8);
    }
    menu.style.top = top + 'px';
  }

  function onLayout() {
    if (!menu.hidden) positionMenu();
  }

  function closeMenu() {
    menu.hidden = true;
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', onLayout);
    window.removeEventListener('scroll', onLayout, true);
  }

  function openMenu() {
    menu.hidden = false;
    menu.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    positionMenu();
    requestAnimationFrame(function () {
      positionMenu();
      window.addEventListener('resize', onLayout);
      window.addEventListener('scroll', onLayout, true);
    });
  }

  function toggleMenu() {
    if (menu.hidden) openMenu();
    else closeMenu();
  }

  trigger.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener(
    'click',
    function (e) {
      if (menu.hidden) return;
      var t = e.target;
      if (trigger.contains(t) || menu.contains(t)) return;
      closeMenu();
    },
    false
  );

  menu.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) {
      closeMenu();
      trigger.focus();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (typeof window.setCurrentUser === 'function') {
        window.setCurrentUser(null);
      }
      try {
        window.location.href = '/';
      } catch (err) {}
    });
  }
})();
