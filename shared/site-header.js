(function () {
  'use strict';

  function initSiteHeaderMenu() {
    var island = document.querySelector('.site-header-island');
    var menuBtn = document.querySelector('.site-header-menu-btn');
    var nav = document.getElementById('site-header-nav');
    if (!island || !menuBtn || !nav) return;

    function setMenuOpen(open) {
      island.classList.toggle('is-menu-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenuOpen(!island.classList.contains('is-menu-open'));
    });

    nav.querySelectorAll('.site-header-link').forEach(function (link) {
      link.addEventListener('click', function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener('click', function (e) {
      if (!island.classList.contains('is-menu-open')) return;
      if (!island.contains(e.target)) setMenuOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && island.classList.contains('is-menu-open')) {
        setMenuOpen(false);
        menuBtn.focus();
      }
    });
  }

  window.SiteHeader = {
    initSiteHeaderMenu: initSiteHeaderMenu,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteHeaderMenu);
  } else {
    initSiteHeaderMenu();
  }
})();
