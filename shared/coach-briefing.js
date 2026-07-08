(function () {
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSnapshot(user) {
    var AC = window.AthleteContext;
    var CM = window.CoachMemory;
    if (!AC) return { profile: [], tracking: [], focus: [], empty: true };

    var ctx = AC.loadAthleteContext(user);
    var hint = AC.getTodayTrainingHint(user);
    var sports = AC.getSports ? AC.getSports(ctx) : [];
    var memory = CM ? CM.load() : [];

    var profile = [];
    if (hint && hint.label) {
      profile.push({
        label: 'Today',
        value: hint.label + ' — ' + hint.hint,
      });
    }
    if (sports.length) {
      sports.forEach(function (entry) {
        var comp = AC.competitionLabelForEntry
          ? AC.competitionLabelForEntry(entry)
          : 'Game';
        var sportVal = entry.sport;
        if (entry.programType && AC.PROGRAM_LABELS && AC.PROGRAM_LABELS[entry.programType]) {
          sportVal += ' · ' + AC.PROGRAM_LABELS[entry.programType];
        }
        if (entry.position) sportVal += ' · ' + entry.position;
        var phase =
          AC.resolveSeasonPhase && entry
            ? AC.resolveSeasonPhase(entry)
            : entry.seasonPhase;
        if (phase && AC.SEASON_LABELS[phase]) {
          sportVal += ' · ' + AC.SEASON_LABELS[phase];
        }
        var practice = AC.formatWeekdays
          ? AC.formatWeekdays(entry.practiceDays)
          : '';
        if (practice) sportVal += ' · Practice ' + practice;
        var games = AC.formatWeekdays ? AC.formatWeekdays(entry.gameDays) : '';
        if (games) sportVal += ' · ' + comp + ' ' + games;
        profile.push({
          label: sports.length > 1 ? entry.sport : 'Sport',
          value: sportVal,
        });
      });
    } else if (ctx.sport) {
      var sportVal = ctx.sport;
      if (ctx.position) sportVal += ' · ' + ctx.position;
      profile.push({ label: 'Sport', value: sportVal });
    }
    if (ctx.primaryGoal && AC.GOAL_LABELS[ctx.primaryGoal]) {
      profile.push({ label: 'Goal', value: AC.GOAL_LABELS[ctx.primaryGoal] });
    }
    if (ctx.schoolNightMaxMinutes) {
      profile.push({
        label: 'Weeknight cap',
        value: ctx.schoolNightMaxMinutes + ' min',
      });
    }

    var primary = AC.getPrimarySport ? AC.getPrimarySport(ctx) : null;
    var sp = primary && AC.getSportRecordForEntry
      ? AC.getSportRecordForEntry(primary)
      : AC.getSportRecord(ctx);
    var comp = AC.competitionLabel(ctx);

    var tracking = memory.map(function (m) {
      return {
        label: m.label,
        detail: m.snippet ? 'You said: “' + m.snippet + '”' : 'Mentioned in this chat',
      };
    });

    var focus = [];
    if (sp && sp.liftingFocus) {
      focus.push({ text: sp.liftingFocus });
    }
    if (sp && sp.avoidBeforeCompetition && hint && (hint.kind === 'game' || hint.kind === 'practice')) {
      focus.push({ text: 'Before competition: avoid ' + sp.avoidBeforeCompetition });
    }
    var seasonTip = AC.getSeasonTip(user);
    if (seasonTip && seasonTip !== (sp && sp.liftingFocus)) {
      focus.push({ text: seasonTip });
    }
    if (
      memory.some(function (m) {
        return m.id === 'sick' || m.id === 'injury';
      })
    ) {
      focus.push({ text: 'Recovery first — we scale intensity down till you feel right.' });
    }
    if (
      memory.some(function (m) {
        return m.id === 'fatigue' || m.id === 'poor_sleep' || m.id === 'heavy_practice';
      })
    ) {
      focus.push({ text: 'Short gym work today — protect your legs for practice.' });
    }
    if (user && user.experience) {
      var exp =
        AC.EXPERIENCE_LABELS && AC.EXPERIENCE_LABELS[user.experience]
          ? AC.EXPERIENCE_LABELS[user.experience]
          : user.experience;
      profile.push({ label: 'Experience', value: exp });
    }

    return {
      profile: profile,
      tracking: tracking,
      focus: focus,
      hint: hint,
      ctx: ctx,
      comp: comp,
      empty: !profile.length && !tracking.length && !focus.length,
    };
  }

  function buildParagraphSummary(user) {
    var snap = buildSnapshot(user);
    if (snap.empty) return '';

    var AC = window.AthleteContext;
    var ctx = snap.ctx || {};
    var hint = snap.hint;
    var sports = AC.getSports ? AC.getSports(ctx) : [];
    var lines = [];

    var who = [];
    if (sports.length) {
      var sportBits = sports.map(function (entry) {
        var bit = entry.sport;
        if (entry.programType && AC.PROGRAM_LABELS && AC.PROGRAM_LABELS[entry.programType]) {
          bit += ' (' + AC.PROGRAM_LABELS[entry.programType].toLowerCase() + ')';
        }
        if (entry.position) bit += ' — ' + entry.position;
        return bit;
      });
      who.push('playing ' + sportBits.join(' and '));
    } else if (ctx.sport) {
      who.push('a ' + ctx.sport + (ctx.position ? ' (' + ctx.position + ')' : '') + ' athlete');
    }
    if (ctx.primaryGoal && AC.GOAL_LABELS[ctx.primaryGoal]) {
      who.push('focused on ' + AC.GOAL_LABELS[ctx.primaryGoal].toLowerCase());
    }
    if (who.length) {
      lines.push("Alright — I know you're " + who.join(', ') + '.');
    } else {
      lines.push("Alright — fill in your setup so I know what we're working with.");
    }

    var scheduleBits = [];
    sports.forEach(function (entry) {
      var comp = AC.competitionLabelForEntry
        ? AC.competitionLabelForEntry(entry)
        : 'Game';
      var practice = AC.formatWeekdays
        ? AC.formatWeekdays(entry.practiceDays)
        : '';
      var games = AC.formatWeekdays ? AC.formatWeekdays(entry.gameDays) : '';
      if (practice || games) {
        var bit = entry.sport + ':';
        if (practice) bit += ' practice ' + practice;
        if (games) bit += (practice ? ';' : '') + ' ' + comp.toLowerCase() + ' ' + games;
        scheduleBits.push(bit);
      }
    });
    if (!scheduleBits.length) {
      var comp = snap.comp || 'Game';
      var practice = (ctx.practiceDays || [])
        .map(function (p) {
          return AC.WEEKDAY_SHORT[p.weekday] || '';
        })
        .filter(Boolean);
      if (practice.length) {
        scheduleBits.push('practice ' + practice.join(', '));
      }
      var games = (ctx.gameDays || [])
        .map(function (g) {
          return AC.WEEKDAY_SHORT[g.weekday] || '';
        })
        .filter(Boolean);
      if (games.length) {
        scheduleBits.push(comp.toLowerCase() + ' days ' + games.join(', '));
      }
    }
    if (scheduleBits.length) {
      lines.push('Your week: ' + scheduleBits.join('; ') + '.');
    }

    if (ctx.schoolNightMaxMinutes) {
      lines.push(
        'School nights I keep gym time under ' + ctx.schoolNightMaxMinutes + ' minutes — no marathon sessions.'
      );
    }

    if (hint && hint.label) {
      lines.push('Today: ' + hint.label + '. ' + hint.hint);
    }

    if (snap.tracking.length) {
      var labels = snap.tracking.map(function (t) {
        return t.label.toLowerCase();
      });
      var last = labels.pop();
      var mention =
        labels.length > 0 ? labels.join(', ') + ', and ' + last : last;
      lines.push('You told me about ' + mention + " — I'm building around that.");
    } else {
      lines.push("If you're beat up, sick, or short on sleep — say so. I'll adjust.");
    }

    if (snap.focus.length) {
      lines.push(snap.focus[0].text);
    }

    return lines.join(' ');
  }

  function buildSummaryHtml(user) {
    var paragraph = buildParagraphSummary(user);
    if (!paragraph) return '';

    return (
      '<div class="coach-briefing-summary">' +
      '<h3 class="coach-briefing-heading">What I know</h3>' +
      '<p class="coach-briefing-paragraph">' +
      escapeHtml(paragraph) +
      '</p>' +
      '<a href="/customize" class="coach-briefing-link">Update your setup →</a>' +
      '</div>'
    );
  }

  function mountHtml(el, html) {
    if (!el) return;
    if (!html) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = html;
  }

  function render(el, user, opts) {
    opts = opts || {};
    var html = buildSummaryHtml(user);
    mountHtml(el, html);
    if (opts.mobileEl) mountHtml(opts.mobileEl, html);
  }

  window.CoachBriefing = {
    buildSnapshot: buildSnapshot,
    buildParagraphSummary: buildParagraphSummary,
    render: render,
  };
})();
