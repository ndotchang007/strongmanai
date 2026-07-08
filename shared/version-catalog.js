(function () {
  var VERSIONS = [
    {
      slug: 'v1.1',
      eyebrow: 'Current release',
      title: 'Version 1.1',
      date: 'June 29, 2026',
      summary:
        'Settings split from User settings, a new guide for newcomers, experimental mode in Labs, and a cleaner app shell built around DM Sans.',
      majorFeatures: [
        'Settings hub for app preferences only — theme, units, notifications, privacy, and Labs',
        'User settings under You — account details, sports, schedule, and training preferences',
        'Experimental mode toggle in Settings → Labs',
        'How-to guide at /info with setup steps and tips for using Rocky',
        'Version history page with patch notes and a catch-up flow for returning athletes',
        'Surveys hub for feedback, exercise requests, and roadmap input',
        'Typography unified on DM Sans across the in-app experience',
      ],
      minorFixes: [
        'Leaderboard exercise validation with suggestions when a movement is not in the database',
        'Public page header (Surveys, Versions) now renders correctly on mobile',
        'Profile avatar sync across sidebar and bottom navigation',
        'Rocky setup alerts when sports or schedule are missing',
      ],
      minorChanges: [
        'New-user coaching nudge on Home when you have not logged a workout yet',
        'Footer links reorganized with version history and company sections',
        'Report issue shortcut in the public site header',
        'Leaderboard weights display in your preferred units (lb or kg)',
      ],
    },
    {
      slug: 'v0.1',
      eyebrow: 'Legacy',
      title: 'Version 0.1',
      date: '2025',
      summary:
        'First public web release — coach chat, workout logging, leaderboards, and athlete profile customization.',
      majorFeatures: [
        'Home dashboard with stats and Rocky coaching callouts',
        'Log workouts with sets, reps, and progressive overload hints',
        'Coach (Rocky) chat and workout generation',
        'Rank leaderboards and public profile showcase',
        'Athlete customization — sports, practice nights, and session caps',
        'Onboarding flow for new accounts',
      ],
      minorFixes: [
        'Session persistence across login on the same device',
        'Workout log draft recovery in local storage',
      ],
      minorChanges: [
        'Public leaderboards viewable without signing in',
        'Email verification for new sign-ups',
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
