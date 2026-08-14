(function () {
  var VERSIONS = [
    {
      slug: 'v1.3',
      eyebrow: 'Current release',
      title: 'Version 1.3',
      date: 'August 14, 2026',
      summary:
        'A sharper public site and a cleaner in-app settings experience — progressive-overload docs, a trustworthy download page, modernized Settings, and marketing polish across About, footers, and the landing phone mockup.',
      majorFeatures: [
        'Full progressive-overload algorithm article on the blog — diagrams, formulas, decision trees, and end-to-end ProgressionEngine detail',
        'Dedicated /download page with official branding, safety copy, and honest web-first CTAs (no shady install overlays)',
        'Modernized Settings hub — theme tokens, card sections, switch-style toggles, smoother open motion, and a mobile bottom sheet',
        'Expanded About page plus richer multi-column footers with About, Blog, Legal, Leaderboards, Instagram (@strongmanai), and contact',
        'Landing phone mockup screenshot correctly fills the iPhone frame (aligned screen insets and framing)',
      ],
      minorFixes: [
        'Phone screen insets match the transparent display hole in the device frame so the tab bar isn’t cropped',
        'Settings theme picker no longer applies conflicting pill styles when theme cards are mounted',
      ],
      minorChanges: [
        'Roomier login card with breathing room between sign-in and sign-up panels during the slide transition',
        'Landing Download CTAs (nav, hero, CTA, footer) all route to /download',
        'Removed the floating Start workout button from the bottom of the Home dashboard',
        'App version bumped to v1.3 across Settings, Info, Download, and patch-note links',
      ],
    },
    {
      slug: 'v1.2',
      eyebrow: 'Previous release',
      title: 'Version 1.2',
      date: 'July 10, 2026',
      summary:
        'Beginner-friendly coaching from day one — a learn-to-work-out guide, simpler workout mode, experience-aware Rocky plans, and a richer post-workout summary.',
      majorFeatures: [
        'Beginner guide at /learn with gym basics, starter machine exercises, and form cues',
        'Rocky Home callout for beginners: “New to working out? Learn here”',
        'Experience-aware Rocky workouts — beginners get machines/cables and form tips, not advanced free-weight lifts',
        'Workout mode simplified: time since last set instead of a rest timer, plus Apply routine',
        'In-workout Rocky mini chat for quick form cues and mid-session advice',
        'Post-workout dashboard with volume-over-time charts and a Rocky generating animation',
      ],
      minorFixes: [
        'Session duration is captured correctly when finishing workout mode',
        'Legacy rest-timer overlay is replaced cleanly when opening the new workout mode UI',
      ],
      minorChanges: [
        'Removed the Auto-save rest time setting (time since last set is saved automatically)',
        'Beginner Coach chips for full-body machine sessions and form tips',
        'Softer Rocky intensity callouts when experience is Beginner',
        'Home quick link for the beginner guide',
      ],
    },
    {
      slug: 'v1.1',
      eyebrow: 'Previous release',
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
    current: 'v1.3',
  };
})();
