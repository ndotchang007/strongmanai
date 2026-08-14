(function () {
  var WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var PROGRAM_LABELS = { school: 'School', club: 'Club', other: 'Other' };

  var GOAL_LABELS = {
    sport_performance: 'Sport performance',
    sports: 'Sport performance',
    aesthetics: 'Physique / aesthetics',
    strength: 'Max strength',
    general_health: 'General health',
    health: 'General health',
  };

  var SEASON_LABELS = {
    pre_season: 'Pre-season',
    in_season: 'In-season',
    off_season: 'Off-season',
  };

  var EXPERIENCE_LABELS = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  var EQUIPMENT_LABELS = {
    local: 'Full gym',
    home: 'Home gym',
    none: 'Minimal equipment',
  };

  function defaultContext() {
    return {
      sport: null,
      sportId: null,
      position: null,
      gradeLevel: null,
      seasonPhase: 'in_season',
      primaryGoal: 'sport_performance',
      secondaryGoals: [],
      schoolDays: [1, 2, 3, 4, 5],
      practiceDays: [],
      gameDays: [],
      sports: [],
      schoolNightMaxMinutes: 45,
      weekendMaxMinutes: 90,
      notes: null,
      knownNotes: null,
      homeGym: null,
    };
  }

  function newSportKey() {
    return 'sport_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function defaultSport(partial) {
    return Object.assign(
      {
        key: newSportKey(),
        sport: '',
        sportId: null,
        position: null,
        programType: 'school',
        seasonPhase: null,
        practiceDays: [],
        gameDays: [],
        skipPracticeDays: [],
        equipmentAccess: null,
        seasonStartDate: null,
        seasonEndDate: null,
        nextEventDate: null,
        nextEventLabel: null,
        isPrimary: false,
      },
      partial || {}
    );
  }

  function reasonToPrimaryGoal(reason) {
    if (!reason) return 'sport_performance';
    if (reason === 'sports') return 'sport_performance';
    if (reason === 'health') return 'general_health';
    if (reason === 'aesthetics') return 'aesthetics';
    if (reason === 'strength') return 'strength';
    return reason;
  }

  function isSportFocusedGoal(ctx) {
    if (!ctx) return true;
    var goal = ctx.primaryGoal;
    if (!goal && ctx.reason) goal = reasonToPrimaryGoal(ctx.reason);
    return !goal || goal === 'sport_performance' || goal === 'sports';
  }

  function primaryGoalToReason(goal) {
    if (goal === 'general_health') return 'health';
    if (goal === 'sport_performance') return 'sports';
    if (goal === 'aesthetics') return 'aesthetics';
    if (goal === 'strength') return 'strength';
    return 'sports';
  }

  function getSports(ctx) {
    if (!ctx) return [];
    if (Array.isArray(ctx.sports) && ctx.sports.length) {
      return ctx.sports.slice();
    }
    if (ctx.sport) {
      return [
        {
          key: 'legacy_primary',
          sport: ctx.sport,
          sportId: ctx.sportId || null,
          position: ctx.position || null,
          programType: 'school',
          seasonPhase: ctx.seasonPhase || 'in_season',
          practiceDays: ctx.practiceDays || [],
          gameDays: ctx.gameDays || [],
          seasonStartDate: null,
          seasonEndDate: null,
          nextEventDate: null,
          nextEventLabel: null,
          isPrimary: true,
        },
      ];
    }
    return [];
  }

  function getPrimarySport(ctx) {
    var sports = getSports(ctx);
    if (!sports.length) return null;
    return sports.find(function (s) {
      return s.isPrimary;
    }) || sports[0];
  }

  function getSportRecordForEntry(entry) {
    if (!entry) return null;
    var SD = window.SportDatabase;
    if (!SD) return null;
    if (entry.sportId) {
      var byId = SD.getById(entry.sportId);
      if (byId) return byId;
    }
    if (entry.sport) return SD.resolveSport(entry.sport);
    return null;
  }

  function getSportRecord(ctx) {
    return getSportRecordForEntry(getPrimarySport(ctx));
  }

  function competitionLabelForEntry(entry) {
    var sp = getSportRecordForEntry(entry);
    if (sp && sp.scheduleLabels && sp.scheduleLabels.competition) {
      return sp.scheduleLabels.competition;
    }
    return 'Game';
  }

  function competitionLabel(ctx) {
    return competitionLabelForEntry(getPrimarySport(ctx));
  }

  function loadAthleteContext(user) {
    var base = defaultContext();
    if (!user) return base;
    var fromDb =
      user.athleteContext && typeof user.athleteContext === 'object'
        ? user.athleteContext
        : {};
    var merged = Object.assign({}, base, fromDb);
    merged.sports = getSports(merged);
    var primary = getPrimarySport(merged);
    if (primary) {
      merged.sport = primary.sport;
      merged.sportId = primary.sportId;
      merged.position = primary.position;
      merged.seasonPhase = resolveSeasonPhase(primary);
      merged.practiceDays = primary.practiceDays || [];
      merged.gameDays = primary.gameDays || [];
    }
    if (!merged.primaryGoal && user.reason) {
      merged.primaryGoal = reasonToPrimaryGoal(user.reason);
    }
    return merged;
  }

  function isWeekend(d) {
    var day = d.getDay();
    return day === 0 || day === 6;
  }

  function todayWeekday() {
    return new Date().getDay();
  }

  function hasWeekdayIn(list, weekday) {
    if (!Array.isArray(list)) return false;
    return list.some(function (item) {
      if (item == null) return false;
      if (typeof item === 'number') return item === weekday;
      if (typeof item === 'object' && item.weekday != null) {
        return Number(item.weekday) === weekday;
      }
      return false;
    });
  }

  function formatWeekdays(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list
      .map(function (p) {
        return WEEKDAY_SHORT[p.weekday] || '';
      })
      .filter(Boolean)
      .join(' / ');
  }

  function parseIsoDate(str) {
    if (!str || typeof str !== 'string') return null;
    var parts = str.split('-');
    if (parts.length !== 3) return null;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysUntilDate(dateStr) {
    var target = parseIsoDate(dateStr);
    if (!target) return null;
    var today = startOfDay(new Date());
    var diff = Math.round((startOfDay(target).getTime() - today.getTime()) / 86400000);
    return diff;
  }

  /** Derive season phase from calendar dates when set; otherwise use stored phase. */
  function resolveSeasonPhase(entry) {
    if (!entry) return null;
    var start = entry.seasonStartDate ? parseIsoDate(entry.seasonStartDate) : null;
    var end = entry.seasonEndDate ? parseIsoDate(entry.seasonEndDate) : null;
    if (!start && !end) {
      return entry.seasonPhase || null;
    }
    var today = startOfDay(new Date());
    if (start && end && startOfDay(start).getTime() > startOfDay(end).getTime()) {
      return entry.seasonPhase || null;
    }
    if (start && today.getTime() < startOfDay(start).getTime()) {
      return 'off_season';
    }
    if (end && today.getTime() > startOfDay(end).getTime()) {
      return 'off_season';
    }
    return 'in_season';
  }

  function formatCountdownLabel(days) {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days > 1) return days + ' days';
    if (days === -1) return 'Yesterday';
    return Math.abs(days) + ' days ago';
  }

  function getUpcomingCountdowns(user, limit) {
    limit = limit == null ? 3 : limit;
    var ctx = loadAthleteContext(user);
    var sports = getSports(ctx);
    var items = [];
    sports.forEach(function (entry) {
      if (entry.seasonStartDate) {
        var d = daysUntilDate(entry.seasonStartDate);
        if (d != null && d >= 0 && d <= 120) {
          items.push({
            kind: 'season_start',
            sport: entry.sport,
            label: 'Season starts',
            days: d,
            countdown: formatCountdownLabel(d),
            date: entry.seasonStartDate,
          });
        }
      }
      if (entry.nextEventDate) {
        var ed = daysUntilDate(entry.nextEventDate);
        if (ed != null && ed >= 0 && ed <= 60) {
          items.push({
            kind: 'event',
            sport: entry.sport,
            label: entry.nextEventLabel || competitionLabelForEntry(entry),
            days: ed,
            countdown: formatCountdownLabel(ed),
            date: entry.nextEventDate,
          });
        }
      }
    });
    items.sort(function (a, b) {
      return a.days - b.days;
    });
    return items.slice(0, limit);
  }

  function isPlaceholderSchedule(entry) {
    if (!entry) return true;
    var practice = entry.practiceDays || [];
    var games = entry.gameDays || [];
    if (games.length > 0) return false;
    if (practice.length !== 1) return false;
    var p = practice[0];
    var weekday = typeof p === 'number' ? p : p && p.weekday;
    return Number(weekday) === 1 && !(p && p.start);
  }

  function needsScheduleSetup(user) {
    if (!user) return true;
    var ctx = loadAthleteContext(user);
    if (!isSportFocusedGoal(ctx)) return false;
    var sports = getSports(ctx);
    if (!sports.length) return true;
    return sports.some(function (entry) {
      return isPlaceholderSchedule(entry) || getSportSetupIssues(entry).length > 0;
    });
  }
  function getTodayTrainingHint(user) {
    var ctx = loadAthleteContext(user);
    var sports = getSports(ctx);
    var wd = todayWeekday();
    var weekend = isWeekend(new Date());
    var maxMin = weekend ? ctx.weekendMaxMinutes || 90 : ctx.schoolNightMaxMinutes || 45;

    var gameSports = [];
    var practiceSports = [];
    var skipPracticeSports = [];
    sports.forEach(function (entry) {
      if (hasWeekdayIn(entry.gameDays, wd)) gameSports.push(entry);
      else if (hasWeekdayIn(entry.skipPracticeDays, wd)) skipPracticeSports.push(entry);
      else if (hasWeekdayIn(entry.practiceDays, wd)) practiceSports.push(entry);
    });

    function sportNames(list) {
      return list
        .map(function (s) {
          return s.sport;
        })
        .filter(Boolean)
        .join(' + ');
    }

    if (gameSports.length) {
      var comp = competitionLabelForEntry(gameSports[0]);
      var names = sportNames(gameSports);
      return {
        kind: 'game',
        label: comp + ' day' + (gameSports.length > 1 ? ' (multi-sport)' : ''),
        hint:
          (names ? names + ' — ' : '') +
          'Keep it light — recovery focus (~' +
          Math.min(30, maxMin) +
          ' min)',
        maxMinutes: Math.min(30, maxMin),
      };
    }
    if (skipPracticeSports.length) {
      var snames = sportNames(skipPracticeSports);
      return {
        kind: 'rest',
        label: 'Rest day' + (skipPracticeSports.length > 1 ? ' (multi-sport)' : ''),
        hint:
          (snames ? snames + ' — ' : '') +
          'Practice off — good day for a full gym session (~' +
          maxMin +
          ' min)',
        maxMinutes: maxMin,
      };
    }
    if (practiceSports.length) {
      var pnames = sportNames(practiceSports);
      return {
        kind: 'practice',
        label: 'Practice day' + (practiceSports.length > 1 ? ' (multi-sport)' : ''),
        hint:
          (pnames ? pnames + ' — ' : '') +
          'Short session around practice (~' +
          maxMin +
          ' min)',
        maxMinutes: maxMin,
      };
    }
    if (!weekend && Array.isArray(ctx.schoolDays) && ctx.schoolDays.indexOf(wd) !== -1) {
      var weeknightHint = isSportFocusedGoal(ctx)
        ? 'Efficient session after school (~' + maxMin + ' min)'
        : 'Efficient weekday session (~' + maxMin + ' min)';
      return {
        kind: 'weeknight',
        label: 'Weeknight',
        hint: weeknightHint,
        maxMinutes: maxMin,
      };
    }
    return {
      kind: 'normal',
      label: weekend ? 'Weekend' : 'Training day',
      hint: 'Log today\'s session (~' + maxMin + ' min)',
      maxMinutes: maxMin,
    };
  }

  function getDashboardSubtitle(user) {
    var ctx = loadAthleteContext(user);
    if (!isSportFocusedGoal(ctx)) {
      var goal = GOAL_LABELS[ctx.primaryGoal] || ctx.primaryGoal;
      var parts = [];
      if (goal) parts.push(goal);
      parts.push('~' + (ctx.schoolNightMaxMinutes || 45) + ' min weekdays');
      return parts.join(' · ');
    }
    var sports = getSports(ctx);
    if (!sports.length) return '';
    var parts = [];
    var phases = {};
    sports.forEach(function (s) {
      var phase = resolveSeasonPhase(s);
      if (phase && SEASON_LABELS[phase]) {
        phases[phase] = true;
      }
    });
    var phaseKeys = Object.keys(phases);
    if (phaseKeys.length === 1) parts.push(SEASON_LABELS[phaseKeys[0]]);
    else if (phaseKeys.length > 1) parts.push('Multi-sport schedule');

    parts.push(
      sports
        .map(function (s) {
          return s.sport;
        })
        .join(' · ')
    );

    var allPractice = [];
    var allGames = [];
    sports.forEach(function (s) {
      (s.practiceDays || []).forEach(function (p) {
        allPractice.push(p);
      });
      (s.gameDays || []).forEach(function (g) {
        allGames.push(g);
      });
    });
    var practice = formatWeekdays(allPractice);
    if (practice) parts.push('Practice ' + practice);
    var games = formatWeekdays(allGames);
    if (games) parts.push(competitionLabel(ctx) + ' ' + games);
    return parts.join(' · ');
  }

  function getSeasonTip(user) {
    var ctx = loadAthleteContext(user);
    var primary = getPrimarySport(ctx);
    var sp = getSportRecordForEntry(primary);
    if (!sp || !window.SportDatabase) return '';
    return window.SportDatabase.tipForSeason(sp, resolveSeasonPhase(primary) || 'in_season');
  }

  function isProfileComplete(ctx) {
    if (!ctx || !ctx.primaryGoal) return false;
    if (!isSportFocusedGoal(ctx)) {
      return !!(ctx.schoolNightMaxMinutes && ctx.weekendMaxMinutes);
    }
    var sports = getSports(ctx);
    if (!sports.length) return false;
    var hasSchedule = sports.some(function (s) {
      return (s.practiceDays && s.practiceDays.length) || (s.gameDays && s.gameDays.length);
    });
    return !!(hasSchedule && sports.every(function (s) {
      return !!s.sport;
    }));
  }

  var SPORT_CONTEXT_NULL_KEYS = [
    'sport',
    'sportId',
    'position',
    'gradeLevel',
    'primaryGoal',
  ];

  var SPORT_ENTRY_NULL_KEYS = [
    'sport',
    'sportId',
    'position',
    'seasonStartDate',
    'seasonEndDate',
    'nextEventDate',
    'nextEventLabel',
  ];

  function needsGlobalSportsSetup(user) {
    if (!user) return true;
    var ctx = loadAthleteContext(user);
    if (!isSportFocusedGoal(ctx)) return false;
    var raw =
      user.athleteContext && typeof user.athleteContext === 'object'
        ? user.athleteContext
        : null;
    if (!raw) return true;
    var sports = Array.isArray(raw.sports) ? raw.sports : [];
    if (!sports.length) {
      return raw.sport === null || raw.sport === undefined || !String(raw.sport || '').trim();
    }
    return false;
  }

  function getSportSetupIssues(entry) {
    if (!entry || typeof entry !== 'object') return ['Sport entry'];
    var issues = [];
    if (!entry.sport || !String(entry.sport).trim()) issues.push('Sport name');
    if (!resolveSeasonPhase(entry)) issues.push('Season phase');
    var hasSchedule =
      (entry.practiceDays && entry.practiceDays.length) ||
      (entry.gameDays && entry.gameDays.length);
    if (!hasSchedule) issues.push('Practice or game days');
    return issues;
  }

  function getSportsWithSetupIssues(user) {
    var ctx = loadAthleteContext(user);
    var sports = getSports(ctx);
    return sports
      .map(function (entry) {
        return {
          key: entry.key || entry.sport || 'sport',
          sport: entry.sport && String(entry.sport).trim() ? entry.sport : 'Unnamed sport',
          issues: getSportSetupIssues(entry),
        };
      })
      .filter(function (item) {
        return item.issues.length > 0;
      });
  }

  function hasNullSportFieldValue(user) {
    return needsGlobalSportsSetup(user);
  }

  function truncatePromptText(text, maxLen) {
    var s = String(text || '').trim();
    if (!s) return '';
    if (s.length <= maxLen) return s;
    return s.slice(0, Math.max(0, maxLen - 1)).trim() + '…';
  }

  /**
   * Compact context for coach chat (speed). Full block still available via buildCoachPromptBlock.
   */
  function buildCompactCoachPromptBlock(user, localExtras) {
    localExtras = localExtras || {};
    if (!user) return '';
    var ctx = loadAthleteContext(user);
    var sports = getSports(ctx);
    var sportFocused = isSportFocusedGoal(ctx);
    var lines = ['[Athlete context — tailor advice and workouts to schedule and goals]'];

    if (ctx.primaryGoal === 'general_health') {
      lines.push('Profile: general health / daily exercise.');
    } else if (ctx.primaryGoal === 'strength' || ctx.primaryGoal === 'aesthetics') {
      lines.push('Profile: recreational lifter.');
    } else if (sportFocused) {
      lines.push('Profile: student-athlete.');
    } else {
      lines.push('Profile: structured training.');
    }

    if (ctx.gradeLevel) lines.push('Grade: ' + ctx.gradeLevel);

    if (sportFocused || sports.length) {
      sports.slice(0, 3).forEach(function (entry, i) {
        var comp = competitionLabelForEntry(entry);
        var sportLine = 'Sport ' + (i + 1) + ': ' + entry.sport;
        if (entry.position) sportLine += ' — ' + entry.position;
        lines.push(sportLine);
        var phase = resolveSeasonPhase(entry);
        if (phase && SEASON_LABELS[phase]) {
          lines.push('  Season: ' + SEASON_LABELS[phase]);
        }
        var practice = formatWeekdays(entry.practiceDays);
        if (practice) lines.push('  Practice: ' + practice);
        if (entry.gameDays && entry.gameDays.length) {
          lines.push(
            '  ' +
              comp +
              ': ' +
              entry.gameDays
                .map(function (g) {
                  return WEEKDAY_SHORT[g.weekday];
                })
                .join(', ')
          );
        }
        if (entry.nextEventDate) {
          lines.push(
            '  Next ' + (entry.nextEventLabel || comp) + ': ' + entry.nextEventDate
          );
        }
      });
    }

    var goal = GOAL_LABELS[ctx.primaryGoal] || ctx.primaryGoal;
    if (goal) lines.push('Primary goal: ' + goal);
    if (user.experience && EXPERIENCE_LABELS[user.experience]) {
      lines.push('Experience: ' + EXPERIENCE_LABELS[user.experience]);
    }
    if (user.experience === 'beginner') {
      lines.push(
        'BEGINNER MODE: Prefer machines/cables; avoid advanced free-weight lifts unless asked; short form cues; 2–3 sets, conservative loads.'
      );
    }
    if (user.equipment && EQUIPMENT_LABELS[user.equipment]) {
      lines.push('Equipment: ' + EQUIPMENT_LABELS[user.equipment]);
    }
    if (ctx.homeGym && Array.isArray(ctx.homeGym.equipment) && ctx.homeGym.equipment.length) {
      lines.push(
        'Home gym: ' +
          ctx.homeGym.equipment
            .slice(0, 12)
            .map(function (item) {
              var bit = item.name;
              if (item.weightCalibration && item.weightCalibration.rule) {
                bit += ' (' + item.weightCalibration.rule + ')';
              }
              return bit;
            })
            .join('; ')
      );
    }

    var hint = getTodayTrainingHint(user);
    lines.push('Today: ' + hint.label + ' — ~' + hint.maxMinutes + ' min cap.');
    if (hint.kind === 'game') {
      lines.push('Competition day — keep loading light.');
    } else if (hint.kind === 'practice') {
      lines.push('Practice day — complementary gym work.');
    }

    var notes = localExtras.notes || ctx.notes;
    var knownNotes = ctx.knownNotes;
    if (knownNotes && String(knownNotes).trim()) {
      lines.push('Profile notes: ' + truncatePromptText(knownNotes, 500));
    }
    if (notes && String(notes).trim()) {
      lines.push('Extra notes: ' + truncatePromptText(notes, 400));
    }
    if (localExtras.favoriteMovements && String(localExtras.favoriteMovements).trim()) {
      lines.push(
        'Favorite movements: ' + truncatePromptText(localExtras.favoriteMovements, 200)
      );
    }

    lines.push('[End athlete context]');
    return lines.join('\n');
  }

  function buildCoachPromptBlock(user, localExtras) {
    localExtras = localExtras || {};
    if (!user) return '';
    var ctx = loadAthleteContext(user);
    var sports = getSports(ctx);
    var sportFocused = isSportFocusedGoal(ctx);
    var lines = ['[Athlete context — tailor advice and workouts to schedule and goals]'];

    if (ctx.primaryGoal === 'general_health') {
      lines.push(
        'Profile: person training for general health and daily exercise using Strongman AI.'
      );
    } else if (ctx.primaryGoal === 'strength' || ctx.primaryGoal === 'aesthetics') {
      lines.push('Profile: recreational lifter using Strongman AI.');
    } else if (sportFocused) {
      lines.push('Profile: high school student-athlete using Strongman AI.');
    } else {
      lines.push('Profile: person using Strongman AI for structured training.');
    }

    if (ctx.gradeLevel) lines.push('Grade: ' + ctx.gradeLevel);

    if (sportFocused || sports.length) {
      sports.forEach(function (entry, i) {
      var comp = competitionLabelForEntry(entry);
      var sportLine = 'Sport ' + (i + 1) + ': ' + entry.sport;
      if (entry.programType && PROGRAM_LABELS[entry.programType]) {
        sportLine += ' (' + PROGRAM_LABELS[entry.programType] + ')';
      }
      if (entry.position) sportLine += ' — ' + entry.position;
      lines.push(sportLine);
      var sp = getSportRecordForEntry(entry);
      if (sp && window.SportDatabase) {
        var sportBlock = window.SportDatabase.buildAiSportBlock(sp);
        if (sportBlock) lines.push(sportBlock);
      }
      var phase = resolveSeasonPhase(entry);
      if (phase && SEASON_LABELS[phase]) {
        lines.push('  Season phase: ' + SEASON_LABELS[phase]);
      }
      var practice = formatWeekdays(entry.practiceDays);
      if (practice) lines.push('  Practice: ' + practice);
      if (entry.gameDays && entry.gameDays.length) {
        lines.push(
          '  ' +
            comp +
            ' days: ' +
            entry.gameDays
              .map(function (g) {
                return WEEKDAY_SHORT[g.weekday];
              })
              .join(', ')
        );
      }
      if (entry.skipPracticeDays && entry.skipPracticeDays.length) {
        lines.push('  Practice off (lift days): ' + formatWeekdays(entry.skipPracticeDays));
      }
      if (entry.seasonStartDate) lines.push('  Season starts: ' + entry.seasonStartDate);
      if (entry.seasonEndDate) lines.push('  Season ends: ' + entry.seasonEndDate);
      if (entry.nextEventDate) {
        lines.push(
          '  Upcoming ' +
            (entry.nextEventLabel || comp) +
            ': ' +
            entry.nextEventDate
        );
      }
    });
    }

    var goal = GOAL_LABELS[ctx.primaryGoal] || ctx.primaryGoal;
    if (goal) lines.push('Primary goal (prioritize in workouts): ' + goal);
    if (user.experience && EXPERIENCE_LABELS[user.experience]) {
      lines.push('Experience: ' + EXPERIENCE_LABELS[user.experience]);
    }
    if (user.experience === 'beginner') {
      lines.push(
        'BEGINNER MODE (required): Prefer machine and cable exercises (chest press, lat pulldown, seated row, leg press, shoulder press, cable curl, tricep pushdown). Avoid advanced free-weight lifts (barbell snatch, clean & jerk, heavy barbell back squat, deficit deadlift, etc.) unless the athlete explicitly asks. Include short form cues in exercise "why" notes (e.g. lat pulldown: thumb-over grip with thumb on top of the bar; chest press: controlled lockout, feet flat). Keep volume moderate (2–3 sets), weights conservative, and language encouraging for someone new to the gym.'
      );
    } else if (user.experience === 'intermediate') {
      lines.push(
        'Experience guidance: Mix machines and free weights as appropriate; include useful form cues; progressive overload is welcome but stay injury-aware.'
      );
    } else if (user.experience === 'advanced') {
      lines.push(
        'Experience guidance: Athlete can handle more advanced programming and free-weight variations; still include safety notes when intensity is high.'
      );
    }
    if (user.equipment && EQUIPMENT_LABELS[user.equipment]) {
      lines.push('Equipment: ' + EQUIPMENT_LABELS[user.equipment]);
    }
    if (ctx.homeGym && window.HomeGymScan && typeof window.HomeGymScan.formatHomeGymForPrompt === 'function') {
      var gymBlock = window.HomeGymScan.formatHomeGymForPrompt(ctx.homeGym);
      if (gymBlock) lines.push(gymBlock);
    } else if (ctx.homeGym && Array.isArray(ctx.homeGym.equipment) && ctx.homeGym.equipment.length) {
      lines.push(
        'Home gym inventory: ' +
          ctx.homeGym.equipment
            .map(function (item) {
              var bit = item.name;
              if (item.brand) bit += ' (' + item.brand + ')';
              if (item.weightCalibration && item.weightCalibration.rule) {
                bit += ' — ' + item.weightCalibration.rule;
              }
              return bit;
            })
            .join('; ')
      );
    }

    var hint = getTodayTrainingHint(user);
    lines.push('Today: ' + hint.label + ' — cap gym time near ' + hint.maxMinutes + ' minutes.');
    if (hint.kind === 'game') {
      lines.push('Competition day — avoid heavy loading; recovery and mobility only if training.');
    } else if (hint.kind === 'rest') {
      lines.push('Practice off day — good window for a full gym session; no sport practice today.');
    } else if (hint.kind === 'practice') {
      lines.push('Practice day — complementary gym work; account for practice fatigue.');
    } else if (hint.kind === 'weeknight') {
      lines.push('Weeknight — keep sessions efficient and focused.');
    } else if (!sportFocused) {
      lines.push(
        'No sport schedule on file — plan around session caps and the primary goal; do not assume practice or game days.'
      );
    }

    var notes = localExtras.notes || ctx.notes;
    var knownNotes = ctx.knownNotes;
    if (knownNotes && String(knownNotes).trim()) {
      lines.push('Profile context (from setup): ' + String(knownNotes).trim());
    }
    if (notes && String(notes).trim()) {
      lines.push('Additional notes: ' + String(notes).trim());
    }
    if (localExtras.favoriteMovements && String(localExtras.favoriteMovements).trim()) {
      lines.push('Favorite movements: ' + String(localExtras.favoriteMovements).trim());
    }

    lines.push('[End athlete context]');
    return lines.join('\n');
  }

  function wrapPromptWithContext(user, userPrompt, localExtras) {
    var block = buildCoachPromptBlock(user, localExtras);
    var prompt = String(userPrompt || '').trim();
    if (!block) return prompt;
    if (!prompt) return block;
    return block + '\n\n[User message]\n' + prompt;
  }

  function buildThreadPayload(user, thread, localExtras) {
    var block = buildCompactCoachPromptBlock(user, localExtras);
    var messages = Array.isArray(thread) ? thread.slice() : [];
    return {
      contextBlock: block,
      thread: messages,
    };
  }

  window.AthleteContext = {
    defaultContext: defaultContext,
    defaultSport: defaultSport,
    newSportKey: newSportKey,
    loadAthleteContext: loadAthleteContext,
    getSports: getSports,
    getPrimarySport: getPrimarySport,
    getSportRecord: getSportRecord,
    getSportRecordForEntry: getSportRecordForEntry,
    getTodayTrainingHint: getTodayTrainingHint,
    getDashboardSubtitle: getDashboardSubtitle,
    getUpcomingCountdowns: getUpcomingCountdowns,
    getSeasonTip: getSeasonTip,
    competitionLabel: competitionLabel,
    competitionLabelForEntry: competitionLabelForEntry,
    buildCoachPromptBlock: buildCoachPromptBlock,
    buildCompactCoachPromptBlock: buildCompactCoachPromptBlock,
    wrapPromptWithContext: wrapPromptWithContext,
    buildThreadPayload: buildThreadPayload,
    isProfileComplete: isProfileComplete,
    isSportFocusedGoal: isSportFocusedGoal,
    hasNullSportFieldValue: hasNullSportFieldValue,
    needsGlobalSportsSetup: needsGlobalSportsSetup,
    needsScheduleSetup: needsScheduleSetup,
    isPlaceholderSchedule: isPlaceholderSchedule,
    getSportSetupIssues: getSportSetupIssues,
    getSportsWithSetupIssues: getSportsWithSetupIssues,
    reasonToPrimaryGoal: reasonToPrimaryGoal,
    primaryGoalToReason: primaryGoalToReason,
    GOAL_LABELS: GOAL_LABELS,
    SEASON_LABELS: SEASON_LABELS,
    PROGRAM_LABELS: PROGRAM_LABELS,
    EXPERIENCE_LABELS: EXPERIENCE_LABELS,
    EQUIPMENT_LABELS: EQUIPMENT_LABELS,
    WEEKDAY_SHORT: WEEKDAY_SHORT,
    formatWeekdays: formatWeekdays,
    daysUntilDate: daysUntilDate,
    resolveSeasonPhase: resolveSeasonPhase,
  };
})();
