/**
 * Roboflow gym-equipment detection helpers + class → inventory mapping.
 * Model: gym-equipment-ersfc/1 (hosted Roboflow; frames polled via backend)
 */
(function () {
  var DETECT_MAX_SIDE = 640;
  var DETECT_JPEG_QUALITY = 0.72;
  /** Hosted API — poll frames every 1.5s (not on-device YOLO). */
  var DEFAULT_INTERVAL_MS = 1500;

  function titleCaseClass(name) {
    return String(name || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function mapClassToMeta(className) {
    var c = String(className || '').toLowerCase();
    if (/dumbbell|db\b/.test(c)) {
      return { category: 'free_weight', equipmentId: 'dumbbells', label: titleCaseClass(className) };
    }
    if (/barbell|\bbar\b/.test(c) && !/pull.?up|chin/.test(c)) {
      return { category: 'free_weight', equipmentId: 'barbells', label: titleCaseClass(className) };
    }
    if (/kettle/.test(c)) {
      return { category: 'free_weight', equipmentId: 'kettlebells', label: titleCaseClass(className) };
    }
    if (/cable|lat.?pull|pulldown|pushdown/.test(c)) {
      return { category: 'cable', equipmentId: 'cable', label: titleCaseClass(className) };
    }
    if (/leg.?press/.test(c)) {
      return { category: 'machine', equipmentId: 'leg_press', label: titleCaseClass(className) };
    }
    if (/smith/.test(c)) {
      return { category: 'machine', equipmentId: 'smith', label: titleCaseClass(className) };
    }
    if (
      /leg.?curl|leg.?extension|chest.?press|chest.?fly|arm.?curl|lateral.?raise|fly machine|press machine|selector/.test(
        c
      )
    ) {
      return { category: 'machine', equipmentId: 'machines', label: titleCaseClass(className) };
    }
    if (/chin|pull.?up|dip(ping)?/.test(c)) {
      return { category: 'bodyweight', equipmentId: 'pullup_bar', label: titleCaseClass(className) };
    }
    if (/bench/.test(c)) {
      return { category: 'bench', equipmentId: 'bench', label: titleCaseClass(className) };
    }
    if (/rack|squat/.test(c)) {
      return { category: 'rack', equipmentId: 'squat_rack', label: titleCaseClass(className) };
    }
    if (/treadmill|elliptical|bike|rower|cardio|stair/.test(c)) {
      return { category: 'cardio', equipmentId: 'cardio', label: titleCaseClass(className) };
    }
    if (/band|resistance/.test(c)) {
      return { category: 'accessory', equipmentId: 'bands', label: titleCaseClass(className) };
    }
    return { category: 'machine', equipmentId: 'machines', label: titleCaseClass(className) };
  }

  function predictionToEquipmentItem(pred) {
    var meta = mapClassToMeta(pred.class);
    var pct = Math.round((pred.confidence || 0) * 100);
    return {
      name: meta.label,
      brand: '',
      category: meta.category,
      notes: 'Detected live (' + pct + '% confidence)',
      equipmentId: meta.equipmentId,
      detection: {
        class: pred.class,
        confidence: pred.confidence,
        source: 'roboflow',
      },
    };
  }

  function predictionsToHomeGym(predictions) {
    var seen = {};
    var equipment = [];
    (predictions || []).forEach(function (pred) {
      var item = predictionToEquipmentItem(pred);
      var key = String(item.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      equipment.push(item);
    });
    var labels = equipment.map(function (e) {
      return e.name;
    });
    return {
      summary: equipment.length
        ? 'Live Roboflow scan found ' + equipment.length + ' piece(s) of gym equipment.'
        : '',
      equipment: equipment,
      suggestedLabels: labels,
      scannedAt: new Date().toISOString(),
      source: 'roboflow',
    };
  }

  function captureDetectFrame(video, maxSide) {
    maxSide = maxSide || DETECT_MAX_SIDE;
    if (!video || !video.videoWidth) {
      return Promise.reject(new Error('Camera not ready'));
    }
    var w = video.videoWidth;
    var h = video.videoHeight;
    var scale = Math.min(1, maxSide / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, cw, ch);
    var dataUrl = canvas.toDataURL('image/jpeg', DETECT_JPEG_QUALITY);
    var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return Promise.reject(new Error('Could not capture frame'));
    return Promise.resolve({
      mediaType: m[1],
      data: m[2],
      width: cw,
      height: ch,
    });
  }

  function detectFrame(image, confidence) {
    if (typeof apiPost !== 'function') {
      return Promise.reject(new Error('Could not reach the API.'));
    }
    var body = { image: { mediaType: image.mediaType, data: image.data } };
    if (typeof confidence === 'number') body.confidence = confidence;
    return apiPost('/detect/equipment', body).then(function (res) {
      return res.json().then(function (json) {
        return { res: res, body: json };
      });
    }).then(function (x) {
      if (!x.res.ok) {
        var err = new Error((x.body && x.body.error) || 'Detection failed.');
        err.code = x.body && x.body.code;
        err.status = x.res.status;
        throw err;
      }
      return x.body;
    });
  }

  function getStatus() {
    if (typeof apiGet !== 'function' && typeof apiPost !== 'function') {
      return Promise.resolve({ configured: false });
    }
    var getter =
      typeof apiGet === 'function'
        ? apiGet('/detect/equipment/status')
        : fetch(
            (typeof API_BASE !== 'undefined' ? API_BASE : '') + '/api/v1/detect/equipment/status',
            { credentials: 'include' }
          );
    return getter
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (x) {
        if (!x.res.ok) return { configured: false };
        return x.body;
      })
      .catch(function () {
        return { configured: false };
      });
  }

  /**
   * Map Roboflow center-box coords onto the displayed video element.
   */
  function mapPredictionToViewport(pred, imageSize, videoEl) {
    if (!pred || !videoEl || !imageSize || !imageSize.width || !imageSize.height) return null;
    var rect = videoEl.getBoundingClientRect();
    var vw = videoEl.videoWidth || imageSize.width;
    var vh = videoEl.videoHeight || imageSize.height;
    if (!vw || !vh || !rect.width || !rect.height) return null;

    var scale = Math.max(rect.width / vw, rect.height / vh);
    var dispW = vw * scale;
    var dispH = vh * scale;
    var offsetX = (rect.width - dispW) / 2;
    var offsetY = (rect.height - dispH) / 2;

    var sx = vw / imageSize.width;
    var sy = vh / imageSize.height;
    var cx = pred.x * sx * scale + offsetX;
    var cy = pred.y * sy * scale + offsetY;
    var bw = pred.width * sx * scale;
    var bh = pred.height * sy * scale;

    return {
      cx: cx,
      cy: cy,
      left: cx - bw / 2,
      top: cy - bh / 2,
      width: bw,
      height: bh,
      class: pred.class,
      confidence: pred.confidence,
    };
  }

  function directionFromCenter(mapped, stageW, stageH) {
    var dx = mapped.cx - stageW / 2;
    var dy = mapped.cy - stageH / 2;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    var nx = stageW ? dx / (stageW / 2) : 0;
    var ny = stageH ? dy / (stageH / 2) : 0;
    return {
      dx: dx,
      dy: dy,
      dist: dist,
      angle: angle,
      nx: nx,
      ny: ny,
      locked: Math.abs(nx) < 0.22 && Math.abs(ny) < 0.22,
    };
  }

  window.EquipmentDetect = {
    DETECT_MAX_SIDE: DETECT_MAX_SIDE,
    DEFAULT_INTERVAL_MS: DEFAULT_INTERVAL_MS,
    titleCaseClass: titleCaseClass,
    mapClassToMeta: mapClassToMeta,
    predictionToEquipmentItem: predictionToEquipmentItem,
    predictionsToHomeGym: predictionsToHomeGym,
    captureDetectFrame: captureDetectFrame,
    detectFrame: detectFrame,
    getStatus: getStatus,
    mapPredictionToViewport: mapPredictionToViewport,
    directionFromCenter: directionFromCenter,
  };
})();
