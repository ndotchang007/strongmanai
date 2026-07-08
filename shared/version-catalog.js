(function () {
  var VERSIONS = [
    {
      slug: 'v1.1',
      eyebrow: 'Current release',
      title: 'Version 1.1',
      date: 'June 29, 2026',
      summary:
        'Settings split from User settings, a new guide for newcomers, experimental mode in Labs, and a cleaner app shell built around DM Sans.',
      highlights: [
        'Settings hub for app preferences only — theme, units, notifications, privacy, and Labs',
        'User settings under You — account details, sports, schedule, and training preferences',
        'Experimental mode toggle in Settings → Labs',
        'How-to guide at /info with setup steps and tips for using Rocky',
        'New-user coaching nudge on Home when you have not logged a workout yet',
        'Version history page with patch notes (you are reading it)',
        'Typography unified on DM Sans across the in-app experience',
      ],
    },
    {
      slug: 'v0.1',
      eyebrow: 'Legacy',
      title: 'Version 0.1',
      date: '2025',
      summary:
        'First public web release — coach chat, workout logging, leaderboards, and athlete profile customization.',
      highlights: [
        'Home dashboard with stats and Rocky coaching callouts',
        'Log workouts with sets, reps, and progressive overload hints',
        'Coach (Rocky) chat and workout generation',
        'Rank leaderboards and public profile showcase',
        'Athlete customization — sports, practice nights, and session caps',
        'Onboarding flow for new accounts',
      ],
    },
  ];

  function list() {
    return VERSIONS.slice();
  }

  function get(slug) {
    if (!slug) return null;
    var key = String(slug).toLowerCase();
    for (var i = 0; i < VERSIONS.length; i++) {
      if (VERSIONS[i].slug === key) return VERSIONS[i];
    }
    return null;
  }

  window.VERSION_CATALOG = {
    list: list,
    get: get,
    current: 'v1.1',
  };
})();
