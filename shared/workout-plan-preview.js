(function () {
  var CATEGORY_WHY = {
    press:
      'Builds upper-body pressing strength and shoulder stability — useful for power, contact, and overhead sport demands.',
    squat_dead:
      'Develops leg drive and posterior chain strength — the base for sprinting, jumping, and change of direction.',
    accessory:
      'Supports balanced strength and durability so you stay healthy through a long season.',
    events:
      'Trains full-body power, grip, and work capacity — translates to explosive sport movements.',
    carry:
      'Improves core bracing and loaded locomotion — helps you stay strong through contact and fatigue.',
  };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function goalPhrase(goal) {
    if (goal === 'aesthetics') return 'physique and muscle development';
    if (goal === 'strength') return 'max strength';
    if (goal === 'general_health') return 'general health and durability';
    return 'sport performance';
  }

  function guessCategory(name) {
    var n = String(name || '').toLowerCase();
    if (/\b(squat|deadlift|rdl|lunge|leg press|hip thrust|good morning)\b/.test(n)) {
      return 'squat_dead';
    }
    if (/\b(press|bench|push|ohp|shoulder)\b/.test(n)) {
      return 'press';
    }
    if (/\b(carry|walk|yoke|farmer|sandbag)\b/.test(n)) {
      return 'carry';
    }
    if (/\b(row|curl|raise|pulldown|pull-up|chin|face pull|plank|core)\b/.test(n)) {
      return 'accessory';
    }
    return 'accessory';
  }

  function resolveExerciseWhy(ex, opts) {
    opts = opts || {};
    if (ex && ex.why && String(ex.why).trim()) return String(ex.why).trim();

    var ctx = opts.athleteContext || {};
    var sp = opts.sportRecord;
    var sport = ctx.sport || (sp && sp.name) || 'your sport';
    var goal = goalPhrase(ctx.primaryGoal);

    var dbEx = null;
    if (window.ExerciseDatabase && ex && ex.name) {
      dbEx = window.ExerciseDatabase.findByName(ex.name);
      if (!dbEx && window.ExerciseDatabase.search) {
        var hits = window.ExerciseDatabase.search({ q: ex.name, limit: 1 });
        if (hits && hits.length) dbEx = hits[0];
      }
    }

    var cat = dbEx ? dbEx.category : guessCategory(ex && ex.name);
    var base = CATEGORY_WHY[cat] || CATEGORY_WHY.accessory;

    if (sp && sp.commonMuscles && sp.commonMuscles.length) {
      return (
        'Supports ' +
        goal +
        ' for ' +
        sport +
        ' by training ' +
        cat.replace('_', ' ') +
        ' patterns that feed ' +
        sp.commonMuscles.slice(0, 3).join(', ') +
        '.'
      );
    }

    return 'Chosen for ' + goal + ' in ' + sport + '. ' + base;
  }

  function exerciseWhyIcon(ex, opts) {
    if (ex && (ex.medicalOverview || ex.citation)) return '';
    var why = resolveExerciseWhy(ex, opts);
    if (!why || !window.InfoTip) return '';
    return window.InfoTip.customIconHtml(why, 'Why this is good for you');
  }

  function renderExerciseRow(ex, opts) {
    var medical =
      ex && typeof ex.medicalOverview === 'string' ? ex.medicalOverview.trim() : '';
    var citation = ex && typeof ex.citation === 'string' ? ex.citation.trim() : '';
    var EC = window.CoachExpandCard;
    if (EC && typeof EC.renderExpandCard === 'function' && (medical || citation)) {
      return EC.renderExpandCard({
        variant: 'exercise',
        text: ex.name,
        meta: ex.prescription || '',
        why: ex.why || resolveExerciseWhy(ex, opts),
        medicalOverview: medical,
        citation: citation,
        forceExpand: false,
      });
    }
    var li = document.createElement('li');
    li.className = 'coach-workout-ex';
    var nameWrap = document.createElement('span');
    nameWrap.className = 'coach-workout-ex-name';
    nameWrap.innerHTML = escapeHtml(ex.name) + exerciseWhyIcon(ex, opts);
    li.appendChild(nameWrap);
    if (ex.prescription) {
      var rx = document.createElement('span');
      rx.className = 'coach-workout-ex-rx';
      rx.textContent = ex.prescription;
      li.appendChild(rx);
    }
    return li;
  }

  function workoutToPlainText(workout) {
    if (!workout) return '';
    var lines = [];
    if (workout.title) lines.push('Session title: ' + workout.title);
    if (workout.focus) lines.push('Split / focus: ' + workout.focus);
    (workout.blocks || []).forEach(function (block) {
      if (block.name) lines.push(String(block.name).toUpperCase());
      (block.exercises || []).forEach(function (ex) {
        if (!ex || !ex.name) return;
        var line = ex.name;
        if (ex.prescription) line += ' · ' + ex.prescription;
        lines.push(line);
      });
      lines.push('');
    });
    (workout.notes || []).forEach(function (n) {
      lines.push('NOTES: ' + (typeof n === 'string' ? n : n.text || ''));
    });
    return lines.join('\n').trim();
  }

  function renderWorkoutPreview(workout, opts) {
    opts = opts || {};
    if (!workout) return document.createElement('div');

    var wrap = document.createElement('div');
    wrap.className = 'coach-workout-preview';

    var rockyBlock = document.createElement('div');
    rockyBlock.className = 'coach-workout-rocky';
    rockyBlock.innerHTML =
      '<div class="coach-workout-rocky-badge"><span class="coach-workout-rocky-mark" aria-hidden="true">R</span> Built by Rocky</div>';
    var fyiText = opts.rockyFyi || workout.fyi || '';
    if (fyiText) {
      var EC = window.CoachExpandCard;
      if (EC && typeof EC.renderExpandCard === 'function') {
        var fyiMedical =
          typeof workout.fyiMedicalOverview === 'string'
            ? workout.fyiMedicalOverview.trim()
            : '';
        rockyBlock.appendChild(
          EC.renderExpandCard({
            variant: 'fyi',
            text: String(fyiText).trim(),
            medicalOverview: fyiMedical,
            citation:
              typeof workout.fyiCitation === 'string' ? workout.fyiCitation.trim() : '',
            forceExpand: false,
          })
        );
      } else {
        var fyi = document.createElement('p');
        fyi.className = 'coach-workout-rocky-fyi';
        fyi.textContent = String(fyiText).trim();
        rockyBlock.appendChild(fyi);
      }
    }
    wrap.appendChild(rockyBlock);

    var planId = 'coach-workout-plan-' + Math.random().toString(36).slice(2, 9);

    var head = document.createElement('div');
    head.className = 'coach-workout-head';
    head.id = planId;
    var metaParts = [];
    if (workout.durationMin) metaParts.push(workout.durationMin + ' min');
    if (opts.metaLine) metaParts.push(opts.metaLine);
    if (workout.focus) metaParts.push(workout.focus);
    head.innerHTML =
      '<h3 class="coach-workout-title">' +
      escapeHtml(workout.title || 'Training session') +
      '</h3>' +
      (metaParts.length
        ? '<p class="coach-workout-meta">' + escapeHtml(metaParts.join(' · ')) + '</p>'
        : '');

    wrap.appendChild(head);

    (workout.blocks || []).forEach(function (block) {
      var section = document.createElement('section');
      section.className = 'coach-workout-block';
      if (block.name) {
        var h = document.createElement('h4');
        h.className = 'coach-workout-block-name';
        h.textContent = block.name;
        section.appendChild(h);
      }
      var list = document.createElement('ul');
      list.className = 'coach-workout-ex-list';
      (block.exercises || []).forEach(function (ex) {
        if (!ex || !ex.name) return;
        var row = renderExerciseRow(ex, opts);
        if (row.tagName === 'LI') list.appendChild(row);
        else {
          var li = document.createElement('li');
          li.className = 'coach-workout-ex coach-workout-ex--expand';
          li.appendChild(row);
          list.appendChild(li);
        }
      });
      section.appendChild(list);
      wrap.appendChild(section);
    });

    if (workout.notes && workout.notes.length) {
      var notes = document.createElement('div');
      notes.className = 'coach-workout-notes';
      var notesLabel = document.createElement('p');
      notesLabel.className = 'coach-workout-notes-label';
      notesLabel.textContent = 'Notes';
      notes.appendChild(notesLabel);
      var notesList = document.createElement('div');
      notesList.className = 'coach-workout-notes-list';
      workout.notes.forEach(function (n) {
        var text = typeof n === 'string' ? n : n && n.text ? n.text : '';
        if (!text) return;
        var EC = window.CoachExpandCard;
        if (EC && typeof EC.renderExpandCard === 'function') {
          var noteMedical =
            typeof n === 'object' && typeof n.medicalOverview === 'string'
              ? n.medicalOverview.trim()
              : '';
          var noteCite =
            typeof n === 'object' && typeof n.citation === 'string'
              ? n.citation.trim()
              : '';
          notesList.appendChild(
            EC.renderExpandCard({
              variant: 'note',
              text: text,
              medicalOverview: noteMedical,
              citation: noteCite,
              forceExpand: false,
            })
          );
        } else {
          var item = document.createElement('p');
          item.textContent = text;
          notesList.appendChild(item);
        }
      });
      notes.appendChild(notesList);
      wrap.appendChild(notes);
    }

    if (opts.showActions) {
      var actions = document.createElement('div');
      actions.className = 'coach-workout-actions';
      if (opts.onApply) {
        var applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'coach-action-btn coach-action-btn--primary';
        applyBtn.textContent = 'Apply to logbook';
        applyBtn.addEventListener('click', function () {
          opts.onApply(workoutToPlainText(workout), workout);
        });
        actions.appendChild(applyBtn);
      }
      if (opts.onSave) {
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'coach-action-btn coach-action-btn--ghost';
        saveBtn.textContent = 'Save plan';
        saveBtn.addEventListener('click', function () {
          opts.onSave(workoutToPlainText(workout), workout);
        });
        actions.appendChild(saveBtn);
      }
      wrap.appendChild(actions);
    }

    if (opts.showRockyOutro !== false) {
      var outro = document.createElement('p');
      outro.className = 'coach-workout-rocky-outro';
      outro.appendChild(document.createTextNode('Alright champ, I wrote you a routine — check it out '));
      var hereLink = document.createElement('a');
      hereLink.href = '#' + planId;
      hereLink.className = 'coach-workout-rocky-link';
      hereLink.textContent = 'here';
      hereLink.addEventListener('click', function (e) {
        e.preventDefault();
        var target = wrap.querySelector('#' + planId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        target.classList.add('coach-workout-head--highlight');
        window.setTimeout(function () {
          target.classList.remove('coach-workout-head--highlight');
        }, 1400);
      });
      outro.appendChild(hereLink);
      outro.appendChild(document.createTextNode('.'));
      wrap.appendChild(outro);
    }

    return wrap;
  }

  window.WorkoutPlanPreview = {
    renderWorkoutPreview: renderWorkoutPreview,
    workoutToPlainText: workoutToPlainText,
    resolveExerciseWhy: resolveExerciseWhy,
  };
})();
