(function () {
  var CATEGORIES = [
    { id: 'all', label: 'All sports' },
    { id: 'court_racket', label: 'Court & racket' },
    { id: 'team_field', label: 'Team field' },
    { id: 'team_court', label: 'Team court' },
    { id: 'mat_combat', label: 'Mat & combat' },
    { id: 'track', label: 'Track & field' },
    { id: 'aquatics', label: 'Aquatics' },
    { id: 'other', label: 'Other' },
  ];

  function sport(
    id,
    name,
    category,
    opts
  ) {
    opts = opts || {};
    return {
      id: id,
      name: name,
      category: category,
      aliases: opts.aliases || [],
      positionLabel: opts.positionLabel || 'Position / event',
      scheduleLabels: Object.assign(
        { practice: 'Practice', competition: 'Game' },
        opts.scheduleLabels || {}
      ),
      liftingFocus: opts.liftingFocus || '',
      inSeasonTip: opts.inSeasonTip || '',
      gameDayTip: opts.gameDayTip || '',
      offSeasonTip: opts.offSeasonTip || '',
      commonMuscles: opts.commonMuscles || [],
      avoidBeforeCompetition: opts.avoidBeforeCompetition || '',
    };
  }

  var CATALOG = [
    sport('badminton', 'Badminton', 'court_racket', {
      aliases: ['shuttle', 'shuttlecock'],
      positionLabel: 'Event / singles-doubles',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus:
        'Explosive legs and shoulder stability for jumps and overhead clears. Prioritize unilateral leg work and rotator cuff health.',
      inSeasonTip: 'Keep gym sessions short on match weeks — power and mobility over heavy grinding.',
      gameDayTip: 'Light activation only; skip heavy lower body 24–48h before matches.',
      offSeasonTip: 'Build leg strength and core for court coverage and smash power.',
      commonMuscles: ['quads', 'glutes', 'shoulders', 'core'],
      avoidBeforeCompetition: 'heavy squats or max deadlifts',
    }),
    sport('tennis', 'Tennis', 'court_racket', {
      aliases: ['varsity tennis'],
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Rotational power, shoulder durability, and lateral leg strength for court movement.',
      inSeasonTip: 'Emphasize elastic strength and prehab for shoulders and elbows.',
      gameDayTip: 'Mobility and band work; avoid sore legs before match day.',
      offSeasonTip: 'Build base strength with split squats, rows, and anti-rotation core work.',
      commonMuscles: ['shoulders', 'forearms', 'glutes', 'core'],
      avoidBeforeCompetition: 'heavy overhead pressing to failure',
    }),
    sport('volleyball', 'Volleyball', 'team_court', {
      aliases: ['vb'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Vertical jump power, landing mechanics, and shoulder stability for hitters and blockers.',
      inSeasonTip: 'Low-volume plyos and strength maintenance during tournament weeks.',
      gameDayTip: 'Activation jumps and mobility — no heavy leg day before matches.',
      offSeasonTip: 'Squat/hinge patterns and jump training for vertical gains.',
      commonMuscles: ['quads', 'glutes', 'shoulders', 'calves'],
      avoidBeforeCompetition: 'high-volume jumping after heavy squats',
    }),
    sport('basketball', 'Basketball', 'team_court', {
      aliases: ['hoops', 'bb'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Explosive legs, deceleration strength, and upper-body pushing for contact and rebounds.',
      inSeasonTip: 'Two short lifts per week max during heavy game schedules.',
      gameDayTip: 'Light upper or recovery only on game days.',
      offSeasonTip: 'Build strength in squats, RDLs, and single-leg work for jump and change-of-direction.',
      commonMuscles: ['quads', 'glutes', 'calves', 'chest'],
      avoidBeforeCompetition: 'heavy legs the day before games',
    }),
    sport('soccer', 'Soccer', 'team_field', {
      aliases: ['football international', 'futbol'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Single-leg strength, hamstring durability, and core for sprinting and cutting.',
      inSeasonTip: 'Prioritize hamstring and hip work; keep volume moderate mid-season.',
      gameDayTip: 'Recovery focus — foam roll, light band work, no heavy lifting.',
      offSeasonTip: 'Build max strength in split squats, RDLs, and Nordic progressions.',
      commonMuscles: ['hamstrings', 'quads', 'glutes', 'core'],
      avoidBeforeCompetition: 'heavy eccentric leg work before matches',
    }),
    sport('football', 'Football', 'team_field', {
      aliases: ['american football'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Position-specific: linemen need mass and power; skill players need speed and relative strength.',
      inSeasonTip: 'Maintain strength with low reps; manage contact fatigue.',
      gameDayTip: 'No heavy lower body within 48h of game day for most positions.',
      offSeasonTip: 'Hypertrophy and max-strength blocks by position needs.',
      commonMuscles: ['quads', 'glutes', 'chest', 'traps'],
      avoidBeforeCompetition: 'max-effort squats before Friday games',
    }),
    sport('baseball', 'Baseball', 'team_field', {
      aliases: ['varsity baseball'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Rotational power, shoulder/elbow health, and leg drive for throwing and hitting.',
      inSeasonTip: 'Keep arm-care and hip mobility consistent; limit heavy overhead work.',
      gameDayTip: 'Band work and mobility; skip heavy pull days before pitching.',
      offSeasonTip: 'Build lower-body power and scapular stability in the weight room.',
      commonMuscles: ['hips', 'core', 'shoulders', 'forearms'],
      avoidBeforeCompetition: 'heavy throwing after max deadlift day',
    }),
    sport('softball', 'Softball', 'team_field', {
      aliases: ['fastpitch', 'slowpitch'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Rotational power, shoulder health, and leg drive for hitting and throwing.',
      inSeasonTip: 'Arm-care and hip mobility weekly; moderate gym volume.',
      gameDayTip: 'Activation and band work before games.',
      offSeasonTip: 'Lower-body power and core rotation for bat speed.',
      commonMuscles: ['hips', 'core', 'shoulders', 'glutes'],
      avoidBeforeCompetition: 'heavy rotation work before games',
    }),
    sport('lacrosse', 'Lacrosse', 'team_field', {
      positionLabel: 'Position',
      liftingFocus: 'Speed, shoulder durability, and leg power for sprinting and checks.',
      inSeasonTip: 'Short strength sessions; emphasize stick-side core and hips.',
      gameDayTip: 'Light activation; protect shoulders before games.',
      offSeasonTip: 'Build athletic base with squats, pulls, and rotational work.',
      commonMuscles: ['shoulders', 'quads', 'hips', 'core'],
      avoidBeforeCompetition: 'heavy upper volume before games',
    }),
    sport('field_hockey', 'Field hockey', 'team_field', {
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Single-leg endurance, hip mobility, and core for low stances and sprinting.',
      inSeasonTip: 'Hamstring and groin prehab during season.',
      gameDayTip: 'Mobility and light band work on match days.',
      offSeasonTip: 'Single-leg strength and conditioning base.',
      commonMuscles: ['glutes', 'hamstrings', 'adductors', 'core'],
      avoidBeforeCompetition: 'heavy groin-loading before matches',
    }),
    sport('wrestling', 'Wrestling', 'mat_combat', {
      positionLabel: 'Weight class',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Relative strength, neck and grip work, and explosive hips without excessive bulk.',
      inSeasonTip: 'Manage weight class while maintaining strength — short focused sessions.',
      gameDayTip: 'Technique and activation only near weigh-ins and matches.',
      offSeasonTip: 'Build strength base with compound lifts and sport-specific carries.',
      commonMuscles: ['hips', 'grip', 'neck', 'core'],
      avoidBeforeCompetition: 'depleting cuts or max lifts before weigh-in',
    }),
    sport('track_sprints', 'Track — sprints / hurdles', 'track', {
      aliases: ['sprinting', 'hurdles', '100m', '200m'],
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Posterior chain power, reactive strength, and hamstring resilience.',
      inSeasonTip: 'Low-volume strength during meet weeks; prioritize speed work recovery.',
      gameDayTip: 'Meet day is competition — no gym unless coach prescribes activation.',
      offSeasonTip: 'Olympic lift variations, RDLs, and single-leg work for acceleration.',
      commonMuscles: ['hamstrings', 'glutes', 'calves', 'core'],
      avoidBeforeCompetition: 'heavy squats 2–3 days before meets',
    }),
    sport('track_distance', 'Track — distance', 'track', {
      aliases: ['800m', '1600m', '5k', '3200m'],
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Single-leg stability, calf/Achilles durability, and core — low bulk.',
      inSeasonTip: 'Strength 1–2×/week max; never compromise run quality.',
      gameDayTip: 'Rest and fuel for meets; light core only if needed.',
      offSeasonTip: 'General strength and mobility for injury prevention.',
      commonMuscles: ['calves', 'hips', 'core', 'glutes'],
      avoidBeforeCompetition: 'DOMS-heavy leg sessions before races',
    }),
    sport('cross_country', 'Cross country', 'track', {
      aliases: ['xc', 'cross-country'],
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Single-leg endurance, hip stability, and tendon durability.',
      inSeasonTip: 'Light strength only; prioritize run volume and recovery.',
      gameDayTip: 'Rest and fuel for meets.',
      offSeasonTip: 'General strength and mobility base.',
      commonMuscles: ['calves', 'hips', 'core', 'glutes'],
      avoidBeforeCompetition: 'heavy leg sessions before races',
    }),
    sport('track_throws', 'Track — throws', 'track', {
      aliases: ['shot put', 'discus', 'javelin', 'hammer throw'],
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Explosive power, hip drive, and rotational strength.',
      inSeasonTip: 'Maintain power with low reps; protect shoulders and elbows.',
      gameDayTip: 'Activation throws and mobility on meet days.',
      offSeasonTip: 'Olympic variations, squats, and presses for power.',
      commonMuscles: ['hips', 'core', 'shoulders', 'glutes'],
      avoidBeforeCompetition: 'max lifts 3 days before meets',
    }),
    sport('track_jumps', 'Track — jumps', 'track', {
      aliases: ['long jump', 'high jump', 'triple jump', 'pole vault'],
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Reactive leg strength, sprint mechanics, and core stiffness.',
      inSeasonTip: 'Low-volume plyos during meet weeks.',
      gameDayTip: 'Jump-specific warm-up; no heavy gym on meet days.',
      offSeasonTip: 'Squats, RDLs, and jump training for approach power.',
      commonMuscles: ['quads', 'glutes', 'calves', 'core'],
      avoidBeforeCompetition: 'heavy squats before meets',
    }),
    sport('swimming', 'Swimming', 'aquatics', {
      aliases: ['swim', 'swim team'],
      positionLabel: 'Stroke / event',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Lat and shoulder strength, core stability, and leg drive for starts and turns.',
      inSeasonTip: 'Shoulder prehab every week; moderate pulling volume.',
      gameDayTip: 'Activation and mobility before meets.',
      offSeasonTip: 'Pull-ups, rows, and anti-extension core for stroke power.',
      commonMuscles: ['lats', 'shoulders', 'core', 'glutes'],
      avoidBeforeCompetition: 'failure sets on pull-ups before meets',
    }),
    sport('water_polo', 'Water polo', 'aquatics', {
      aliases: ['polo', 'wp'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Leg treading power, shoulder endurance, and core for grappling and shooting.',
      inSeasonTip: 'Shoulder and hip prehab; keep gym sessions short in tournament weeks.',
      gameDayTip: 'Mobility and light activation; avoid heavy legs before games.',
      offSeasonTip: 'Squats, rows, and rotational core for pool power.',
      commonMuscles: ['shoulders', 'quads', 'core', 'lats'],
      avoidBeforeCompetition: 'heavy leg day before games',
    }),
    sport('diving', 'Diving', 'aquatics', {
      positionLabel: 'Event / board',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Explosive legs, ankle stiffness, and core control for takeoffs.',
      inSeasonTip: 'Protect wrists and shoulders; low-volume plyos in season.',
      gameDayTip: 'Skill and activation only on meet days.',
      offSeasonTip: 'Jump training and single-leg strength for board work.',
      commonMuscles: ['quads', 'calves', 'core', 'shoulders'],
      avoidBeforeCompetition: 'new max jumps before meets',
    }),
    sport('gymnastics', 'Gymnastics', 'other', {
      positionLabel: 'Apparatus focus',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Relative strength, wrist/elbow care, and core — avoid excessive hypertrophy.',
      inSeasonTip: 'Short supplemental strength; prioritize joint health.',
      gameDayTip: 'Meet prep is skill-based; no heavy lifting on meet days.',
      offSeasonTip: 'Bodyweight progressions and light loading for power.',
      commonMuscles: ['core', 'shoulders', 'grip', 'glutes'],
      avoidBeforeCompetition: 'heavy barbell work before meets',
    }),
    sport('cheer', 'Cheer / stunt', 'other', {
      aliases: ['cheerleading', 'stunt'],
      positionLabel: 'Role',
      scheduleLabels: { practice: 'Practice', competition: 'Competition' },
      liftingFocus: 'Explosive legs for tumbling, shoulder stability for stunting, and core bracing.',
      inSeasonTip: 'Land mechanics and ankle/knee prehab during competition season.',
      gameDayTip: 'Dynamic warm-up focus; no heavy lifting before performances.',
      offSeasonTip: 'Jump training and upper-body endurance for stunting.',
      commonMuscles: ['legs', 'shoulders', 'core', 'calves'],
      avoidBeforeCompetition: 'new max jumps after heavy leg day',
    }),
    sport('hockey', 'Ice hockey', 'team_court', {
      aliases: ['hockey'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Hip power, groin/adductor strength, and anaerobic leg capacity.',
      inSeasonTip: 'Maintain strength with brief sessions between ice time.',
      gameDayTip: 'Recovery and mobility on game days.',
      offSeasonTip: 'Squats, RDLs, and lateral lunges for stride power.',
      commonMuscles: ['glutes', 'adductors', 'quads', 'core'],
      avoidBeforeCompetition: 'heavy legs before game day',
    }),
    sport('golf', 'Golf', 'other', {
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Tournament' },
      liftingFocus: 'Rotational power, hip mobility, and thoracic spine for swing speed.',
      inSeasonTip: 'Mobility and anti-rotation core during tournament weeks.',
      gameDayTip: 'Warm-up and mobility; skip heavy rotation work before rounds.',
      offSeasonTip: 'Build hip and core strength for club head speed.',
      commonMuscles: ['hips', 'core', 'forearms', 'glutes'],
      avoidBeforeCompetition: 'heavy rotational lifts before tournaments',
    }),
    sport('rowing', 'Rowing', 'aquatics', {
      aliases: ['crew'],
      positionLabel: 'Seat / side',
      scheduleLabels: { practice: 'Practice', competition: 'Regatta' },
      liftingFocus: 'Posterior chain endurance, leg drive, and lat strength for the stroke.',
      inSeasonTip: 'Manage lower-back fatigue; keep pulls submaximal in season.',
      gameDayTip: 'Rest and fuel for regattas.',
      offSeasonTip: 'Deadlifts, rows, and core for power per stroke.',
      commonMuscles: ['lats', 'glutes', 'hamstrings', 'core'],
      avoidBeforeCompetition: 'heavy deadlift days before regattas',
    }),
    sport('rugby', 'Rugby', 'team_field', {
      positionLabel: 'Position',
      liftingFocus: 'Mass, collision strength, and repeated sprint ability by forward vs back roles.',
      inSeasonTip: 'Maintain strength; manage contact soreness.',
      gameDayTip: 'No heavy lifting within 48h of matches.',
      offSeasonTip: 'Hypertrophy and max-strength blocks.',
      commonMuscles: ['quads', 'glutes', 'neck', 'core'],
      avoidBeforeCompetition: 'max lower-body before match day',
    }),
    sport('martial_arts', 'Martial arts', 'mat_combat', {
      aliases: ['karate', 'taekwondo', 'judo', 'bjj'],
      positionLabel: 'Discipline / weight',
      scheduleLabels: { practice: 'Training', competition: 'Bout' },
      liftingFocus: 'Explosive hips, grip, and conditioning without compromising weight class.',
      inSeasonTip: 'Skill-first; short strength for power maintenance.',
      gameDayTip: 'Activation only before bouts.',
      offSeasonTip: 'Power and general strength development.',
      commonMuscles: ['hips', 'core', 'grip', 'shoulders'],
      avoidBeforeCompetition: 'heavy sparring plus max lifts same week',
    }),
    sport('skiing', 'Skiing / snowboard', 'other', {
      aliases: ['alpine', 'snowboard'],
      positionLabel: 'Discipline',
      scheduleLabels: { practice: 'Training', competition: 'Race' },
      liftingFocus: 'Leg eccentric strength, core, and knee stability for mountain sports.',
      inSeasonTip: 'On-snow priority; gym is supplemental.',
      gameDayTip: 'On-hill prep; no heavy gym on race days.',
      offSeasonTip: 'Single-leg strength and quad/ham balance.',
      commonMuscles: ['quads', 'glutes', 'core', 'calves'],
      avoidBeforeCompetition: 'DOMS-heavy leg day before races',
    }),
    sport('cycling', 'Cycling', 'other', {
      aliases: ['bike', 'mtb'],
      positionLabel: 'Discipline',
      scheduleLabels: { practice: 'Training', competition: 'Race' },
      liftingFocus: 'Single-leg endurance and core; minimal upper bulk.',
      inSeasonTip: 'Strength 1×/week for bone and tendon health.',
      gameDayTip: 'Race day is on the bike — rest legs from gym.',
      offSeasonTip: 'General strength and hip stability.',
      commonMuscles: ['quads', 'glutes', 'core', 'calves'],
      avoidBeforeCompetition: 'heavy squats before key races',
    }),
    sport('cycling', 'Cycling', 'other', {
      aliases: ['bike', 'mtb', 'road cycling'],
      positionLabel: 'Discipline',
      scheduleLabels: { practice: 'Training', competition: 'Race' },
      liftingFocus: 'Single-leg endurance and core; minimal upper bulk.',
      inSeasonTip: 'Strength 1×/week for bone and tendon health.',
      gameDayTip: 'Race day is on the bike — rest legs from gym.',
      offSeasonTip: 'General strength and hip stability.',
      commonMuscles: ['quads', 'glutes', 'core', 'calves'],
      avoidBeforeCompetition: 'heavy squats before key races',
    }),
    sport('flag_football', 'Flag football', 'team_field', {
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Speed, change of direction, and upper-body pushing for flag pulls.',
      inSeasonTip: 'Short strength sessions; emphasize hamstring and ankle health.',
      gameDayTip: 'Light activation before games.',
      offSeasonTip: 'Sprint mechanics and relative strength.',
      commonMuscles: ['hamstrings', 'glutes', 'quads', 'core'],
      avoidBeforeCompetition: 'heavy legs before game day',
    }),
    sport('beach_volleyball', 'Beach volleyball', 'team_court', {
      aliases: ['sand volleyball'],
      positionLabel: 'Position',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Jump power, shoulder stability, and sand-specific leg endurance.',
      inSeasonTip: 'Low-volume jumping during tournaments.',
      gameDayTip: 'Activation and mobility before matches.',
      offSeasonTip: 'Squat patterns and jump training.',
      commonMuscles: ['quads', 'glutes', 'shoulders', 'calves'],
      avoidBeforeCompetition: 'high-volume jumps after heavy squats',
    }),
    sport('bowling', 'Bowling', 'other', {
      positionLabel: 'Event',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Core stability, wrist/forearm endurance, and lower-body balance.',
      inSeasonTip: 'Light strength for posture and balance.',
      gameDayTip: 'Mobility and warm-up before matches.',
      offSeasonTip: 'General strength and core work.',
      commonMuscles: ['core', 'forearms', 'hips', 'shoulders'],
      avoidBeforeCompetition: 'heavy grip work before matches',
    }),
    sport('competitive_dance', 'Competitive dance', 'other', {
      aliases: ['dance team', 'dance'],
      positionLabel: 'Style / role',
      scheduleLabels: { practice: 'Practice', competition: 'Competition' },
      liftingFocus: 'Leg endurance, ankle stability, and core for jumps and turns.',
      inSeasonTip: 'Joint-friendly strength; prioritize recovery during competition season.',
      gameDayTip: 'Dynamic warm-up focus before performances.',
      offSeasonTip: 'Single-leg strength and plyometric control.',
      commonMuscles: ['calves', 'quads', 'core', 'hips'],
      avoidBeforeCompetition: 'DOMS-heavy leg day before competitions',
    }),
    sport('fencing', 'Fencing', 'other', {
      aliases: ['epee', 'foil', 'sabre'],
      positionLabel: 'Weapon',
      scheduleLabels: { practice: 'Practice', competition: 'Bout' },
      liftingFocus: 'Leg lunge power, grip endurance, and fast-twitch legs.',
      inSeasonTip: 'Short strength sessions; protect knees and ankles.',
      gameDayTip: 'Activation only before bouts.',
      offSeasonTip: 'Lunges, rows, and calf work for explosive attacks.',
      commonMuscles: ['quads', 'calves', 'forearms', 'core'],
      avoidBeforeCompetition: 'heavy leg day before tournaments',
    }),
    sport('archery', 'Archery', 'other', {
      positionLabel: 'Division',
      scheduleLabels: { practice: 'Practice', competition: 'Tournament' },
      liftingFocus: 'Upper-back endurance, core stability, and shoulder health.',
      inSeasonTip: 'Postural strength and scapular control.',
      gameDayTip: 'Mobility and breathing before shooting.',
      offSeasonTip: 'Rows, face pulls, and anti-extension core.',
      commonMuscles: ['shoulders', 'upper back', 'core', 'forearms'],
      avoidBeforeCompetition: 'fatiguing shoulder work before tournaments',
    }),
    sport('rifle', 'Rifle / marksmanship', 'other', {
      aliases: ['air rifle', 'sport shooting'],
      positionLabel: 'Division',
      scheduleLabels: { practice: 'Practice', competition: 'Meet' },
      liftingFocus: 'Postural endurance, breathing control, and stable core.',
      inSeasonTip: 'Light strength for posture and focus.',
      gameDayTip: 'Rest and routine before meets.',
      offSeasonTip: 'General strength and mobility.',
      commonMuscles: ['core', 'shoulders', 'upper back'],
      avoidBeforeCompetition: 'heavy upper fatigue before meets',
    }),
    sport('esports', 'Esports', 'other', {
      aliases: ['gaming', 'video games'],
      positionLabel: 'Title / role',
      scheduleLabels: { practice: 'Practice', competition: 'Match' },
      liftingFocus: 'Posture, wrist/forearm health, and general fitness for long sessions.',
      inSeasonTip: 'Mobility breaks and light strength for health.',
      gameDayTip: 'Sleep and hydration over gym on match days.',
      offSeasonTip: 'General strength and cardio base.',
      commonMuscles: ['core', 'forearms', 'upper back'],
      avoidBeforeCompetition: 'grip exhaustion before matches',
    }),
    sport('weightlifting', 'Weightlifting / powerlifting', 'other', {
      aliases: ['powerlifting', 'olympic lifting', 'lifting'],
      positionLabel: 'Weight class',
      scheduleLabels: { practice: 'Training', competition: 'Meet' },
      liftingFocus: 'Sport-specific peaking for snatch, clean & jerk, squat, bench, or deadlift.',
      inSeasonTip: 'Follow meet prep blocks and manage fatigue.',
      gameDayTip: 'Meet day is competition — no extra gym.',
      offSeasonTip: 'Volume blocks and technique work in the competition lifts.',
      commonMuscles: ['quads', 'glutes', 'back', 'shoulders'],
      avoidBeforeCompetition: 'max attempts outside meet plan',
    }),
    sport('stunt', 'Stunt', 'other', {
      aliases: ['competitive stunt'],
      positionLabel: 'Role',
      scheduleLabels: { practice: 'Practice', competition: 'Competition' },
      liftingFocus: 'Explosive legs, shoulder stability, and core bracing for stunting.',
      inSeasonTip: 'Landing mechanics and joint prehab during season.',
      gameDayTip: 'Dynamic warm-up before performances.',
      offSeasonTip: 'Jump training and upper-body endurance.',
      commonMuscles: ['legs', 'shoulders', 'core', 'calves'],
      avoidBeforeCompetition: 'new max jumps before competitions',
    }),
    sport('adaptive_sports', 'Adaptive / unified sports', 'other', {
      aliases: ['unified sports', 'adaptive athletics'],
      positionLabel: 'Sport / event',
      scheduleLabels: { practice: 'Practice', competition: 'Game' },
      liftingFocus: 'Individualized strength for your sport and mobility needs.',
      inSeasonTip: 'Coach-guided loading with joint-friendly progressions.',
      gameDayTip: 'Follow team warm-up and recovery plans.',
      offSeasonTip: 'Build general strength and movement quality.',
      commonMuscles: ['core', 'legs', 'shoulders'],
      avoidBeforeCompetition: 'anything outside your usual routine before events',
    }),
    sport('general_lifting', 'General lifting / no sport', 'other', {
      aliases: ['lifting only', 'gym', 'none', 'n/a'],
      positionLabel: 'Focus',
      scheduleLabels: { practice: 'Training', competition: 'Meet' },
      liftingFocus: 'Follow your primary goal — sport performance, aesthetics, max strength, or health.',
      inSeasonTip: 'Consistent progressive overload with adequate recovery.',
      gameDayTip: 'Deload or active recovery on rest days.',
      offSeasonTip: 'Build volume and technique in main lifts.',
      commonMuscles: [],
      avoidBeforeCompetition: '',
    }),
  ];

  var byId = {};
  CATALOG.forEach(function (s) {
    byId[s.id] = s;
  });

  function normalizeQuery(q) {
    return String(q || '')
      .trim()
      .toLowerCase();
  }

  function search(query, limit) {
    var q = normalizeQuery(query);
    limit = limit || 12;
    if (!q) return CATALOG.slice(0, limit);
    var scored = [];
    CATALOG.forEach(function (s) {
      var score = 0;
      var name = s.name.toLowerCase();
      if (name === q) score = 100;
      else if (name.indexOf(q) === 0) score = 80;
      else if (name.indexOf(q) !== -1) score = 60;
      (s.aliases || []).forEach(function (a) {
        var al = a.toLowerCase();
        if (al === q) score = Math.max(score, 90);
        else if (al.indexOf(q) !== -1) score = Math.max(score, 50);
      });
      if (s.id.indexOf(q) !== -1) score = Math.max(score, 40);
      if (score > 0) scored.push({ sport: s, score: score });
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return scored.slice(0, limit).map(function (x) {
      return x.sport;
    });
  }

  function getById(id) {
    if (!id) return null;
    return byId[String(id).trim()] || null;
  }

  function resolveSport(input) {
    if (!input) return null;
    var s = String(input).trim();
    if (!s) return null;
    var exact = getById(s);
    if (exact) return exact;
    var lower = s.toLowerCase();
    for (var i = 0; i < CATALOG.length; i++) {
      var sp = CATALOG[i];
      if (sp.name.toLowerCase() === lower) return sp;
      if ((sp.aliases || []).some(function (a) {
        return a.toLowerCase() === lower;
      })) {
        return sp;
      }
    }
    var results = search(s, 1);
    if (results.length && results[0].name.toLowerCase() === lower) return results[0];
    return null;
  }

  function competitionLabel(sportObj, plural) {
    if (!sportObj || !sportObj.scheduleLabels) return plural ? 'Games' : 'Game';
    var c = sportObj.scheduleLabels.competition || 'Game';
    return c;
  }

  function tipForSeason(sportObj, seasonPhase) {
    if (!sportObj) return '';
    if (seasonPhase === 'off_season') return sportObj.offSeasonTip || sportObj.liftingFocus;
    if (seasonPhase === 'pre_season') return sportObj.inSeasonTip || sportObj.liftingFocus;
    return sportObj.inSeasonTip || sportObj.liftingFocus;
  }

  function buildAiSportBlock(sportObj) {
    if (!sportObj) return '';
    var lines = ['Sport profile: ' + sportObj.name];
    if (sportObj.liftingFocus) lines.push('Lifting focus: ' + sportObj.liftingFocus);
    if (sportObj.commonMuscles && sportObj.commonMuscles.length) {
      lines.push('Key areas: ' + sportObj.commonMuscles.join(', '));
    }
    if (sportObj.avoidBeforeCompetition) {
      lines.push('Avoid before competition: ' + sportObj.avoidBeforeCompetition);
    }
    return lines.join('\n');
  }

  function listAllNames(opts) {
    opts = opts || {};
    var list = CATALOG.slice();
    if (opts.excludeGeneral) {
      list = list.filter(function (s) {
        return s.id !== 'general_lifting';
      });
    }
    return list
      .map(function (s) {
        return s.name;
      })
      .sort(function (a, b) {
        return a.localeCompare(b);
      });
  }

  window.SportDatabase = {
    CATALOG: CATALOG,
    CATEGORIES: CATEGORIES,
    search: search,
    getById: getById,
    resolveSport: resolveSport,
    listAllNames: listAllNames,
    competitionLabel: competitionLabel,
    tipForSeason: tipForSeason,
    buildAiSportBlock: buildAiSportBlock,
  };
})();
