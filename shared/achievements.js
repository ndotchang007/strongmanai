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
        var best = Math.max(maxLiftLb(ctx.prs, keywords), maxLoggedLiftLb(ctx.workouts, keywords));
        return {
          unlocked: best >= targetLb,
          progress: best,
          target: targetLb,
          progressLabel: best > 0 ? Math.round(best) + ' lb best' : 'No lift logged yet'
        };
      }
    };
  }

  function exerciseNamesInWorkout(session) {
    var names = [];
    (session.exercises || []).forEach(function (ex) {
      if (ex && ex.name) names.push(String(ex.name));
    });
    (session.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(function (ex) {
        if (ex && ex.name) names.push(String(ex.name));
      });
    });
    return names;
  }

  function workoutMatchesKeywords(session, keywords) {
    return exerciseNamesInWorkout(session).some(function (name) {
      return liftLabelMatches(name, keywords);
    });
  }

  function countSessionsWithLift(workouts, keywords) {
    var n = 0;
    (workouts || []).forEach(function (s) {
      if (workoutMatchesKeywords(s, keywords)) n += 1;
    });
    return n;
  }

  function parseLooseWeight(v) {
    if (v == null || v === '') return 0;
    var n = parseFloat(String(v).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function maxLoggedLiftLb(workouts, keywords) {
    var max = 0;
    (workouts || []).forEach(function (s) {
      var list = [];
      (s.exercises || []).forEach(function (ex) {
        list.push(ex);
      });
      (s.blocks || []).forEach(function (blk) {
        (blk.exercises || []).forEach(function (ex) {
          list.push(ex);
        });
      });
      list.forEach(function (ex) {
        if (!ex || !liftLabelMatches(ex.name, keywords)) return;
        var weights = Array.isArray(ex.setWeights) ? ex.setWeights : [];
        if (weights.length) {
          weights.forEach(function (w) {
            max = Math.max(max, parseLooseWeight(w));
          });
        } else {
          max = Math.max(max, parseLooseWeight(ex.weight));
        }
      });
    });
    return max;
  }

  function buildSessionLiftBadge(id, title, description, tier, keywords, targetSessions) {
    return {
      id: id,
      title: title,
      description: description,
      category: 'lifts',
      tier: tier,
      kind: 'lift',
      check: function (ctx) {
        var n = countSessionsWithLift(ctx.workouts, keywords);
        return {
          unlocked: n >= targetSessions,
          progress: n,
          target: targetSessions,
          progressLabel: n + ' / ' + targetSessions + ' sessions'
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
    buildSessionLiftBadge(
      'logged-bench',
      'First Bench',
      'Log a bench press in any workout',
      'bronze',
      ['bench press', 'bench'],
      1
    ),
    buildSessionLiftBadge(
      'logged-squat',
      'First Squat',
      'Log a squat in any workout',
      'bronze',
      ['back squat', 'front squat', 'squat'],
      1
    ),
    buildSessionLiftBadge(
      'logged-deadlift',
      'First Deadlift',
      'Log a deadlift in any workout',
      'bronze',
      ['deadlift', 'dead lift'],
      1
    ),
    buildSessionLiftBadge(
      'logged-ohp',
      'Overhead Initiation',
      'Log an overhead / military press',
      'bronze',
      ['overhead press', 'ohp', 'military press', 'strict press'],
      1
    ),
    buildSessionLiftBadge(
      'logged-row',
      'Row Rookie',
      'Log a barbell, DB, or cable row',
      'bronze',
      ['barbell row', 'dumbbell row', 'cable row', 'seated row', 'pendlay row', 't-bar row', 'chest-supported row'],
      1
    ),
    buildSessionLiftBadge(
      'logged-pullup',
      'Chin Up',
      'Log pull-ups or chin-ups',
      'bronze',
      ['pull-up', 'pull up', 'pullup', 'chin-up', 'chin up', 'chinup'],
      1
    ),
    buildSessionLiftBadge(
      'logged-lunge',
      'Split Stance',
      'Log lunges or split squats',
      'bronze',
      ['lunge', 'split squat', 'bulgarian'],
      1
    ),
    buildSessionLiftBadge(
      'logged-hip-thrust',
      'Hip Drive',
      'Log a hip thrust or glute bridge',
      'bronze',
      ['hip thrust', 'glute bridge'],
      1
    ),
    buildSessionLiftBadge(
      'bench-sessions-10',
      'Bench Regular',
      'Bench press in 10 different sessions',
      'silver',
      ['bench press', 'bench'],
      10
    ),
    buildSessionLiftBadge(
      'squat-sessions-10',
      'Squat Habit',
      'Squat in 10 different sessions',
      'silver',
      ['back squat', 'front squat', 'squat'],
      10
    ),
    buildSessionLiftBadge(
      'deadlift-sessions-10',
      'Pull Habit',
      'Deadlift in 10 different sessions',
      'silver',
      ['deadlift', 'dead lift'],
      10
    ),
    buildLiftBadge('bench-135', 'Plate Club', 'Bench press 135 lb or more', 'bronze', ['bench'], 135),
    buildLiftBadge('bench-185', 'Two Plates', 'Bench press 185 lb or more', 'silver', ['bench'], 185),
    buildLiftBadge('bench-225', 'Three Plates', 'Bench press 225 lb or more', 'gold', ['bench'], 225),
    buildLiftBadge('bench-275', 'Almost Elite', 'Bench press 275 lb or more', 'gold', ['bench'], 275),
    buildLiftBadge('bench-315', 'Elite Presser', 'Bench press 315 lb or more', 'platinum', ['bench'], 315),
    buildLiftBadge('squat-135', 'Squat Starter', 'Squat 135 lb or more', 'bronze', ['squat'], 135),
    buildLiftBadge('squat-225', 'Deep Waters', 'Squat 225 lb or more', 'silver', ['squat'], 225),
    buildLiftBadge('squat-275', 'Under the Bar', 'Squat 275 lb or more', 'silver', ['squat'], 275),
    buildLiftBadge('squat-315', 'Quad King', 'Squat 315 lb or more', 'gold', ['squat'], 315),
    buildLiftBadge('squat-405', 'Squat Titan', 'Squat 405 lb or more', 'platinum', ['squat'], 405),
    buildLiftBadge('deadlift-135', 'First Pull', 'Deadlift 135 lb or more', 'bronze', ['deadlift', 'dead lift'], 135),
    buildLiftBadge('deadlift-225', 'Pull Initiate', 'Deadlift 225 lb or more', 'bronze', ['deadlift', 'dead lift'], 225),
    buildLiftBadge('deadlift-315', 'Heavy Puller', 'Deadlift 315 lb or more', 'silver', ['deadlift', 'dead lift'], 315),
    buildLiftBadge('deadlift-405', 'Four Plates', 'Deadlift 405 lb or more', 'gold', ['deadlift', 'dead lift'], 405),
    buildLiftBadge('deadlift-500', 'Half Ton Club', 'Deadlift 500 lb or more', 'legendary', ['deadlift', 'dead lift'], 500),
    buildLiftBadge('ohp-95', 'Press Primer', 'Overhead press 95 lb or more', 'bronze', ['overhead', 'ohp', 'military press', 'strict press'], 95),
    buildLiftBadge('ohp-135', 'Press Pass', 'Overhead press 135 lb or more', 'silver', ['overhead', 'ohp', 'military press', 'strict press'], 135),
    buildLiftBadge('ohp-185', 'Strict Strength', 'Overhead press 185 lb or more', 'gold', ['overhead', 'ohp', 'military press', 'strict press'], 185),
    buildLiftBadge('row-185', 'Row Strength', 'Row 185 lb or more', 'silver', ['row'], 185),
    buildLiftBadge('row-225', 'Thick Back', 'Row 225 lb or more', 'gold', ['row'], 225),
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
        var sq = Math.max(maxLiftLb(ctx.prs, ['squat']), maxLoggedLiftLb(ctx.workouts, ['squat']));
        var bp = Math.max(maxLiftLb(ctx.prs, ['bench']), maxLoggedLiftLb(ctx.workouts, ['bench']));
        var dl = Math.max(
          maxLiftLb(ctx.prs, ['deadlift', 'dead lift']),
          maxLoggedLiftLb(ctx.workouts, ['deadlift', 'dead lift'])
        );
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
        var sq = Math.max(maxLiftLb(ctx.prs, ['squat']), maxLoggedLiftLb(ctx.workouts, ['squat']));
        var bp = Math.max(maxLiftLb(ctx.prs, ['bench']), maxLoggedLiftLb(ctx.workouts, ['bench']));
        var dl = Math.max(
          maxLiftLb(ctx.prs, ['deadlift', 'dead lift']),
          maxLoggedLiftLb(ctx.workouts, ['deadlift', 'dead lift'])
        );
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
    opts = opts || {};
    if (canSync() && !opts.skipServerPull) {
      pullFromServerAsync();
    }
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

  var SEEN_KEY_BASE = 'strongman-achievements-seen';
  var UNLOCKED_KEY_BASE = 'strongman-achievements-unlocked';
  var pullInflight = null;

  function canSync() {
    return !!(
      window.isLoggedIn &&
      window.isLoggedIn() &&
      window.getCurrentUser &&
      window.apiGet &&
      window.apiPut &&
      window.apiPost
    );
  }

  function unlockedStorageKey() {
    return UNLOCKED_KEY_BASE + userSuffix();
  }

  function loadUnlockedMap() {
    try {
      var raw = localStorage.getItem(unlockedStorageKey());
      if (!raw) return {};
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveUnlockedMap(map) {
    try {
      localStorage.setItem(unlockedStorageKey(), JSON.stringify(map || {}));
    } catch (e) {}
  }

  function mergeServerAchievements(rows) {
    if (!Array.isArray(rows)) return;
    var seen = loadSeenIds();
    var unlocked = loadUnlockedMap();
    rows.forEach(function (row) {
      if (!row || !row.achievementId) return;
      var id = row.achievementId;
      unlocked[id] = {
        unlockedAt:
          row.unlockedAt ||
          (unlocked[id] && unlocked[id].unlockedAt) ||
          new Date().toISOString(),
      };
      if (row.seen) seen[id] = true;
    });
    saveUnlockedMap(unlocked);
    saveSeenIds(seen);
  }

  function pullFromServerAsync() {
    if (!canSync()) return Promise.resolve(null);
    if (pullInflight) return pullInflight;
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(null);
    pullInflight = window
      .apiGet('/users/' + u.id + '/achievements')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (rows) {
        mergeServerAchievements(rows);
        return rows;
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        pullInflight = null;
      });
    return pullInflight;
  }

  function pushUnlockedToServer(items) {
    if (!canSync() || !items || !items.length) return Promise.resolve(false);
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(false);
    return window
      .apiPut('/users/' + u.id + '/achievements', { achievements: items })
      .then(function (res) {
        if (!res.ok) return false;
        return res.json();
      })
      .then(function (rows) {
        if (!rows) return false;
        mergeServerAchievements(rows);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function markSeenOnServer(ids) {
    if (!canSync() || !ids || !ids.length) return Promise.resolve(false);
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(false);
    return window
      .apiPost('/users/' + u.id + '/achievements/seen', { ids: ids })
      .then(function (res) {
        if (!res.ok) return false;
        return res.json();
      })
      .then(function (rows) {
        if (!rows) return false;
        mergeServerAchievements(rows);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function syncUnlockedAchievements(unlockedList) {
    if (!unlockedList || !unlockedList.length) return;
    var unlocked = loadUnlockedMap();
    var items = [];
    unlockedList.forEach(function (ach) {
      if (!ach || !ach.id) return;
      if (!unlocked[ach.id]) {
        unlocked[ach.id] = { unlockedAt: new Date().toISOString() };
        items.push({ achievementId: ach.id, unlockedAt: unlocked[ach.id].unlockedAt, seen: false });
      }
    });
    saveUnlockedMap(unlocked);
    if (items.length) pushUnlockedToServer(items);
  }

  function userSuffix() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '_guest';
      var u = window.getCurrentUser();
      return u && u.id != null ? '_u' + u.id : '_guest';
    } catch (e) {
      return '_guest';
    }
  }

  function seenStorageKey() {
    return SEEN_KEY_BASE + userSuffix();
  }

  function loadSeenIds() {
    try {
      var raw = localStorage.getItem(seenStorageKey());
      if (!raw) return {};
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveSeenIds(map) {
    try {
      localStorage.setItem(seenStorageKey(), JSON.stringify(map || {}));
    } catch (e) {}
  }

  function markSeen(ids) {
    var map = loadSeenIds();
    (ids || []).forEach(function (id) {
      if (id) map[id] = true;
    });
    saveSeenIds(map);
    markSeenOnServer(ids || []);
  }

  function findNewUnlocks(user, opts) {
    var state = evaluate(user, opts);
    var seen = loadSeenIds();
    var knownAny = Object.keys(seen).length > 0;
    var fresh = state.unlocked.filter(function (ach) {
      return !seen[ach.id];
    });
    // First ever evaluation: seed everything so rejoining doesn't spam unlock toasts.
    if (!knownAny && state.unlockedCount) {
      markSeen(
        state.unlocked.map(function (a) {
          return a.id;
        })
      );
      syncUnlockedAchievements(state.unlocked);
      return [];
    }
    return fresh;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconSvgForKind(kind) {
    if (kind === 'cardio') {
      return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h3l2-5 3 10 2-5h6"/></svg>';
    }
    if (kind === 'lift') {
      return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8h12M6 16h12M4 10v4M20 10v4M9 6v12M15 6v12"/></svg>';
    }
    return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z"/></svg>';
  }

  var unlockQueue = [];
  var unlockShowing = false;

  function dismissUnlockUi() {
    var el = document.getElementById('sm-badge-unlock');
    if (el) el.remove();
    unlockShowing = false;
    if (unlockQueue.length) showNextUnlock();
  }

  function showNextUnlock() {
    if (unlockShowing || !unlockQueue.length) return;
    unlockShowing = true;
    var ach = unlockQueue.shift();
    markSeen([ach.id]);
    var remaining = unlockQueue.length;
    var overlay = document.createElement('div');
    overlay.id = 'sm-badge-unlock';
    overlay.className = 'sm-badge-unlock';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sm-badge-unlock-title');
    overlay.innerHTML =
      '<div class="sm-badge-unlock-card">' +
      '<div class="sm-badge-unlock-burst" aria-hidden="true"></div>' +
      '<p class="sm-badge-unlock-kicker">Badge unlocked</p>' +
      '<div class="sm-badge-unlock-icon" aria-hidden="true">' +
      iconSvgForKind(ach.kind) +
      '</div>' +
      '<h2 class="sm-badge-unlock-title" id="sm-badge-unlock-title">' +
      escapeHtml(ach.title) +
      '</h2>' +
      '<p class="sm-badge-unlock-desc">' +
      escapeHtml(ach.description) +
      '</p>' +
      '<span class="sm-badge-unlock-tier">' +
      escapeHtml(ach.tier || 'bronze') +
      '</span>' +
      '<div><button type="button" class="sm-badge-unlock-btn" id="sm-badge-unlock-ok">Nice</button></div>' +
      (remaining
        ? '<p class="sm-badge-unlock-queue">+' + remaining + ' more unlock' + (remaining === 1 ? '' : 's') + '</p>'
        : '') +
      '</div>';
    document.body.appendChild(overlay);
    var ok = overlay.querySelector('#sm-badge-unlock-ok');
    if (ok) ok.focus();
    function close() {
      dismissUnlockUi();
    }
    if (ok) ok.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  function celebrateNewUnlocks(user, opts) {
    if (!user || !user.id) return [];
    if (typeof window.matchMedia === 'function') {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          var quiet = findNewUnlocks(user, opts);
          markSeen(
            quiet.map(function (a) {
              return a.id;
            })
          );
          return quiet;
        }
      } catch (e) {}
    }
    var fresh = findNewUnlocks(user, opts);
    if (!fresh.length) return [];
    syncUnlockedAchievements(fresh);
    // Prefer lift unlocks in celebration order (newest/highest tier first already).
    unlockQueue = unlockQueue.concat(fresh);
    showNextUnlock();
    return fresh;
  }

  window.Achievements = {
    CATALOG: CATALOG,
    CATEGORIES: CATEGORIES,
    TIER_ORDER: TIER_ORDER,
    evaluate: evaluate,
    buildContext: buildContext,
    getById: getById,
    findNewUnlocks: findNewUnlocks,
    celebrateNewUnlocks: celebrateNewUnlocks,
    markSeen: markSeen,
    pullFromServerAsync: pullFromServerAsync,
    syncUnlockedAchievements: syncUnlockedAchievements
  };
})();
