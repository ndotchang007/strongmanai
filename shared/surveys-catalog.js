/**
 * Survey metadata and question schemas for the public surveys gallery.
 */
(function (global) {
  var SURVEYS = {
    feedback: {
      slug: 'feedback',
      title: 'Feedback',
      date: 'June 14, 2026',
      summary:
        'Tell us what is working and what is not. Your responses help us prioritize fixes, improve Rocky\'s coaching quality, and ship updates athletes actually need.',
      eyebrow: 'Product quality',
      questions: [
        {
          id: 'overall',
          label: 'How satisfied are you with Strongman AI so far?',
          type: 'select',
          required: true,
          options: ['Very satisfied', 'Somewhat satisfied', 'Neutral', 'Somewhat dissatisfied', 'Very dissatisfied'],
        },
        {
          id: 'highlights',
          label: 'What do you like most about the platform?',
          type: 'textarea',
          required: false,
          placeholder: 'Features, workflows, or moments that stood out…',
        },
        {
          id: 'improvements',
          label: 'What should we improve first?',
          type: 'textarea',
          required: true,
          placeholder: 'Bugs, missing features, confusing flows…',
        },
        {
          id: 'recommend',
          label: 'How likely are you to recommend Strongman AI to another athlete?',
          type: 'select',
          required: true,
          options: ['10 — Definitely', '7–9', '4–6', '1–3', '0 — Not at all'],
        },
      ],
    },
    exercises: {
      slug: 'exercises',
      title: 'Add a new exercise',
      date: 'July 6, 2026',
      summary:
        'Missing a lift or event from our exercise database? Tell us the name, category, and any common aliases so we can add it for leaderboards and workout logging.',
      eyebrow: 'Exercise database',
      questions: [
        {
          id: 'exercise_name',
          label: 'Exercise name',
          type: 'text',
          required: true,
          placeholder: 'e.g. Zercher squat, axle deadlift…',
        },
        {
          id: 'category',
          label: 'What type of movement is it?',
          type: 'select',
          required: true,
          options: [
            'Strongman event',
            'Press',
            'Squat or deadlift',
            'Carry or load',
            'Accessory',
            'Not sure',
          ],
        },
        {
          id: 'aliases',
          label: 'Common aliases or abbreviations (optional)',
          type: 'text',
          required: false,
          placeholder: 'e.g. zercher, z squat',
        },
        {
          id: 'notes',
          label: 'Anything else we should know?',
          type: 'textarea',
          required: false,
          placeholder: 'Equipment, competition context, or why athletes log this…',
        },
      ],
    },
    wants: {
      slug: 'wants',
      title: 'What do you want from us?',
      date: 'May 28, 2026',
      summary:
        'Share the features, tools, and integrations you wish Strongman AI had. This directly shapes our product roadmap and tells us where to invest engineering time.',
      eyebrow: 'Roadmap input',
      questions: [
        {
          id: 'missing',
          label: 'What is the one thing you wish Strongman AI did today?',
          type: 'textarea',
          required: true,
          placeholder: 'Be as specific as you can — sport, workflow, or outcome…',
        },
        {
          id: 'priority',
          label: 'Which area matters most to you right now?',
          type: 'select',
          required: true,
          options: [
            'Smarter AI workout generation',
            'Better tracking & analytics',
            'Leaderboards & competition',
            'Mobile experience',
            'Integrations (Strava, Apple Health, etc.)',
            'Something else',
          ],
        },
        {
          id: 'integrations',
          label: 'Any apps or tools you want us to connect with?',
          type: 'text',
          required: false,
          placeholder: 'Optional — e.g. Whoop, Garmin, Google Sheets…',
        },
        {
          id: 'willingness',
          label: 'Would you try an early preview of a feature you suggested?',
          type: 'select',
          required: true,
          options: ['Yes — sign me up', 'Maybe — depends on the feature', 'No thanks'],
        },
      ],
    },
  };

  function getSurvey(slug) {
    if (!slug) return null;
    return SURVEYS[slug] || null;
  }

  function listSurveys() {
    return Object.keys(SURVEYS).map(function (key) {
      return SURVEYS[key];
    });
  }

  global.SURVEYS_CATALOG = {
    get: getSurvey,
    list: listSurveys,
  };
})(typeof window !== 'undefined' ? window : globalThis);
