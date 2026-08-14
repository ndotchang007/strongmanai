/**
 * Landing-style header for public marketing pages.
 * Expects .mkt-nav / #mkt-burger / #mkt-panel in the document.
 */
(function () {
  function init() {
    var burger = document.getElementById('mkt-burger');
    var panel = document.getElementById('mkt-panel');
    if (!burger || !panel) return;

    document.body.classList.add('has-mkt-nav');

    function setOpen(open) {
      panel.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!panel.classList.contains('is-open'));
    });

    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('is-open')) return;
      if (panel.contains(e.target) || burger.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        setOpen(false);
        burger.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
