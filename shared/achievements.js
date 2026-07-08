(function () {
  var LB_PER_KG = 2.2046226218;

  var CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'platform', label: 'Platform' },
    { id: 'lifts', label: 'Lifts' },
    { id: 'training', label: 'Training' },
    { id: 'social', label: 'Social' },
    { id: 'cardio', label: 'Cardio' }
  ];

  var TIER_ORDER = { bronze: 1, silver: 2, gold: 3, platinum: 4, legendary: 5 };

  function parseLiftWeightLb(record) {
    if (!record || record.discipline !== 'weightlifting') return 0;
    var vd = String(record.valueDisplay || '');
    var m = vd.match(/([\d.]+)\s*(lb|kg)/i);
    if (!m) return 0;
    var w = parseFloat(m[1]);
    if (!Number.isFinite(w) || w <= 0) return 0;
    if (m[2].toLowerCase() === 'kg') return w * LB_PER_KG;
    return w;
  }

  function liftLabelMatches(label, keywords) {
    var l = String(label || '').toLowerCase();
    return keywords.some(function (kw) {
      return l.indexOf(kw) !== -1;
    });
  }

  function maxLiftLb(prs, keywords) {
    var max = 0;
    (prs || []).forEach(function (pr) {
      if (!liftLabelMatches(pr.eventLabel, keywords)) return;
      max = Math.max(max, parseLiftWeightLb(pr));
    });
    return max;
  }

  function countDiscipline(prs, discipline) {
    return (prs || []).filter(function (pr) {
      return pr && pr.discipline === discipline;
    }).length;
  }

  function earliestActivityMs(ctx) {
    var earliest = null;
    function consider(iso) {
      if (!iso) return;
      var t = Date.parse(iso);
      if (!Number.isFinite(t)) return;
      if (earliest == null || t < earliest) earliest = t;
    }
    (ctx.prs || []).forEach(function (pr) {
      consider(pr.createdAt);
      if (pr.date) consider(pr.date + 'T' + (pr.time || '12:00:00'));
    });
    (ctx.workouts || []).forEach(function (w) {
      consider(w.createdAt);
      if (w.date) consider(w.date + 'T12:00:00');
    });
    return earliest;
  }

  function trainingDays(ctx) {
    var start = earliestActivityMs(ctx);
    if (start == null) return 0;
    return Math.floor((Date.now() - start) / 86400000);
  }

  function computeStreak(sessions) {
    var days = new Set();
    (sessions || []).forEach(function (s) {
      var raw = s.createdAt || s.date;
      if (!raw) return;
      var d = new Date(raw);
      if (isNaN(d.getTime())) return;
      d.setHours(0, 0, 0, 0);
      days.add(d.getTime());
    });
    if (!days.size) return 0;
    var streak = 0;
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (days.has(cursor.getTime())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function profileComplete(user) {
    if (!user) return false;
    var hasAvatar = !!(user.avatarUrl && String(user.avatarUrl).trim());
    var hasBio = !!(user.bio && String(user.bio).trim());
    var hasExp = !!(user.experience && String(user.experience).trim());
    return hasAvatar && hasBio && hasExp;
  }

  function athleteProfileComplete(user) {
    if (!user || !user.athleteContext || typeof user.athleteContext !== 'object') return false;
    if (window.AthleteContext && typeof window.AthleteContext.isProfileComplete === 'function') {
      return window.AthleteContext.isProfileComplete(
        window.AthleteContext.loadAthleteContext(user)
      );
    }
    var ac = user.athleteContext;
    return !!(
      ac.sport &&
      ac.seasonPhase &&
      ac.primaryGoal &&
      ((ac.practiceDays && ac.practiceDays.length) || (ac.gameDays && ac.gameDays.length))
    );
  }

  function sessionWeekday(session) {
    var raw = session && (session.createdAt || session.date);
    if (!raw) return null;
    var d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.getDay();
  }

  function isRecoverySession(session) {
    if (!session) return false;
    var intensity = parseInt(session.totalIntensity, 10);
    if (!isNaN(intensity) && intensity <= 50) return true;
    var label = String(session.title || session.name || session.split || '').toLowerCase();
    return /recover|mobility|light|prehab|rest/i.test(label);
  }

  function loggedRecoveryOnGameDay(user, workouts) {
    if (!user || !user.athleteContext) return false;
    var ctx =
      window.AthleteContext && typeof window.AthleteContext.loadAthleteContext === 'function'
        ? window.AthleteContext.loadAthleteContext(user)
        : user.athleteContext;
    var gameDays = [];
    if (window.AthleteContext && typeof window.AthleteContext.getSports === 'function') {
      window.AthleteContext.getSports(ctx).forEach(function (entry) {
        if (entry.gameDays && entry.gameDays.length) {
          gameDays = gameDays.concat(entry.gameDays);
        }
      });
    }
    if (!gameDays.length) gameDays = ctx.gameDays || [];
    if (!Array.isArray(gameDays) || !gameDays.length) return false;
    return (workouts || []).some(function (session) {
      var wd = sessionWeekday(session);
      if (wd == null) return false;
      var onGameDay = gameDays.some(function (g) {
        return g != null && Number(g.weekday) === wd;
      });
      return onGameDay && isRecoverySession(session);
    });
  }

  function buildLiftBadge(id, title, description, tier, keywords, targetLb, kind) {
    return {
      id: id,
      title: title,
      description: description,
      category: 'lifts',
      tier: tier,
      kind: kind || 'lift',
      check: function (ctx) {
        var best = maxLiftLb(ctx.prs, keywords);
        return {
          unlocked: best >= targetLb,
          progress: best,
          target: targetLb,
          progressLabel: best > 0 ? Math.round(best) + ' lb best' : 'No PR logged yet'
        };
      }
    };
  }

  var CATALOG = [
    {
      id: 'joined-platform',
      title: 'Welcome to the Arena',
      description: 'Create your Strongman AI account',
      category: 'platform',
      tier: 'bronze',
      kind: 'platform',
      check: function (ctx) {
        return { unlocked: !!(ctx.user && ctx.user.id), progress: 1, target: 1 };
      }
    },
    {
      id: 'profile-complete',
      title: 'Fully Loaded',
      description: 'Set your avatar, bio, and experience level',
      category: 'platform',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var done = profileComplete(ctx.user);
        return { unlocked: done, progress: done ? 1 : 0, target: 1 };
      }
    },
    {
      id: 'student-athlete',
      title: 'Student Athlete',
      description: 'Complete your athlete profile with sport, schedule, and goal',
      category: 'platform',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var done = athleteProfileComplete(ctx.user);
        return { unlocked: done, progress: done ? 1 : 0, target: 1 };
      }
    },
    {
      id: 'game-day-ready',
      title: 'Game Day Ready',
      description: 'Log a recovery session on a marked game day',
      category: 'training',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var done = loggedRecoveryOnGameDay(ctx.user, ctx.workouts);
        return { unlocked: done, progress: done ? 1 : 0, target: 1 };
      }
    },
    {
      id: 'first-pr',
      title: 'On the Board',
      description: 'Log your first personal record',
      category: 'platform',
      tier: 'bronze',
      kind: 'platform',
      check: function (ctx) {
        var n = (ctx.prs || []).length;
        return { unlocked: n >= 1, progress: n, target: 1, progressLabel: n + ' PR' + (n === 1 ? '' : 's') };
      }
    },
    {
      id: 'first-workout',
      title: 'Day One',
      description: 'Log your first workout session',
      category: 'training',
      tier: 'bronze',
      kind: 'platform',
      check: function (ctx) {
        var n = (ctx.workouts || []).length;
        return { unlocked: n >= 1, progress: n, target: 1, progressLabel: n + ' session' + (n === 1 ? '' : 's') };
      }
    },
    {
      id: 'workouts-10',
      title: 'Regular',
      description: 'Log 10 workout sessions',
      category: 'training',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var n = (ctx.workouts || []).length;
        return { unlocked: n >= 10, progress: n, target: 10, progressLabel: n + ' / 10 sessions' };
      }
    },
    {
      id: 'workouts-50',
      title: 'Iron Veteran',
      description: 'Log 50 workout sessions',
      category: 'training',
      tier: 'gold',
      kind: 'platform',
      check: function (ctx) {
        var n = (ctx.workouts || []).length;
        return { unlocked: n >= 50, progress: n, target: 50, progressLabel: n + ' / 50 sessions' };
      }
    },
    {
      id: 'streak-7',
      title: 'Week Warrior',
      description: 'Train 7 days in a row',
      category: 'training',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var s = computeStreak(ctx.workouts);
        return { unlocked: s >= 7, progress: s, target: 7, progressLabel: s + ' day streak' };
      }
    },
    {
      id: 'streak-30',
      title: 'Unbreakable',
      description: 'Train 30 days in a row',
      category: 'training',
      tier: 'legendary',
      kind: 'platform',
      check: function (ctx) {
        var s = computeStreak(ctx.workouts);
        return { unlocked: s >= 30, progress: s, target: 30, progressLabel: s + ' day streak' };
      }
    },
    {
      id: 'tenure-1y',
      title: '1 Year Lifter',
      description: 'Train with Strongman AI for 1 year',
      category: 'training',
      tier: 'gold',
      kind: 'platform',
      check: function (ctx) {
        var d = trainingDays(ctx);
        return { unlocked: d >= 365, progress: d, target: 365, progressLabel: d + ' days training' };
      }
    },
    {
      id: 'tenure-2y',
      title: '2 Year Lifter',
      description: 'Train with Strongman AI for 2 years',
      category: 'training',
      tier: 'platinum',
      kind: 'platform',
      check: function (ctx) {
        var d = trainingDays(ctx);
        return { unlocked: d >= 730, progress: d, target: 730, progressLabel: d + ' days training' };
      }
    },
    {
      id: 'followers-1',
      title: 'Getting Noticed',
      description: 'Earn your first follower',
      category: 'social',
      tier: 'bronze',
      kind: 'platform',
      check: function (ctx) {
        var n = ctx.user && ctx.user.followersCount != null ? Number(ctx.user.followersCount) : 0;
        return { unlocked: n >= 1, progress: n, target: 1, progressLabel: n + ' follower' + (n === 1 ? '' : 's') };
      }
    },
    {
      id: 'followers-10',
      title: 'Crew Building',
      description: 'Reach 10 followers',
      category: 'social',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var n = ctx.user && ctx.user.followersCount != null ? Number(ctx.user.followersCount) : 0;
        return { unlocked: n >= 10, progress: n, target: 10, progressLabel: n + ' / 10 followers' };
      }
    },
    {
      id: 'followers-50',
      title: 'Influencer',
      description: 'Reach 50 followers',
      category: 'social',
      tier: 'gold',
      kind: 'platform',
      check: function (ctx) {
        var n = ctx.user && ctx.user.followersCount != null ? Number(ctx.user.followersCount) : 0;
        return { unlocked: n >= 50, progress: n, target: 50, progressLabel: n + ' / 50 followers' };
      }
    },
    {
      id: 'followers-100',
      title: 'Local Legend',
      description: 'Reach 100 followers',
      category: 'social',
      tier: 'platinum',
      kind: 'platform',
      check: function (ctx) {
        var n = ctx.user && ctx.user.followersCount != null ? Number(ctx.user.followersCount) : 0;
        return { unlocked: n >= 100, progress: n, target: 100, progressLabel: n + ' / 100 followers' };
      }
    },
    {
      id: 'following-10',
      title: 'Scout',
      description: 'Follow 10 athletes',
      category: 'social',
      tier: 'bronze',
      kind: 'platform',
      check: function (ctx) {
        var n = ctx.user && ctx.user.followingCount != null ? Number(ctx.user.followingCount) : 0;
        return { unlocked: n >= 10, progress: n, target: 10, progressLabel: n + ' / 10 following' };
      }
    },
    {
      id: 'cardio-first-run',
      title: 'Road Runner',
      description: 'Log a running personal record',
      category: 'cardio',
      tier: 'bronze',
      kind: 'cardio',
      check: function (ctx) {
        var n = countDiscipline(ctx.prs, 'running');
        return { unlocked: n >= 1, progress: n, target: 1 };
      }
    },
    {
      id: 'cardio-first-swim',
      title: 'Pool Shark',
      description: 'Log a swimming personal record',
      category: 'cardio',
      tier: 'bronze',
      kind: 'cardio',
      check: function (ctx) {
        var n = countDiscipline(ctx.prs, 'swimming');
        return { unlocked: n >= 1, progress: n, target: 1 };
      }
    },
    {
      id: 'prs-5',
      title: 'PR Machine',
      description: 'Log 5 personal records',
      category: 'training',
      tier: 'silver',
      kind: 'platform',
      check: function (ctx) {
        var n = (ctx.prs || []).length;
        return { unlocked: n >= 5, progress: n, target: 5, progressLabel: n + ' / 5 PRs' };
      }
    },
    buildLiftBadge('bench-135', 'Plate Club', 'Bench press 135 lb or more', 'bronze', ['bench'], 135),
    buildLiftBadge('bench-185', 'Two Plates', 'Bench press 185 lb or more', 'silver', ['bench'], 185),
    buildLiftBadge('bench-225', 'Three Plates', 'Bench press 225 lb or more', 'gold', ['bench'], 225),
    buildLiftBadge('bench-315', 'Elite Presser', 'Bench press 315 lb or more', 'platinum', ['bench'], 315),
    buildLiftBadge('squat-135', 'Squat Starter', 'Squat 135 lb or more', 'bronze', ['squat'], 135),
    buildLiftBadge('squat-225', 'Deep Waters', 'Squat 225 lb or more', 'silver', ['squat'], 225),
    buildLiftBadge('squat-315', 'Quad King', 'Squat 315 lb or more', 'gold', ['squat'], 315),
    buildLiftBadge('squat-405', 'Squat Titan', 'Squat 405 lb or more', 'platinum', ['squat'], 405),
    buildLiftBadge('deadlift-225', 'Pull Initiate', 'Deadlift 225 lb or more', 'bronze', ['deadlift', 'dead lift'], 225),
    buildLiftBadge('deadlift-315', 'Heavy Puller', 'Deadlift 315 lb or more', 'silver', ['deadlift', 'dead lift'], 315),
    buildLiftBadge('deadlift-405', 'Four Plates', 'Deadlift 405 lb or more', 'gold', ['deadlift', 'dead lift'], 405),
    buildLiftBadge('deadlift-500', 'Half Ton Club', 'Deadlift 500 lb or more', 'legendary', ['deadlift', 'dead lift'], 500),
    buildLiftBadge('ohp-135', 'Press Pass', 'Overhead press 135 lb or more', 'silver', ['overhead', 'ohp', 'military press', 'strict press'], 135),
    buildLiftBadge('log-185', 'Log Loader', 'Log press 185 lb or more', 'gold', ['log', 'log press'], 185),
    buildLiftBadge('stone-200', 'Stone Shoulder', 'Atlas stone 200 lb or more', 'gold', ['atlas', 'stone'], 200),
    {
      id: 'total-500',
      title: '500 Club',
      description: 'Combined best squat + bench + deadlift ≥ 500 lb',
      category: 'lifts',
      tier: 'gold',
      kind: 'lift',
      check: function (ctx) {
        var sq = maxLiftLb(ctx.prs, ['squat']);
        var bp = maxLiftLb(ctx.prs, ['bench']);
        var dl = maxLiftLb(ctx.prs, ['deadlift', 'dead lift']);
        var total = sq + bp + dl;
        return {
          unlocked: total >= 500,
          progress: total,
          target: 500,
          progressLabel: Math.round(total) + ' / 500 lb total'
        };
      }
    },
    {
      id: 'total-1000',
      title: '1,000 Club',
      description: 'Combined best squat + bench + deadlift ≥ 1,000 lb',
      category: 'lifts',
      tier: 'legendary',
      kind: 'lift',
      check: function (ctx) {
        var sq = maxLiftLb(ctx.prs, ['squat']);
        var bp = maxLiftLb(ctx.prs, ['bench']);
        var dl = maxLiftLb(ctx.prs, ['deadlift', 'dead lift']);
        var total = sq + bp + dl;
        return {
          unlocked: total >= 1000,
          progress: total,
          target: 1000,
          progressLabel: Math.round(total) + ' / 1,000 lb total'
        };
      }
    }
  ];

  function buildContext(user, opts) {
    opts = opts || {};
    var prs = [];
    var workouts = [];
    if (!opts.skipLocalData) {
      try {
        if (window.PRLog && typeof window.PRLog.getRecords === 'function') {
          prs = window.PRLog.getRecords();
        }
      } catch (e) {}
      try {
        if (window.WorkoutLog && typeof window.WorkoutLog.getSessions === 'function') {
          workouts = window.WorkoutLog.getSessions();
        }
      } catch (e) {}
    }
    return { user: user || null, prs: prs, workouts: workouts };
  }

  function evaluate(user, opts) {
    var ctx = buildContext(user, opts);
    var results = [];
    CATALOG.forEach(function (def) {
      var state = def.check(ctx);
      results.push({
        id: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        tier: def.tier,
        kind: def.kind,
        unlocked: !!state.unlocked,
        progress: state.progress,
        target: state.target,
        progressLabel: state.progressLabel || ''
      });
    });
    var unlocked = results.filter(function (r) {
      return r.unlocked;
    });
    unlocked.sort(function (a, b) {
      return (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0);
    });
    return {
      all: results,
      unlocked: unlocked,
      locked: results.filter(function (r) {
        return !r.unlocked;
      }),
      unlockedCount: unlocked.length,
      totalCount: results.length
    };
  }

  function getById(id) {
    return CATALOG.find(function (d) {
      return d.id === id;
    });
  }

  window.Achievements = {
    CATALOG: CATALOG,
    CATEGORIES: CATEGORIES,
    TIER_ORDER: TIER_ORDER,
    evaluate: evaluate,
    buildContext: buildContext,
    getById: getById
  };
})();
