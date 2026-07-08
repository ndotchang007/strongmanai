/**
 * Transparent PNG story stickers for Instagram Stories (Strava-style mobile flow).
 */
(function () {
  'use strict';

  var STICKER_WIDTH = 920;
  var STICKER_PAD = 40;
  var CARD_RADIUS = 28;
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

  function formatExerciseBullet(ex) {
    if (!ex) return '';
    var label = ex.name || 'Exercise';
    if (ex.blockName) label = ex.blockName + ' · ' + label;
    var w = '—';
    if (ex.setWeights && ex.setWeights.length) {
      w = ex.setWeights.join(' / ') + ' lb';
    } else if (ex.weight != null && ex.weight !== '') {
      w = ex.weight + ' lb';
    }
    return label + ' · ' + (ex.sets || '0') + '×' + (ex.reps || '0') + ' @ ' + w;
  }

  function formatCardioBullet(cardio) {
    if (!cardio) return '';
    var bits = [];
    var cm = parseFloat(cardio.minutes);
    if (!isNaN(cm) && cm > 0) bits.push(Math.round(cm) + ' min');
    if (cardio.activity) bits.push(String(cardio.activity).trim());
    if (cardio.type) bits.push(String(cardio.type).replace(/-/g, ' '));
    return bits.length ? 'Cardio · ' + bits.join(' · ') : '';
  }

  function buildWorkoutItems(session, opts, WL) {
    opts = opts || {};
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
    if (opts.incExercises !== false && session.exercises && session.exercises.length) {
      session.exercises.slice(0, 14).forEach(function (ex) {
        items.push({ kind: 'bullet', text: formatExerciseBullet(ex) });
      });
    }
    if (opts.incCardio !== false) {
      var cb = formatCardioBullet(session.cardio);
      if (cb) items.push({ kind: 'bullet', text: cb });
    }
    if (opts.incIntensity !== false && session.totalIntensity != null && WL) {
      items.push({
        kind: 'meta',
        text:
          'Intensity · ' +
          session.totalIntensity +
          ' (' +
          WL.intensityLabel(session.totalIntensity) +
          ')',
      });
    }
    if (opts.incNotes && session.notes && String(session.notes).trim()) {
      items.push({ kind: 'notes', text: String(session.notes).trim() });
    }
    var ig =
      window.InstagramConnect && typeof window.InstagramConnect.getConnectedHandle === 'function'
        ? window.InstagramConnect.getConnectedHandle()
        : '';
    if (ig) items.push({ kind: 'handle', text: '@' + ig });
    return items;
  }

  function layoutSticker(items, maxTextW) {
    var canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    var ctx = canvas.getContext('2d');
    var y = STICKER_PAD;
    var x = STICKER_PAD;
    var gap = 10;
    var lines = [];

    function addBlock(kind, text, font, color, lineHeight) {
      ctx.font = font;
      ctx.fillStyle = color;
      var wrapped = wrapLines(ctx, text, maxTextW);
      wrapped.forEach(function (ln) {
        lines.push({ kind: kind, text: ln, font: font, color: color, x: x, y: y, h: lineHeight });
        y += lineHeight;
      });
      y += gap;
    }

    items.forEach(function (item) {
      if (item.kind === 'brand') {
        addBlock('brand', item.text, 'bold 34px "DM Sans", system-ui, sans-serif', '#ff8c00', 38);
      } else if (item.kind === 'title') {
        addBlock('title', item.text, 'bold 46px "DM Sans", system-ui, sans-serif', '#ffffff', 50);
      } else if (item.kind === 'meta') {
        addBlock('meta', item.text, '500 24px "DM Sans", system-ui, sans-serif', 'rgba(255,255,255,0.82)', 28);
      } else if (item.kind === 'bullet') {
        addBlock('bullet', item.text, '500 26px "DM Sans", system-ui, sans-serif', 'rgba(255,255,255,0.94)', 30);
      } else if (item.kind === 'notes') {
        addBlock('notes', item.text, '500 22px "DM Sans", system-ui, sans-serif', 'rgba(255,255,255,0.78)', 26);
      } else if (item.kind === 'handle') {
        addBlock('handle', item.text, '600 22px "DM Sans", system-ui, sans-serif', 'rgba(255,255,255,0.72)', 26);
      }
    });

    var cardH = y + STICKER_PAD - gap;
    return { lines: lines, cardW: STICKER_WIDTH, cardH: Math.max(180, cardH) };
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

  function renderWorkoutSticker(session, opts, WL, callback) {
    if (!session) {
      callback(new Error('No session'));
      return;
    }
    var items = buildWorkoutItems(session, opts, WL);
    var maxTextW = STICKER_WIDTH - STICKER_PAD * 2;
    var layout = layoutSticker(items, maxTextW);
    var canvas = document.createElement('canvas');
    canvas.width = layout.cardW;
    canvas.height = layout.cardH;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawRoundedRect(ctx, 0, 0, layout.cardW, layout.cardH, CARD_RADIUS);
    ctx.fillStyle = 'rgba(12, 12, 14, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 140, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    layout.lines.forEach(function (ln) {
      ctx.font = ln.font;
      ctx.fillStyle = ln.color;
      if (ln.kind === 'brand' || ln.kind === 'title') {
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillText(ln.text, ln.x, ln.y);
      ctx.shadowBlur = 0;
    });

    canvas.toBlob(
      function (blob) {
        if (blob) callback(null, blob, canvas);
        else callback(new Error('Blob failed'));
      },
      'image/png'
    );
  }

  function stickerFilename() {
    return 'strongman-story-sticker-' + Date.now() + '.png';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || stickerFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2500);
  }

  /** Phone / tablet with Instagram app — not desktop browsers. */
  function isMobileInstagramDevice() {
    try {
      var ua = navigator.userAgent || '';
      if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
      if (/iPad/i.test(ua)) return true;
      if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function openInstagramStoryCamera() {
    var ua = navigator.userAgent || '';
    var isAndroid = /Android/i.test(ua);
    try {
      if (isAndroid) {
        window.location.href =
          'intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end';
        return;
      }
      window.location.href = 'instagram://story-camera';
    } catch (e) {
      try {
        window.location.href = 'instagram://story-camera';
      } catch (e2) {}
    }
  }

  function ensureDesktopBlockerModal() {
    if (document.getElementById(DESKTOP_BLOCKER_ID)) return;
    var backdrop = document.createElement('div');
    backdrop.className = 'ig-desktop-blocker-backdrop';
    backdrop.id = DESKTOP_BLOCKER_ID + '-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    var dialog = document.createElement('div');
    dialog.className = 'ig-desktop-blocker';
    dialog.id = DESKTOP_BLOCKER_ID;
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', DESKTOP_BLOCKER_ID + '-title');
    dialog.setAttribute('aria-hidden', 'true');

    dialog.innerHTML =
      '<div class="ig-desktop-blocker-panel">' +
      '<h2 class="ig-desktop-blocker-title" id="' +
      DESKTOP_BLOCKER_ID +
      '-title">Use your phone for Instagram Stories</h2>' +
      '<p class="ig-desktop-blocker-text">Instagram on a computer (<strong>instagram.com</strong>) does not let you post Stories. Open Strongman AI on your phone, then tap <strong>Share to Instagram</strong> — your sticker saves automatically and Instagram opens.</p>' +
      '<button type="button" class="ig-desktop-blocker-btn" data-ig-desktop-dismiss>Got it</button>' +
      '</div>';

    backdrop.addEventListener('click', hideDesktopInstagramBlocker);
    dialog.querySelector('[data-ig-desktop-dismiss]').addEventListener('click', hideDesktopInstagramBlocker);

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);
  }

  function showDesktopInstagramBlocker() {
    ensureDesktopBlockerModal();
    var backdrop = document.getElementById(DESKTOP_BLOCKER_ID + '-backdrop');
    var dialog = document.getElementById(DESKTOP_BLOCKER_ID);
    if (!backdrop || !dialog) return;
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var btn = dialog.querySelector('[data-ig-desktop-dismiss]');
    if (btn && typeof btn.focus === 'function') btn.focus();
  }

  function hideDesktopInstagramBlocker() {
    var backdrop = document.getElementById(DESKTOP_BLOCKER_ID + '-backdrop');
    var dialog = document.getElementById(DESKTOP_BLOCKER_ID);
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) {
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  /**
   * Strava-style: mobile saves PNG then opens Instagram; desktop shows blocker modal.
   */
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

      var filename = stickerFilename();
      downloadBlob(blob, filename);

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
          onStatus('Sticker saved. In Instagram, add it from your photos and place on your Story.');
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
    formatDisplayDate: formatDisplayDate,
    formatDisplayTime: formatDisplayTime,
  };
})();
