(function () {
  var NAV_ITEMS = [
    { page: 'home', href: '/home', label: 'Home', icon: 'home' },
    { page: 'log', href: '/create', label: 'Log', icon: 'log' },
    { page: 'coach', href: '/generate', label: 'Coach', icon: 'coach' },
    { page: 'leaderboards', href: '/leaderboard', label: 'Rank', icon: 'trophy' },
    { page: 'profile', href: '/profile', label: 'You', icon: 'profile' }
  ];

  var ICON_PATHS = {
    home: {
      outline:
        '<path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6.5H9V21.5H4.5A1.5 1.5 0 0 1 3 20V10.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>',
      filled:
        '<path d="M12 3.2 3 10.2v9.8h6.5v-6.5h5V20H21v-9.8L12 3.2z" fill="currentColor"/>'
    },
    log: {
      outline:
        '<path d="M6.5 6.5h11v11H6.5z" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M9.5 12h5M12 9.5v5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
      filled:
        '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/><path d="M9.5 12h5M12 9.5v5" stroke="var(--bg-page, #141414)" stroke-width="1.75" stroke-linecap="round"/>'
    },
    coach: {
      outline:
        '<path d="M12 3l1.2 3.6L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.4L12 3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 18l1 2.5 1-2.5 2.5-1L7 14.5 6 12l-1 2.5L2.5 16 5 17zM19 14l.8 2 1-2 2-.8-2-.8-.8-2-.8 2-2 .8 2 .8z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>',
      filled:
        '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill="currentColor"/><path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1zM19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z" fill="currentColor" opacity="0.85"/>'
    },
    trophy: {
      outline:
        '<path d="M6 4h12v3a6 6 0 0 1-12 0V4z" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M9 17h6M12 13v4M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M6 7H4.5a2 2 0 0 0 0 4H6M18 7h1.5a2 2 0 0 1 0 4H18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
      filled:
        '<path d="M6 4h12v3a6 6 0 0 1-12 0V4z" fill="currentColor"/><path d="M9 17h6M12 13v4M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
    },
    profile: {
      outline:
        '<circle cx="12" cy="8.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
      filled:
        '<circle cx="12" cy="8.5" r="3.5" fill="currentColor"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" fill="currentColor"/>'
    }
  };

  function iconSvg(name, variant) {
    var paths = ICON_PATHS[name];
    if (!paths) return '';
    var inner = variant === 'filled' ? paths.filled : paths.outline;
    return (
      '<svg class="app-nav-icon app-nav-icon--' +
      variant +
      '" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' +
      inner +
      '</svg>'
    );
  }

  function navLinkHtml(item, isBottom) {
    var cls = 'app-nav-link';
    if (isBottom) cls += ' app-bottom-nav-link';
    else cls += ' sidebar-link';
    return (
      '<a href="' +
      item.href +
      '" class="' +
      cls +
      '" data-page="' +
      item.page +
      '" aria-label="' +
      item.label +
      '">' +
      iconSvg(item.icon, 'outline') +
      iconSvg(item.icon, 'filled') +
      '<span class="app-nav-label">' +
      item.label +
      '</span>' +
      '</a>'
    );
  }

  function setActiveNav(currentPage) {
    var map = {
      create: 'log',
      generate: 'coach',
      leaderboard: 'leaderboards',
      leaderboards: 'leaderboards',
      tracking: 'log',
      explore: 'home',
      init: 'profile',
      customize: 'profile',
      info: 'home'
    };
    var active = map[currentPage] || currentPage || '';
    document.querySelectorAll('[data-page]').forEach(function (el) {
      var page = el.getAttribute('data-page');
      var isActive = page === active;
      el.classList.toggle('app-nav-link-active', isActive);
      el.classList.toggle('sidebar-link-active', isActive && el.classList.contains('sidebar-link'));
    });
  }

  function buildSidebarNav() {
    var sidebar = document.getElementById('site-sidebar');
    if (!sidebar) return;
    var nav = sidebar.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.innerHTML = NAV_ITEMS.map(function (item) {
      return navLinkHtml(item, false);
    }).join('');

    var settingsBtn = sidebar.querySelector('.sidebar-settings-trigger');
    if (settingsBtn) {
      var menuIcon =
        '<svg class="app-nav-icon app-nav-icon--outline sidebar-menu-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
        '</svg>';
      var imgs = settingsBtn.querySelectorAll('img');
      imgs.forEach(function (img) {
        img.remove();
      });
      if (!settingsBtn.querySelector('.sidebar-menu-icon')) {
        settingsBtn.insertAdjacentHTML('afterbegin', menuIcon);
      }
    }
  }

  function buildBottomNav() {
    if (document.getElementById('app-bottom-nav')) return;
    var nav = document.createElement('nav');
    nav.id = 'app-bottom-nav';
    nav.className = 'app-bottom-nav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = NAV_ITEMS.map(function (item) {
      return navLinkHtml(item, true);
    }).join('');
    document.body.appendChild(nav);
  }

  function init() {
    buildSidebarNav();
    buildBottomNav();
    var currentPage = document.body.getAttribute('data-current-page') || '';
    setActiveNav(currentPage);
    if (window.NotificationBell && typeof window.NotificationBell.init === 'function') {
      window.NotificationBell.init();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AppNav = { setActiveNav: setActiveNav, NAV_ITEMS: NAV_ITEMS };
})();
