/**
 * Editable training timeline — workouts + coach memory + custom life/log events.
 * Some event types also patch athlete settings / Rocky memory.
 */
(function () {
  'use strict';

  var STORAGE_BASE = 'strongman-timeline-events';

  var EQUIPMENT_OPTIONS = [
    { id: 'local', label: 'Full gym' },
    { id: 'home', label: 'Home gym' },
    { id: 'none', label: 'Minimal equipment' },
  ];

  var GOAL_OPTIONS = [
    { id: 'sport_performance', label: 'Sport performance' },
    { id: 'strength', label: 'Max strength' },
    { id: 'aesthetics', label: 'Physique / aesthetics' },
    { id: 'general_health', label: 'General health' },
  ];

  var SEASON_OPTIONS = [
    { id: 'pre_season', label: 'Pre-season' },
    { id: 'in_season', label: 'In-season' },
    { id: 'off_season', label: 'Off-season' },
  ];

  var TYPE_OPTIONS = [
    {
      id: 'injury',
      label: 'Injury / pain',
      hint: 'Rocky will keep this in mind for your plan.',
      updates: 'memory',
      memoryId: 'injury',
      memoryLabel: 'Pain / injury concern',
    },
    {
      id: 'illness',
      label: 'Illness / sick day',
      hint: 'Rocky will ease training while you recover.',
      updates: 'memory',
      memoryId: 'sick',
      memoryLabel: 'Feeling unwell',
    },
    {
      id: 'equipment',
      label: 'Equipment access change',
      hint: 'What can you train with now?',
      updates: 'equipment',
      settingLabel: 'Equipment access',
    },
    {
      id: 'schedule',
      label: 'Schedule / practice change',
      hint: 'Rocky will plan around the new schedule.',
      updates: 'notes',
      memoryId: 'heavy_practice',
      memoryLabel: 'Schedule / practice change',
    },
    {
      id: 'season',
      label: 'Season phase change',
      hint: 'Where are you in the season?',
      updates: 'season',
      settingLabel: 'Season phase',
    },
    {
      id: 'goal',
      label: 'Training goal change',
      hint: 'What are you chasing next?',
      updates: 'goal',
      settingLabel: 'Primary goal',
    },
    {
      id: 'travel',
      label: 'Travel / availability',
      hint: 'Rocky will plan around travel and away weeks.',
      updates: 'memory',
      memoryId: 'travel',
      memoryLabel: 'Travel / away game',
    },
    {
      id: 'deload',
      label: 'Deload / recovery',
      hint: 'Rocky will treat this as a lighter stretch.',
      updates: 'memory',
      memoryId: 'deload',
      memoryLabel: 'Needs lighter week',
    },
    {
      id: 'fatigue',
      label: 'Fatigue / low energy',
      hint: 'Rocky will factor recovery into your next sessions.',
      updates: 'memory',
      memoryId: 'fatigue',
      memoryLabel: 'Fatigue / low energy',
    },
    {
      id: 'sleep',
      label: 'Poor sleep',
      hint: 'Rocky will factor recovery into your next sessions.',
      updates: 'memory',
      memoryId: 'poor_sleep',
      memoryLabel: 'Poor sleep',
    },
    { id: 'milestone', label: 'Milestone / PR', hint: 'Lock in the win on your timeline.', updates: 'none' },
    { id: 'note', label: 'General note', hint: 'Anything else worth remembering.', updates: 'none' },
  ];

  var TYPE_BY_ID = {};
  TYPE_OPTIONS.forEach(function (t) {
    TYPE_BY_ID[t.id] = t;
  });

  var SVG_ATTR =
    ' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  var ICONS = {
    workout:
      '<svg' +
      SVG_ATTR +
      '><path d="M7.5 12h9M4.5 8.5v7M7.5 6.5v11M16.5 6.5v11M19.5 8.5v7"/></svg>',
    injury:
      '<svg' +
      SVG_ATTR +
      '><path d="M12 3v18M8 7h8M9 17h6"/><circle cx="12" cy="12" r="9"/></svg>',
    problem:
      '<svg' +
      SVG_ATTR +
      '><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/></svg>',
    illness:
      '<svg' +
      SVG_ATTR +
      '><rect x="9" y="3" width="6" height="18" rx="2"/><path d="M3 9h18v6H3z"/></svg>',
    equipment:
      '<svg' +
      SVG_ATTR +
      '><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-3.1 3.1-2.6-2.6 3.1-3.1z"/></svg>',
    schedule:
      '<svg' +
      SVG_ATTR +
      '><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    season:
      '<svg' +
      SVG_ATTR +
      '><path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>',
    goal:
      '<svg' +
      SVG_ATTR +
      '><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
    travel:
      '<svg' +
      SVG_ATTR +
      '><path d="M10 17l-5 3 1-5-4-4 5-.5L12 5l1.5 5.5 5 .5-4 4 1 5-5-3z"/></svg>',
    deload:
      '<svg' +
      SVG_ATTR +
      '><path d="M12 4a8 8 0 1 0 8 8"/><path d="M20 4v6h-6"/></svg>',
    fatigue:
      '<svg' +
      SVG_ATTR +
      '><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
    sleep:
      '<svg' +
      SVG_ATTR +
      '><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/></svg>',
    milestone:
      '<svg' +
      SVG_ATTR +
      '><path d="M12 3l2.2 6.6H21l-5.4 4 2.1 6.5L12 16.6 6.3 20l2.1-6.5L3 9.6h6.8L12 3z"/></svg>',
    note:
      '<svg' +
      SVG_ATTR +
      '><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    signal:
      '<svg' +
      SVG_ATTR +
      '><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>',
  };

  function iconForType(type) {
    return ICONS[type] || ICONS.note;
  }

  function typeMeta(type) {
    return TYPE_BY_ID[type] || TYPE_BY_ID.note;
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

  function storageKey() {
    return STORAGE_BASE + userSuffix();
  }

  function loadCustomEvents() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomEvents(events) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify((events || []).slice(-120)));
    } catch (e) {}
  }

  function uid() {
    return 'tl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function dateKeyFromMs(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function parseDateKey(key) {
    if (!key) return 0;
    var p = String(key).slice(0, 10).split('-');
    if (p.length !== 3) return 0;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function sessionDateKey(s) {
    if (s && s.date) return String(s.date).slice(0, 10);
    if (s && s.createdAt) {
      var t = Date.parse(s.createdAt);
      if (!isNaN(t)) return dateKeyFromMs(t);
    }
    return '';
  }

  function sessionTitle(s) {
    return (
      (s && (s.title || s.splitName || s.split)) ||
      (s && s.sessionType === 'cardio' ? 'Cardio' : 'Workout')
    );
  }

  function exerciseCount(s) {
    var n = (s.exercises || []).length;
    (s.blocks || []).forEach(function (b) {
      n += (b.exercises || []).length;
    });
    return n;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDay(dayKey) {
    if (!dayKey) return '';
    var ms = parseDateKey(dayKey);
    if (!ms) return dayKey;
    try {
      return new Date(ms).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return dayKey;
    }
  }

  function typeLabel(type) {
    if (type === 'workout') return 'Workout';
    if (type === 'problem') return 'Problem';
    if (type === 'signal') return 'Note';
    var meta = TYPE_BY_ID[type];
    return meta ? meta.label : 'Note';
  }

  function optionLabel(options, id) {
    for (var i = 0; i < options.length; i++) {
      if (options[i].id === id) return options[i].label;
    }
    return id || '';
  }

  function goalToReason(goal) {
    if (goal === 'general_health') return 'health';
    if (goal === 'sport_performance') return 'sports';
    if (goal === 'aesthetics') return 'aesthetics';
    if (goal === 'strength') return 'strength';
    return 'sports';
  }

  function extractBodyPart(text) {
    var m = /\b(chest|pecs?|knee|knees|shoulder|shoulders|lower back|upper back|back|elbow|elbows|wrist|wrists|hip|hips|ankle|ankles|neck|hamstring|hamstrings|quad|quads|glute|glutes|bicep|biceps|tricep|triceps|abs|core|calf|calves|forearm|forearms|trap|traps|groin|achilles)\b/i.exec(
      String(text || '')
    );
    return m ? m[1].toLowerCase() : '';
  }

  function appendKnownNotes(existing, line) {
    var base = String(existing || '').trim();
    var add = String(line || '').trim();
    if (!add) return base;
    if (!base) return add;
    if (base.indexOf(add) !== -1) return base;
    var next = base + '\n' + add;
    return next.length > 1200 ? next.slice(-1200) : next;
  }

  function pushCoachMemory(hit) {
    if (!window.CoachMemory || typeof window.CoachMemory.load !== 'function') return;
    var items = window.CoachMemory.load() || [];
    var key = (hit.id || '') + '::' + (hit.bodyPart || '');
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      var k = (items[i].id || '') + '::' + (items[i].bodyPart || '');
      if (k === key) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) items[idx] = hit;
    else items.push(hit);
    if (typeof window.CoachMemory.save === 'function') window.CoachMemory.save(items);
  }

  function patchUserProfile(partial, ctxPartial) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id) return Promise.resolve(null);

    var payload = Object.assign({}, partial || {});
    if (ctxPartial) {
      var prevCtx =
        u.athleteContext && typeof u.athleteContext === 'object' ? u.athleteContext : {};
      payload.athleteContext = Object.assign({}, prevCtx, ctxPartial);
    }

    var localNext = Object.assign({}, u, partial || {});
    if (payload.athleteContext) localNext.athleteContext = payload.athleteContext;
    if (typeof window.setCurrentUser === 'function') window.setCurrentUser(localNext);

    if (typeof window.apiPut !== 'function') return Promise.resolve(localNext);
    return window
      .apiPut('/users/' + u.id, payload)
      .then(function (res) {
        return res.json().then(function (body) {
          if (res.ok && body && body.user && typeof window.setCurrentUser === 'function') {
            window.setCurrentUser(body.user);
            return body.user;
          }
          return localNext;
        });
      })
      .catch(function () {
        return localNext;
      });
  }

  function applySideEffects(ev) {
    var meta = typeMeta(ev.type);
    var combined = [ev.title, ev.detail].filter(Boolean).join(' — ');
    var settingVal = ev.settingValue || '';
    var dayLabel = formatDay(ev.date) || ev.date || 'today';
    var noteLine = '';

    if (meta.updates === 'memory' || meta.updates === 'notes') {
      var bodyPart = extractBodyPart(combined);
      var memLabel = meta.memoryLabel || meta.label;
      if (bodyPart && (ev.type === 'injury' || ev.type === 'problem')) {
        memLabel = memLabel + ' (' + bodyPart + ')';
      }
      pushCoachMemory({
        id: meta.memoryId || ev.type,
        bodyPart: bodyPart || null,
        label: memLabel,
        snippet: (combined || '').slice(0, 140),
        at: ev.at || Date.now(),
        source: 'timeline',
      });
    }

    if (meta.updates === 'equipment' && settingVal) {
      noteLine =
        '[' +
        dayLabel +
        '] Equipment access → ' +
        optionLabel(EQUIPMENT_OPTIONS, settingVal) +
        (ev.detail ? ' (' + ev.detail + ')' : '');
      var uEq = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var knEq =
        uEq && uEq.athleteContext && uEq.athleteContext.knownNotes
          ? uEq.athleteContext.knownNotes
          : '';
      return patchUserProfile(
        { equipment: settingVal },
        { knownNotes: appendKnownNotes(knEq, noteLine) }
      );
    }

    if (meta.updates === 'goal' && settingVal) {
      noteLine =
        '[' +
        dayLabel +
        '] Primary goal → ' +
        optionLabel(GOAL_OPTIONS, settingVal) +
        (ev.detail ? ' (' + ev.detail + ')' : '');
      var uGoal = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var knGoal =
        uGoal && uGoal.athleteContext && uGoal.athleteContext.knownNotes
          ? uGoal.athleteContext.knownNotes
          : '';
      return patchUserProfile(
        { reason: goalToReason(settingVal) },
        {
          primaryGoal: settingVal,
          knownNotes: appendKnownNotes(knGoal, noteLine),
        }
      );
    }

    if (meta.updates === 'season' && settingVal) {
      noteLine =
        '[' +
        dayLabel +
        '] Season phase → ' +
        optionLabel(SEASON_OPTIONS, settingVal) +
        (ev.detail ? ' (' + ev.detail + ')' : '');
      var uSea = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var knSea =
        uSea && uSea.athleteContext && uSea.athleteContext.knownNotes
          ? uSea.athleteContext.knownNotes
          : '';
      var ctxSea = {
        seasonPhase: settingVal,
        knownNotes: appendKnownNotes(knSea, noteLine),
      };
      /* keep primary sport season in sync when present */
      if (uSea && uSea.athleteContext && Array.isArray(uSea.athleteContext.sports)) {
        ctxSea.sports = uSea.athleteContext.sports.map(function (s) {
          if (!s) return s;
          if (s.isPrimary || uSea.athleteContext.sports.length === 1) {
            return Object.assign({}, s, { seasonPhase: settingVal });
          }
          return s;
        });
      }
      return patchUserProfile({}, ctxSea);
    }

    if (meta.updates === 'notes' || meta.updates === 'memory') {
      noteLine =
        '[' + dayLabel + '] ' + (meta.label || ev.type) + ': ' + (combined || ev.title || '');
      var uNote = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      var kn =
        uNote && uNote.athleteContext && uNote.athleteContext.knownNotes
          ? uNote.athleteContext.knownNotes
          : '';
      return patchUserProfile({}, { knownNotes: appendKnownNotes(kn, noteLine) });
    }

    return Promise.resolve(null);
  }

  function collectEvents(sessions) {
    var events = [];

    (sessions || []).forEach(function (s) {
      var day = sessionDateKey(s);
      if (!day) return;
      var ts = s.createdAt ? Date.parse(s.createdAt) : parseDateKey(day);
      var n = exerciseCount(s);
      events.push({
        id: 'workout_' + (s.id || s.clientId || day + '_' + ts),
        source: 'workout',
        type: 'workout',
        editable: false,
        date: day,
        at: isNaN(ts) ? parseDateKey(day) : ts,
        title: sessionTitle(s),
        detail:
          (n ? n + ' exercise' + (n === 1 ? '' : 's') : 'Session logged') +
          (s.totalIntensity != null && s.totalIntensity !== ''
            ? ' · intensity ' + s.totalIntensity
            : ''),
        href: '/log#progress',
      });
    });

    if (window.CoachMemory && typeof window.CoachMemory.load === 'function') {
      window.CoachMemory.load().forEach(function (item) {
        if (!item) return;
        if (item.source === 'timeline') return;
        var at = 0;
        if (typeof item.at === 'number' && !isNaN(item.at)) at = item.at;
        else if (item.at) at = Date.parse(item.at) || 0;
        var day = dateKeyFromMs(at) || dateKeyFromMs(Date.now());
        var kind =
          item.id === 'injury' || item.id === 'sore'
            ? 'injury'
            : item.id === 'deload'
              ? 'deload'
              : item.id === 'sick'
                ? 'illness'
                : item.id === 'travel'
                  ? 'travel'
                  : item.id === 'fatigue'
                    ? 'fatigue'
                    : item.id === 'poor_sleep'
                      ? 'sleep'
                      : 'problem';
        events.push({
          id: 'mem_' + (item.id || 'sig') + '_' + (item.at || day),
          source: 'memory',
          type: kind,
          editable: false,
          date: day,
          at: at || parseDateKey(day),
          title: item.label || 'Rocky noted a problem',
          detail: item.bodyPart
            ? item.bodyPart + (item.snippet ? ' — ' + item.snippet : '')
            : item.snippet || '',
        });
      });
    }

    loadCustomEvents().forEach(function (ev) {
      if (!ev || !ev.id) return;
      events.push({
        id: ev.id,
        source: 'custom',
        type: ev.type || 'note',
        editable: true,
        date: ev.date || dateKeyFromMs(ev.at),
        at: ev.at || parseDateKey(ev.date),
        title: ev.title || 'Note',
        detail: ev.detail || '',
        settingValue: ev.settingValue || '',
        appliedSettings: !!ev.appliedSettings,
      });
    });

    events.sort(function (a, b) {
      return (b.at || 0) - (a.at || 0);
    });
    return events;
  }

  function upsertCustom(ev) {
    var list = loadCustomEvents();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === ev.id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) list[idx] = ev;
    else list.push(ev);
    saveCustomEvents(list);
  }

  function removeCustom(id) {
    saveCustomEvents(
      loadCustomEvents().filter(function (e) {
        return e.id !== id;
      })
    );
  }

  function closeEditor(root) {
    var ed = root.querySelector('.dash-timeline-editor');
    if (ed) ed.hidden = true;
  }

  function settingOptionsForType(type) {
    if (type === 'equipment') return EQUIPMENT_OPTIONS;
    if (type === 'goal') return GOAL_OPTIONS;
    if (type === 'season') return SEASON_OPTIONS;
    return null;
  }

  function syncSettingField(ed, type, existingValue) {
    if (!ed) return;
    var wrap = ed.querySelector('.dash-timeline-setting');
    var sel = ed.querySelector('[name="tl-setting"]');
    var hint = ed.querySelector('.dash-timeline-setting-hint');
    var meta = typeMeta(type);
    var opts = settingOptionsForType(type);
    if (hint) hint.textContent = meta.hint || '';
    if (!wrap || !sel) return;
    if (!opts) {
      wrap.hidden = true;
      sel.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    var label = wrap.querySelector('span');
    if (label) label.textContent = meta.settingLabel || 'Details';
    sel.innerHTML = opts
      .map(function (o) {
        return '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.label) + '</option>';
      })
      .join('');
    var prefer = existingValue;
    if (!prefer && type === 'equipment') {
      try {
        var u = window.getCurrentUser && window.getCurrentUser();
        prefer = (u && u.equipment) || 'home';
      } catch (e) {}
    }
    if (!prefer && type === 'goal') {
      try {
        var ug = window.getCurrentUser && window.getCurrentUser();
        prefer =
          (ug && ug.athleteContext && ug.athleteContext.primaryGoal) || 'sport_performance';
      } catch (e2) {}
    }
    if (!prefer && type === 'season') {
      try {
        var us = window.getCurrentUser && window.getCurrentUser();
        prefer = (us && us.athleteContext && us.athleteContext.seasonPhase) || 'in_season';
      } catch (e3) {}
    }
    if (prefer) sel.value = prefer;
  }

  function openEditor(root, existing) {
    var ed = root.querySelector('.dash-timeline-editor');
    if (!ed) return;
    ed.hidden = false;
    var idEl = ed.querySelector('[name="tl-id"]');
    var typeEl = ed.querySelector('[name="tl-type"]');
    var dateEl = ed.querySelector('[name="tl-date"]');
    var titleEl = ed.querySelector('[name="tl-title"]');
    var detailEl = ed.querySelector('[name="tl-detail"]');
    var heading = ed.querySelector('.dash-timeline-editor-title');
    if (existing) {
      if (heading) heading.textContent = 'Edit timeline entry';
      if (idEl) idEl.value = existing.id || '';
      if (typeEl) typeEl.value = existing.type || 'note';
      if (dateEl) dateEl.value = existing.date || dateKeyFromMs(Date.now());
      if (titleEl) titleEl.value = existing.title || '';
      if (detailEl) detailEl.value = existing.detail || '';
      syncSettingField(ed, existing.type || 'note', existing.settingValue || '');
    } else {
      if (heading) heading.textContent = 'Add to timeline';
      if (idEl) idEl.value = '';
      if (typeEl) typeEl.value = 'injury';
      if (dateEl) dateEl.value = dateKeyFromMs(Date.now());
      if (titleEl) titleEl.value = '';
      if (detailEl) detailEl.value = '';
      syncSettingField(ed, 'injury', '');
    }
    if (titleEl) titleEl.focus();
  }

  function render(root, sessions, opts) {
    opts = opts || {};
    if (!root) return;
    var limit = opts.limit || 28;
    var events = collectEvents(sessions).slice(0, limit);
    var typeOpts = TYPE_OPTIONS.map(function (t) {
      return '<option value="' + t.id + '">' + escapeHtml(t.label) + '</option>';
    }).join('');

    var rowsHtml = events.length
      ? events
          .map(function (ev) {
            var actions = ev.editable
              ? '<div class="dash-timeline-actions">' +
                '<button type="button" class="dash-timeline-action" data-tl-edit="' +
                escapeHtml(ev.id) +
                '">Edit</button>' +
                '<button type="button" class="dash-timeline-action dash-timeline-action--danger" data-tl-delete="' +
                escapeHtml(ev.id) +
                '">Delete</button>' +
                '</div>'
              : ev.href
                ? '<a class="dash-timeline-action" href="' + escapeHtml(ev.href) + '">Open</a>'
                : '';
            var valueChip =
              ev.settingValue &&
              (ev.type === 'equipment' || ev.type === 'goal' || ev.type === 'season')
                ? '<span class="dash-timeline-chip">' +
                  escapeHtml(
                    ev.type === 'equipment'
                      ? optionLabel(EQUIPMENT_OPTIONS, ev.settingValue)
                      : ev.type === 'goal'
                        ? optionLabel(GOAL_OPTIONS, ev.settingValue)
                        : optionLabel(SEASON_OPTIONS, ev.settingValue)
                  ) +
                  '</span>'
                : '';
            return (
              '<li class="dash-timeline-item dash-timeline-item--' +
              escapeHtml(ev.type) +
              '" data-tl-id="' +
              escapeHtml(ev.id) +
              '">' +
              '<span class="dash-timeline-icon" title="' +
              escapeHtml(typeLabel(ev.type)) +
              '" aria-hidden="true">' +
              iconForType(ev.type) +
              '</span>' +
              '<div class="dash-timeline-body">' +
              '<div class="dash-timeline-meta">' +
              '<time datetime="' +
              escapeHtml(ev.date) +
              '">' +
              escapeHtml(formatDay(ev.date)) +
              '</time>' +
              '<span class="dash-timeline-type">' +
              escapeHtml(typeLabel(ev.type)) +
              '</span>' +
              valueChip +
              '</div>' +
              '<p class="dash-timeline-title">' +
              escapeHtml(ev.title) +
              '</p>' +
              (ev.detail
                ? '<p class="dash-timeline-detail">' + escapeHtml(ev.detail) + '</p>'
                : '') +
              actions +
              '</div></li>'
            );
          })
          .join('')
      : '<li class="dash-timeline-empty">No timeline entries yet. Log a workout or add an injury, equipment change, or note.</li>';

    root.innerHTML =
      '<div class="dash-timeline-toolbar">' +
      '<button type="button" class="dash-timeline-add" id="dash-timeline-add">Add entry</button>' +
      '</div>' +
      '<div class="dash-timeline-editor" hidden>' +
      '<p class="dash-timeline-editor-title">Add to timeline</p>' +
      '<input type="hidden" name="tl-id" value="">' +
      '<label class="dash-timeline-field"><span>Type</span><select name="tl-type">' +
      typeOpts +
      '</select></label>' +
      '<p class="dash-timeline-setting-hint"></p>' +
      '<label class="dash-timeline-field dash-timeline-setting" hidden><span>Details</span><select name="tl-setting"></select></label>' +
      '<label class="dash-timeline-field"><span>Date</span><input type="date" name="tl-date"></label>' +
      '<label class="dash-timeline-field"><span>Title</span><input type="text" name="tl-title" maxlength="80" placeholder="e.g. Left knee flared up"></label>' +
      '<label class="dash-timeline-field"><span>Details</span><textarea name="tl-detail" rows="2" maxlength="240" placeholder="Optional note — what changed and why"></textarea></label>' +
      '<div class="dash-timeline-editor-actions">' +
      '<button type="button" class="dash-timeline-save">Save</button>' +
      '<button type="button" class="dash-timeline-cancel">Cancel</button>' +
      '</div></div>' +
      '<ol class="dash-timeline-list" role="list">' +
      rowsHtml +
      '</ol>';

    var addBtn = root.querySelector('#dash-timeline-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        openEditor(root, null);
      });
    }
    var cancelBtn = root.querySelector('.dash-timeline-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        closeEditor(root);
      });
    }
    var typeSel = root.querySelector('[name="tl-type"]');
    if (typeSel) {
      typeSel.addEventListener('change', function () {
        var ed = root.querySelector('.dash-timeline-editor');
        syncSettingField(ed, typeSel.value, '');
      });
    }
    var saveBtn = root.querySelector('.dash-timeline-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var ed = root.querySelector('.dash-timeline-editor');
        var idVal = (ed.querySelector('[name="tl-id"]').value || '').trim();
        var typeVal = ed.querySelector('[name="tl-type"]').value || 'note';
        var dateVal = ed.querySelector('[name="tl-date"]').value || dateKeyFromMs(Date.now());
        var titleVal = (ed.querySelector('[name="tl-title"]').value || '').trim();
        var detailVal = (ed.querySelector('[name="tl-detail"]').value || '').trim();
        var settingEl = ed.querySelector('[name="tl-setting"]');
        var settingVal =
          settingEl && !ed.querySelector('.dash-timeline-setting').hidden
            ? settingEl.value || ''
            : '';
        if (!titleVal) {
          ed.querySelector('[name="tl-title"]').focus();
          return;
        }
        if (settingOptionsForType(typeVal) && !settingVal) {
          if (settingEl) settingEl.focus();
          return;
        }
        var meta = typeMeta(typeVal);
        if (!titleVal && settingVal) {
          titleVal =
            (meta.label || typeVal) +
            ': ' +
            (typeVal === 'equipment'
              ? optionLabel(EQUIPMENT_OPTIONS, settingVal)
              : typeVal === 'goal'
                ? optionLabel(GOAL_OPTIONS, settingVal)
                : optionLabel(SEASON_OPTIONS, settingVal));
        }
        var ev = {
          id: idVal || uid(),
          type: typeVal,
          date: dateVal,
          at: parseDateKey(dateVal) || Date.now(),
          title: titleVal,
          detail: detailVal,
          settingValue: settingVal,
          updatedAt: new Date().toISOString(),
          appliedSettings: false,
        };
        var finish = function () {
          ev.appliedSettings = meta.updates && meta.updates !== 'none';
          upsertCustom(ev);
          render(root, sessions, opts);
          try {
            window.dispatchEvent(new CustomEvent('strongman:timeline-updated'));
          } catch (e) {}
        };
        applySideEffects(ev).then(finish).catch(finish);
      });
    }

    root.querySelectorAll('[data-tl-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-tl-edit');
        var found = loadCustomEvents().filter(function (e) {
          return e.id === id;
        })[0];
        if (found) openEditor(root, found);
      });
    });
    root.querySelectorAll('[data-tl-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-tl-delete');
        if (!id) return;
        if (!window.confirm('Delete this timeline entry?')) return;
        removeCustom(id);
        render(root, sessions, opts);
        try {
          window.dispatchEvent(new CustomEvent('strongman:timeline-updated'));
        } catch (e) {}
      });
    });
  }

  function mount(selectorOrEl, sessions, opts) {
    var el =
      typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) return;
    render(el, sessions, opts);
  }

  window.TrainingTimeline = {
    collectEvents: collectEvents,
    loadCustomEvents: loadCustomEvents,
    saveCustomEvents: saveCustomEvents,
    upsertCustom: upsertCustom,
    removeCustom: removeCustom,
    iconForType: iconForType,
    typeMeta: typeMeta,
    TYPE_OPTIONS: TYPE_OPTIONS,
    mount: mount,
    render: render,
  };
})();
