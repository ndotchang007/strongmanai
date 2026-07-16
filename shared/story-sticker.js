/**
 * Strava-style Instagram Story stickers — bold stats, transparent PNG, share to IG.
 */
(function () {
  'use strict';

  var STICKER_WIDTH = 1080;
  var STICKER_PAD = 56;
  var CARD_RADIUS = 48;
  var DESKTOP_BLOCKER_ID = 'ig-desktop-blocker';

  function wrapLines(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      if (!word) return;
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    try {
      var parts = String(dateStr).split('-');
      if (parts.length !== 3) return dateStr;
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function formatDisplayTime(timeStr) {
    if (!timeStr) return '';
    var parts = String(timeStr).split(':');
    if (parts.length < 2) return timeStr;
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    if (isNaN(h)) return timeStr;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + m + ' ' + ampm;
  }

  function themeAccent() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      return v || '#fc4c02';
    } catch (e) {
      return '#fc4c02';
    }
  }

  function hexToRgba(hex, a) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length < 6) return 'rgba(252, 76, 2, ' + a + ')';
    var r = parseInt(c.slice(0, 2), 16);
    var g = parseInt(c.slice(2, 4), 16);
    var b = parseInt(c.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(252, 76, 2, ' + a + ')';
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }

  function computeFlexStats(session) {
    var volume = 0;
    var sets = 0;
    var exercises = [];
    if (session.trackerData && Array.isArray(session.trackerData.exercises)) {
      session.trackerData.exercises.forEach(function (ex) {
        if (!ex || !ex.name) return;
        var completed = 0;
        (ex.sets || []).forEach(function (set) {
          if (!set || !(set.completed || set.done)) return;
          completed += 1;
          sets += 1;
          var w = parseFloat(set.weight);
          var r = parseFloat(set.reps);
          if (!isNaN(w) && !isNaN(r)) volume += w * r;
        });
        if (completed || (ex.sets || []).length) {
          exercises.push({ name: ex.name, sets: completed || (ex.sets || []).length });
        }
      });
    } else if (Array.isArray(session.exercises)) {
      session.exercises.forEach(function (ex) {
        if (!ex || !ex.name) return;
        var nSets = parseInt(ex.sets, 10) || 0;
        var nReps = parseInt(ex.reps, 10) || 0;
        var w = parseFloat(ex.weight);
        sets += nSets;
        if (!isNaN(w) && nSets && nReps) volume += w * nReps * nSets;
        exercises.push({ name: ex.name, sets: nSets || 0 });
      });
    }
    var durationMin = null;
    if (session.durationMin != null) durationMin = session.durationMin;
    else if (session.durationMs != null) durationMin = Math.max(1, Math.round(session.durationMs / 60000));
    return {
      volume: Math.round(volume),
      sets: sets,
      exerciseCount: exercises.length,
      exercises: exercises.slice(0, 8),
      durationMin: durationMin,
      intensity: session.totalIntensity != null ? session.totalIntensity : null,
    };
  }

  function buildWorkoutItems(session, opts, WL) {
    opts = opts || {};
    var stats = computeFlexStats(session);
    var items = [];
    items.push({ kind: 'brand', text: 'STRONGMAN AI' });
    if (opts.incTitle !== false) {
      var displayTitle =
        session.title ||
        session.splitName ||
        (session.sessionType === 'cardio' ? 'Cardio' : 'Workout');
      if (displayTitle) items.push({ kind: 'title', text: displayTitle });
    }
    if (opts.incDateTime !== false) {
      var dt = formatDisplayDate(session.date);
      var tm = formatDisplayTime(session.time);
      if (dt || tm) items.push({ kind: 'meta', text: [dt, tm].filter(Boolean).join(' · ') });
    }
    items.push({
      kind: 'stats',
      stats: [
        {
          value: stats.durationMin != null ? String(stats.durationMin) : '—',
          unit: 'min',
          label: 'Time',
        },
        {
          value: stats.volume > 0 ? stats.volume.toLocaleString() : '—',
          unit: stats.volume > 0 ? 'lb' : '',
          label: 'Volume',
        },
        {
          value: stats.sets > 0 ? String(stats.sets) : String(stats.exerciseCount || '—'),
          unit: '',
          label: stats.sets > 0 ? 'Sets' : 'Lifts',
        },
      ],
    });
    if (opts.incExercises !== false && stats.exercises.length) {
      stats.exercises.forEach(function (ex) {
        items.push({
          kind: 'bullet',
          text: ex.name + (ex.sets ? ' · ' + ex.sets + ' set' + (ex.sets === 1 ? '' : 's') : ''),
        });
      });
    }
    if (opts.incIntensity !== false && stats.intensity != null && WL) {
      items.push({
        kind: 'chip',
        text:
          'Intensity ' +
          stats.intensity +
          (typeof WL.intensityLabel === 'function' ? ' · ' + WL.intensityLabel(stats.intensity) : ''),
      });
    }
    if (opts.incNotes && session.notes && String(session.notes).trim()) {
      items.push({ kind: 'notes', text: String(session.notes).trim().slice(0, 120) });
    }
    var ig =
      window.InstagramConnect && typeof window.InstagramConnect.getConnectedHandle === 'function'
        ? window.InstagramConnect.getConnectedHandle()
        : '';
    if (ig) items.push({ kind: 'handle', text: '@' + ig });
    return items;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function layoutAndPaint(session, opts, WL) {
    var accent = themeAccent();
    var items = buildWorkoutItems(session, opts, WL);
    var pad = STICKER_PAD;
    var maxTextW = STICKER_WIDTH - pad * 2;
    var canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    var measure = canvas.getContext('2d');

    var blocks = [];
    var y = pad + 8;

    items.forEach(function (item) {
      if (item.kind === 'brand') {
        blocks.push({ kind: 'brand', text: item.text, y: y });
        y += 42;
      } else if (item.kind === 'title') {
        measure.font = '800 64px "Space Grotesk", "DM Sans", system-ui, sans-serif';
        var titleLines = wrapLines(measure, item.text, maxTextW);
        blocks.push({ kind: 'title', lines: titleLines, y: y });
        y += titleLines.length * 68 + 8;
      } else if (item.kind === 'meta') {
        blocks.push({ kind: 'meta', text: item.text, y: y });
        y += 36;
      } else if (item.kind === 'stats') {
        y += 12;
        blocks.push({ kind: 'stats', stats: item.stats, y: y });
        y += 130;
      } else if (item.kind === 'bullet') {
        blocks.push({ kind: 'bullet', text: item.text, y: y });
        y += 38;
      } else if (item.kind === 'chip') {
        blocks.push({ kind: 'chip', text: item.text, y: y });
        y += 48;
      } else if (item.kind === 'notes') {
        measure.font = '500 26px "DM Sans", system-ui, sans-serif';
        var noteLines = wrapLines(measure, item.text, maxTextW);
        blocks.push({ kind: 'notes', lines: noteLines, y: y });
        y += noteLines.length * 32 + 8;
      } else if (item.kind === 'handle') {
        blocks.push({ kind: 'handle', text: item.text, y: y });
        y += 36;
      }
    });

    var cardH = Math.max(520, y + pad);
    canvas.width = STICKER_WIDTH;
    canvas.height = cardH;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Transparent sticker: dark glass card + accent rail (Strava-like flex card) */
    drawRoundedRect(ctx, 0, 0, canvas.width, cardH, CARD_RADIUS);
    ctx.fillStyle = 'rgba(18, 18, 20, 0.92)';
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 14, cardH);

    ctx.strokeStyle = hexToRgba(accent, 0.35);
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 1.5, 1.5, canvas.width - 3, cardH - 3, CARD_RADIUS - 1);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    blocks.forEach(function (b) {
      var x = pad + 10;
      if (b.kind === 'brand') {
        ctx.font = '800 28px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = accent;
        ctx.letterSpacing = '0.08em';
        ctx.fillText(b.text, x, b.y);
      } else if (b.kind === 'title') {
        ctx.font = '800 64px "Space Grotesk", "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        b.lines.forEach(function (ln, i) {
          ctx.fillText(ln, x, b.y + i * 68);
        });
      } else if (b.kind === 'meta') {
        ctx.font = '600 28px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText(b.text, x, b.y);
      } else if (b.kind === 'stats') {
        var colW = (maxTextW - 24) / 3;
        b.stats.forEach(function (st, i) {
          var cx = x + i * (colW + 12);
          ctx.font = '800 56px "Space Grotesk", "DM Sans", system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(st.value, cx, b.y);
          var vw = ctx.measureText(st.value).width;
          if (st.unit) {
            ctx.font = '700 22px "DM Sans", system-ui, sans-serif';
            ctx.fillStyle = hexToRgba(accent, 0.95);
            ctx.fillText(st.unit, cx + vw + 8, b.y + 28);
          }
          ctx.font = '700 22px "DM Sans", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillText(String(st.label).toUpperCase(), cx, b.y + 72);
        });
      } else if (b.kind === 'bullet') {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x + 6, b.y + 14, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 30px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fillText(b.text, x + 24, b.y);
      } else if (b.kind === 'chip') {
        ctx.font = '700 24px "DM Sans", system-ui, sans-serif';
        var tw = ctx.measureText(b.text).width + 36;
        drawRoundedRect(ctx, x, b.y, tw, 40, 20);
        ctx.fillStyle = hexToRgba(accent, 0.18);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(accent, 0.55);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.fillText(b.text, x + 18, b.y + 8);
      } else if (b.kind === 'notes') {
        ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        b.lines.forEach(function (ln, i) {
          ctx.fillText(ln, x, b.y + i * 32);
        });
      } else if (b.kind === 'handle') {
        ctx.font = '700 26px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(b.text, x, b.y);
      }
    });

    return canvas;
  }

  function renderWorkoutSticker(session, opts, WL, callback) {
    if (!session) {
      callback(new Error('No session'));
      return;
    }
    try {
      var canvas = layoutAndPaint(session, opts || {}, WL);
      canvas.toBlob(
        function (blob) {
          if (blob) callback(null, blob, canvas);
          else callback(new Error('Blob failed'));
        },
        'image/png'
      );
    } catch (err) {
      callback(err);
    }
  }

  function stickerFilename() {
    var d = new Date();
    return (
      'strongman-story-' +
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      '.png'
    );
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || stickerFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2500);
  }

  function isMobileInstagramDevice() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod|Android/i.test(ua);
  }

  function openInstagramStoryCamera() {
    try {
      window.location.href = 'instagram://story-camera';
    } catch (e) {}
  }

  function ensureDesktopBlocker() {
    var el = document.getElementById(DESKTOP_BLOCKER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = DESKTOP_BLOCKER_ID;
    el.className = 'ig-desktop-blocker';
    el.hidden = true;
    el.innerHTML =
      '<div class="ig-desktop-blocker-panel" role="dialog" aria-modal="true">' +
      '<p class="ig-desktop-blocker-title">Open this on your phone</p>' +
      '<p class="ig-desktop-blocker-text">Story stickers save to Photos on mobile, then Instagram opens so you can place them on your Story — just like Strava.</p>' +
      '<button type="button" class="ig-desktop-blocker-close">Got it</button>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target === el || (e.target && e.target.classList.contains('ig-desktop-blocker-close'))) {
        hideDesktopInstagramBlocker();
      }
    });
    return el;
  }

  function showDesktopInstagramBlocker() {
    var el = ensureDesktopBlocker();
    el.hidden = false;
  }

  function hideDesktopInstagramBlocker() {
    var el = document.getElementById(DESKTOP_BLOCKER_ID);
    if (el) el.hidden = true;
  }

  function shareWorkoutToInstagram(session, opts, WL, callback) {
    callback = typeof callback === 'function' ? callback : function () {};
    if (!session) {
      callback({ ok: false, error: 'no_session' });
      return;
    }
    if (!isMobileInstagramDevice()) {
      showDesktopInstagramBlocker();
      callback({ ok: false, blocked: true, reason: 'desktop' });
      return;
    }
    renderWorkoutSticker(session, opts, WL, function (err, blob) {
      if (err || !blob) {
        callback({ ok: false, error: 'render_failed' });
        return;
      }
      downloadBlob(blob, stickerFilename());
      window.setTimeout(function () {
        openInstagramStoryCamera();
      }, 400);
      callback({ ok: true, saved: true, opened: true });
    });
  }

  function wireInstagramShareButton(button, getPayload, onStatus) {
    if (!button || typeof getPayload !== 'function') return;
    button.addEventListener('click', function () {
      var payload = getPayload();
      if (!payload || !payload.session) {
        if (onStatus) onStatus('Nothing to share yet.');
        return;
      }
      if (onStatus) onStatus('Saving sticker…');
      shareWorkoutToInstagram(payload.session, payload.opts, payload.WL, function (result) {
        if (result.blocked) {
          if (onStatus) onStatus('');
          return;
        }
        if (!result.ok) {
          if (onStatus) onStatus('Could not create sticker. Try again.');
          return;
        }
        if (onStatus) {
          onStatus('Sticker saved. In Instagram, add it from Photos onto your Story.');
        }
      });
    });
  }

  window.StorySticker = {
    STICKER_WIDTH: STICKER_WIDTH,
    buildWorkoutItems: buildWorkoutItems,
    renderWorkoutSticker: renderWorkoutSticker,
    downloadBlob: downloadBlob,
    isMobileInstagramDevice: isMobileInstagramDevice,
    showDesktopInstagramBlocker: showDesktopInstagramBlocker,
    hideDesktopInstagramBlocker: hideDesktopInstagramBlocker,
    shareWorkoutToInstagram: shareWorkoutToInstagram,
    wireInstagramShareButton: wireInstagramShareButton,
    openInstagramStoryCamera: openInstagramStoryCamera,
  };
})();
