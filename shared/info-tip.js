(function () {
  var TIPS = {
    weeknight_cap:
      'The maximum gym time Rocky plans for school nights (Monday–Friday). Keeps lifting realistic after class and practice.',
    weekend_max:
      'The longer session limit for Saturdays and Sundays, when you may have more time to train.',
    weeknight:
      'A school night (Mon–Fri). Rocky keeps gym sessions shorter so lifting fits your evening schedule.',
    season:
      'Where you are in your sports calendar: pre-season (building up), in-season (competing now), or off-season (developing strength and size).',
    practice_days:
      'Days you have team practice. Rocky programs complementary gym work that does not fight your sport training.',
    competition_days:
      'Game, match, or meet days. Rocky shortens gym sessions and avoids heavy legs before these.',
    main_goal:
      'What Rocky prioritizes in workouts: sport performance, physique, max strength, or general health.',
    lifting_focus:
      'How strength training supports your sport — a quick coaching note based on your sport profile.',
    sport_performance:
      'Workouts emphasize power, durability, and movements that help your sport — not just looking strong in the gym.',
    pre_season:
      'Ramp-up phase before competition. More volume and strength work while sport load is still building.',
    in_season:
      'You are competing now. Rocky dials down gym volume and protects recovery around games and meets.',
    off_season:
      'Break from competition. More room for hypertrophy, strength blocks, and fixing weak points.',
    practice_day:
      'Today you have practice. Rocky favors short, complementary lifts instead of duplicating sport work.',
    competition_day:
      'Today you compete. Rocky recommends light recovery work only — no heavy loading.',
    coach_quota:
      'How many messages you can send Rocky today. Resets every 24 hours.',
    exercise_why:
      'Why Rocky picked this lift for you — based on your sport, goal, and what you told him in chat.',
  };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function getTip(key) {
    return TIPS[key] || '';
  }

  function iconHtml(key) {
    var tip = getTip(key);
    if (!tip) return '';
    return customIconHtml(tip, '');
  }

  function customIconHtml(text, title) {
    var tip = String(text || '').trim();
    if (!tip) return '';
    var heading = title ? String(title).trim() : '';
    return (
      '<span class="info-tip" tabindex="0" role="note" aria-label="' +
      escapeAttr(heading ? heading + ': ' + tip : tip) +
      '">' +
      '<span class="info-tip-icon" aria-hidden="true">i</span>' +
      '<span class="info-tip-popup">' +
      (heading
        ? '<span class="info-tip-popup-title">' + escapeHtml(heading) + '</span>'
        : '') +
      escapeHtml(tip) +
      '</span></span>'
    );
  }

  function label(text, key) {
    return String(text || '') + iconHtml(key);
  }

  function scan(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-info-tip]').forEach(function (el) {
      if (el.querySelector('.info-tip')) return;
      var key = el.getAttribute('data-info-tip');
      if (!key) return;
      el.insertAdjacentHTML('beforeend', iconHtml(key));
    });
  }

  window.InfoTip = {
    TIPS: TIPS,
    getTip: getTip,
    iconHtml: iconHtml,
    customIconHtml: customIconHtml,
    label: label,
    scan: scan,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scan(document);
    });
  } else {
    scan(document);
  }
})();
