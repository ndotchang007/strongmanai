(function () {
  'use strict';

  var LEG_PATTERNS = /\b(leg|squat|lunge|deadlift|calf|hamstring|quad|glute|rdl|hip thrust)\b/i;
  var PUSH_PATTERNS = /\b(bench|press|push|chest|shoulder|tricep|dip|fly|ohp)\b/i;
  var PULL_PATTERNS = /\b(pull|row|lat|back|bicep|chin|curl)\b/i;
  var ARM_PATTERNS = /\b(curl|tricep|bicep|arm|skull)\b/i;
  var CHEST_PATTERNS = /\b(bench|chest|fly|flies|pec|push.?up|pushup|incline|decline|db press|dumbbell press)\b/i;

  function sessionDateKey(s) {
    if (s && s.date) return String(s.date).slice(0, 10);
    if (s && s.createdAt) {
      var d = new Date(s.createdAt);
      if (!isNaN(d.getTime())) {
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
        );
      }
    }
    return '';
  }

  function sessionTimestamp(s) {
    if (s && s.createdAt) {
      var t = Date.parse(s.createdAt);
      if (!isNaN(t)) return t;
    }
    var key = sessionDateKey(s);
    if (key) {
      var p = key.split('-');
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  }

  function daysBetween(fromMs, toMs) {
    return Math.floor((toMs - fromMs) / 86400000);
  }

  function exerciseNamesInSession(s) {
    var names = [];
    (s.exercises || []).forEach(function (ex) {
      if (ex && ex.name) names.push(String(ex.name));
    });
    if (s.blocks) {
      (s.blocks || []).forEach(function (blk) {
        (blk.exercises || []).forEach(function (ex) {
          if (ex && ex.name) names.push(String(ex.name));
        });
      });
    }
    return names;
  }

  function sessionMatchesPattern(s, pattern) {
    return exerciseNamesInSession(s).some(function (name) {
      return pattern.test(name);
    });
  }

  function sessionHasChestWork(s) {
    return exerciseNamesInSession(s).some(function (name) {
      return CHEST_PATTERNS.test(name);
    });
  }

  function daysSinceLastMatch(sessions, pattern) {
    var now = Date.now();
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      });
    for (var i = 0; i < sorted.length; i++) {
      if (sessionMatchesPattern(sorted[i], pattern)) {
        return daysBetween(sessionTimestamp(sorted[i]), now);
      }
    }
    return sorted.length ? 999 : null;
  }

  function avgRecentIntensity(sessions, limit) {
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      })
      .slice(0, limit || 5);
    var sum = 0;
    var n = 0;
    sorted.forEach(function (s) {
      var v = parseInt(s.totalIntensity, 10);
      if (!isNaN(v) && v >= 0) {
        sum += v;
        n += 1;
      }
    });
    return n ? sum / n : null;
  }

  function findLastPushSession(sessions) {
    var sorted = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      });
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      if (s.split && /\bpush\b/i.test(String(s.split))) return s;
      if (s.title && /\bpush\b/i.test(String(s.title))) return s;
      if (sessionMatchesPattern(s, PUSH_PATTERNS)) return s;
    }
    return null;
  }

  function hasSeenInfoGuide() {
    try {
      return localStorage.getItem('strongman-info-seen') === '1';
    } catch (e) {
      return false;
    }
  }

  function hasConsistentUse(sessions) {
    var list = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(a) - sessionTimestamp(b);
      });
    if (list.length < 3) return false;
    var firstMs = sessionTimestamp(list[0]);
    var lastMs = sessionTimestamp(list[list.length - 1]);
    if (daysBetween(firstMs, lastMs) >= 6) return true;
    var dayKeys = {};
    list.forEach(function (s) {
      var k = sessionDateKey(s);
      if (k) dayKeys[k] = true;
    });
    return Object.keys(dayKeys).length >= 4;
  }

  function buildCoachingCallouts(sessions, opts) {
    opts = opts || {};
    var callouts = [];
    var list = (sessions || [])
      .slice()
      .sort(function (a, b) {
        return sessionTimestamp(b) - sessionTimestamp(a);
      });

    if (!list.length) {
      if (!hasSeenInfoGuide()) {
        callouts.push({
          text: 'Woah there — you look new here. Head to the info page and learn what to do on Strongman AI.',
          tone: 'neutral',
          linkHref: '/info',
          linkLabel: 'Open the guide',
        });
      } else {
        callouts.push({
          text: 'No workouts logged yet. The barbell is getting lonely — go say hi.',
          tone: 'tease',
        });
      }
      return callouts;
    }

    if (!hasConsistentUse(list)) {
      callouts.push({
        text: 'You seem new here — better criticism will come after a week of consistent use.',
        tone: 'neutral',
      });
      return callouts;
    }

    var legDays = daysSinceLastMatch(list, LEG_PATTERNS);
    if (legDays != null && legDays >= 10) {
      callouts.push({
        text: "You haven't trained legs in " + legDays + ' days. Talk about a bro split.',
        tone: 'tease',
      });
    }

    var lastPush = findLastPushSession(list);
    if (lastPush && !sessionHasChestWork(lastPush)) {
      var pushLabel = lastPush.split && /\bpush\b/i.test(String(lastPush.split)) ? 'push day' : 'push session';
      callouts.push({
        text:
          "Your last " +
          pushLabel +
          " didn't include any chest work — bench, flies, or push-ups would balance things out.",
        tone: 'tease',
      });
    }

    var avgIntensity = avgRecentIntensity(list, 4);
    if (avgIntensity != null && avgIntensity >= 78) {
      callouts.push({
        text: "You're pushing too hard during your workouts! Slow down before you get injured!",
        tone: 'warn',
      });
    } else if (avgIntensity != null && avgIntensity <= 35 && list.length >= 3) {
      callouts.push({
        text: 'Your last few sessions were softer than a yoga mat. Time to turn up the heat.',
        tone: 'tease',
      });
    }

    var lastSessionMs = sessionTimestamp(list[0]);
    var daysSinceWorkout = daysBetween(lastSessionMs, Date.now());
    if (daysSinceWorkout >= 5) {
      callouts.push({
        text:
          daysSinceWorkout +
          ' days without a workout? Your muscles filed a missing persons report.',
        tone: 'tease',
      });
    }

    var weekSessions = list.filter(function (s) {
      return sessionTimestamp(s) >= Date.now() - 7 * 86400000;
    });
    var armOnlyWeek =
      weekSessions.length >= 2 &&
      weekSessions.every(function (s) {
        var names = exerciseNamesInSession(s).join(' ');
        return ARM_PATTERNS.test(names) && !LEG_PATTERNS.test(names) && !PUSH_PATTERNS.test(names);
      });
    if (armOnlyWeek) {
      callouts.push({
        text: 'Arms every session this week? Even your sleeves are confused.',
        tone: 'tease',
      });
    }

    var pushDays = daysSinceLastMatch(list, PUSH_PATTERNS);
    var pullDays = daysSinceLastMatch(list, PULL_PATTERNS);
    if (pushDays != null && pullDays != null && pushDays <= 3 && pullDays >= 14) {
      callouts.push({
        text: 'All push, no pull — enjoy that hunchback cosplay.',
        tone: 'tease',
      });
    }

    var WS = window.WorkoutSplit;
    if (WS && WS.hasUserConfigured && WS.hasUserConfigured()) {
      var state = WS.load();
      var todayIdx = WS.mondayIndexFromDate(new Date());
      var todayName = (state.days && state.days[todayIdx]) || '';
      if (todayName && !/rest/i.test(todayName)) {
        var todayKey = sessionDateKey({ createdAt: new Date().toISOString() });
        var trainedToday = list.some(function (s) {
          return sessionDateKey(s) === todayKey;
        });
        if (!trainedToday) {
          callouts.push({
            text: 'Today is ' + todayName + ' on your split. The gym is waiting.',
            tone: 'neutral',
          });
        }
      }
    }

    if (!callouts.length) {
      callouts.push({
        text: "You're showing up and training smart. Rocky approves — for now.",
        tone: 'neutral',
      });
    }

    return callouts.slice(0, opts.limit || 4);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCalloutHtml(callout, compact) {
    var tone = callout.tone || 'neutral';
    var linkHtml = callout.linkHref
      ? '<a href="' +
        escapeHtml(callout.linkHref) +
        '" class="' +
        (compact ? 'wd-coach-insight-link' : 'dash-roast-link') +
        '">' +
        escapeHtml(callout.linkLabel || 'Learn more') +
        ' →</a>'
      : '';
    if (compact) {
      return (
        '<article class="wd-coach-insight wd-coach-insight--' +
        tone +
        '" role="listitem"><p class="wd-coach-insight-text">' +
        escapeHtml(callout.text) +
        '</p>' +
        linkHtml +
        '</article>'
      );
    }
    return null;
  }

  function renderInto(container, sessions, opts) {
    opts = opts || {};
    if (!container) return;
    var callouts = buildCoachingCallouts(sessions, opts);
    if (opts.compact) {
      container.innerHTML =
        '<p class="wd-coach-insights-label">Rocky noticed</p>' +
        '<div class="wd-coach-insights-list" role="list">' +
        callouts
          .map(function (c) {
            return renderCalloutHtml(c, true);
          })
          .join('') +
        '</div>';
      return;
    }
    container.innerHTML = '';
    callouts.forEach(function (c) {
      var tone = c.tone || 'neutral';
      var article = document.createElement('article');
      article.className = 'dash-roast-card dash-roast-card--' + tone;
      article.setAttribute('role', 'listitem');
      var icon =
        tone === 'warn'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
          : tone === 'tease'
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.2 3.6L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.4L12 3z"/></svg>';
      var linkHtml = c.linkHref
        ? '<a href="' +
          escapeHtml(c.linkHref) +
          '" class="dash-roast-link">' +
          escapeHtml(c.linkLabel || 'Learn more') +
          ' →</a>'
        : '';
      article.innerHTML =
        '<span class="dash-roast-icon" aria-hidden="true">' +
        icon +
        '</span><div class="dash-roast-copy"><p class="dash-roast-text">' +
        escapeHtml(c.text) +
        '</p>' +
        linkHtml +
        '</div>';
      container.appendChild(article);
    });
  }

  window.RockyCoachingInsights = {
    buildCallouts: buildCoachingCallouts,
    renderInto: renderInto,
    hasConsistentUse: hasConsistentUse,
  };
})();
