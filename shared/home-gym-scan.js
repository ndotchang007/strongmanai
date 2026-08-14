(function () {
  var MAX_IMAGES = 4;
  var MAX_SIDE = 1280;
  var JPEG_QUALITY = 0.78;

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Not an image'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Could not read image'));
      };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          var dataUrl = canvas.toDataURL(mediaType, JPEG_QUALITY);
          var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
          if (!m) {
            reject(new Error('Could not encode image'));
            return;
          }
          resolve({
            mediaType: m[1],
            data: m[2],
            previewUrl: URL.createObjectURL(file),
          });
        };
        img.onerror = function () {
          reject(new Error('Could not load image'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function formatHomeGymForPrompt(homeGym) {
    if (!homeGym || !Array.isArray(homeGym.equipment) || !homeGym.equipment.length) {
      return '';
    }
    var lines = ['Home gym inventory (from photo scan — use for exercise selection and loads):'];
    if (homeGym.summary) lines.push('Overview: ' + homeGym.summary);
    homeGym.equipment.forEach(function (item, i) {
      var bits = [(i + 1) + '. ' + item.name];
      if (item.brand) bits.push('brand ' + item.brand);
      if (item.category) bits.push(item.category);
      if (item.notes) bits.push(item.notes);
      lines.push(bits.join(' — '));
      var cal = item.weightCalibration;
      if (cal) {
        if (cal.rule) {
          lines.push(
            '   Weight mapping (' +
              (cal.displayUnit || 'display') +
              ' → ' +
              (cal.actualUnit || 'lb') +
              '): ' +
              cal.rule
          );
        }
        if (cal.examples && cal.examples.length) {
          lines.push(
            '   Examples: ' +
              cal.examples
                .map(function (ex) {
                  return ex.display + '=' + ex.actual + (cal.actualUnit || 'lb');
                })
                .join(', ')
          );
        }
      }
    });
    lines.push(
      'When prescribing cable/machine loads, convert stack numbers to real weight using the mappings above.'
    );
    return lines.join('\n');
  }

  function formatHomeGymNotesLine(homeGym) {
    if (!homeGym || !Array.isArray(homeGym.equipment) || !homeGym.equipment.length) return '';
    var parts = homeGym.equipment.map(function (item) {
      var s = item.name;
      if (item.brand) s += ' (' + item.brand + ')';
      if (item.weightCalibration && item.weightCalibration.rule) {
        s += ' [' + item.weightCalibration.rule + ']';
      }
      return s;
    });
    return 'Home gym scan: ' + parts.join('; ');
  }

  function inferEquipmentTier(homeGym, labels) {
    var list = labels || (homeGym && homeGym.suggestedLabels) || [];
    var lower = list.map(function (m) {
      return String(m).toLowerCase();
    });
    if (lower.indexOf('minimal equipment') !== -1 && list.length <= 1) return 'none';
    if (lower.indexOf('full gym') !== -1 || list.length >= 4) return 'local';
    if (homeGym && homeGym.equipment && homeGym.equipment.length >= 4) return 'local';
    if (homeGym && homeGym.equipment && homeGym.equipment.length) return 'home';
    return 'home';
  }

  function mergeMachineLabels(existing, suggested) {
    var out = Array.isArray(existing) ? existing.slice() : [];
    var seen = {};
    out.forEach(function (m) {
      seen[String(m).toLowerCase()] = true;
    });
    (suggested || []).forEach(function (label) {
      var key = String(label).toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(label);
    });
    return out;
  }

  function equipmentKey(item) {
    return String((item && item.name) || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function preferEquipmentItem(a, b) {
    var score = function (item) {
      var n = 0;
      if (item.brand) n += 2;
      if (item.weightCalibration) n += 3;
      if (item.notes) n += 1;
      return n;
    };
    return score(b) > score(a) ? b : a;
  }

  function mergeHomeGym(prev, next) {
    if (!next || !Array.isArray(next.equipment) || !next.equipment.length) {
      return prev || next || null;
    }
    if (!prev || !Array.isArray(prev.equipment) || !prev.equipment.length) {
      return next;
    }
    var map = {};
    var order = [];
    prev.equipment.forEach(function (item) {
      var key = equipmentKey(item);
      if (!key) return;
      map[key] = item;
      order.push(key);
    });
    next.equipment.forEach(function (item) {
      var key = equipmentKey(item);
      if (!key) return;
      if (map[key]) {
        map[key] = preferEquipmentItem(map[key], item);
      } else {
        map[key] = item;
        order.push(key);
      }
    });
    return {
      summary: next.summary || prev.summary || '',
      equipment: order
        .map(function (k) {
          return map[k];
        })
        .filter(Boolean)
        .slice(0, 20),
      suggestedLabels: mergeMachineLabels(prev.suggestedLabels || [], next.suggestedLabels || []),
      scannedAt: next.scannedAt || prev.scannedAt || new Date().toISOString(),
    };
  }

  function captureFrameFromVideo(video, maxSide) {
    maxSide = maxSide || MAX_SIDE;
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
    var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return Promise.reject(new Error('Could not capture frame'));
    return Promise.resolve({ mediaType: m[1], data: m[2] });
  }

  function stopStream(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
    } catch (e) {}
  }

  function openLiveWalkthrough(opts) {
    opts = opts || {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Live camera is not supported in this browser.'));
    }

    var existing = document.getElementById('home-gym-live-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.id = 'home-gym-live-overlay';
    overlay.className = 'home-gym-live';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Walk and scan gym equipment');
    overlay.innerHTML =
      '<div class="home-gym-live-stage">' +
      '<video class="home-gym-live-video" playsinline autoplay muted></video>' +
      '<canvas class="home-gym-live-canvas" aria-hidden="true"></canvas>' +
      '<div class="home-gym-live-hud" aria-hidden="true">' +
      '<div class="home-gym-live-compass">' +
      '<div class="home-gym-live-compass-ring" data-compass-ring>' +
      '<span class="home-gym-live-compass-tick home-gym-live-compass-tick--n">N</span>' +
      '<span class="home-gym-live-compass-tick home-gym-live-compass-tick--e">E</span>' +
      '<span class="home-gym-live-compass-tick home-gym-live-compass-tick--s">S</span>' +
      '<span class="home-gym-live-compass-tick home-gym-live-compass-tick--w">W</span>' +
      '<span class="home-gym-live-compass-needle" data-compass-needle></span>' +
      '</div>' +
      '<p class="home-gym-live-heading" data-live-heading>—°</p>' +
      '</div>' +
      '<div class="home-gym-live-edge home-gym-live-edge--left" data-edge="left" hidden></div>' +
      '<div class="home-gym-live-edge home-gym-live-edge--right" data-edge="right" hidden></div>' +
      '<div class="home-gym-live-edge home-gym-live-edge--top" data-edge="top" hidden></div>' +
      '<div class="home-gym-live-edge home-gym-live-edge--bottom" data-edge="bottom" hidden></div>' +
      '<div class="home-gym-live-dir-arrow" data-dir-arrow hidden>' +
      '<span class="home-gym-live-dir-chevron"></span>' +
      '<span class="home-gym-live-dir-label" data-dir-label></span>' +
      '</div>' +
      '<div class="home-gym-live-target" data-live-target>' +
      '<span class="home-gym-live-target-corner home-gym-live-target-corner--tl"></span>' +
      '<span class="home-gym-live-target-corner home-gym-live-target-corner--tr"></span>' +
      '<span class="home-gym-live-target-corner home-gym-live-target-corner--bl"></span>' +
      '<span class="home-gym-live-target-corner home-gym-live-target-corner--br"></span>' +
      '</div>' +
      '<div class="home-gym-live-lock" data-live-lock hidden>LOCKED</div>' +
      '<div class="home-gym-live-radar" data-live-radar></div>' +
      '</div>' +
      '<div class="home-gym-live-top">' +
      '<p class="home-gym-live-hint">Point at gear · follow the HUD · tap Add when locked</p>' +
      '<button type="button" class="home-gym-live-close" data-live-close aria-label="Close camera">×</button>' +
      '</div>' +
      '<div class="home-gym-live-toast" data-live-toast hidden></div>' +
      '<div class="home-gym-live-dock">' +
      '<p class="home-gym-live-detect-status" data-live-detect>Starting detector…</p>' +
      '<p class="home-gym-live-count" data-live-count>0 items found</p>' +
      '<button type="button" class="home-gym-live-recognize" data-live-recognize>Add detection</button>' +
      '<button type="button" class="home-gym-live-done" data-live-done>Done</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('home-gym-live-open');

    var stage = overlay.querySelector('.home-gym-live-stage');
    var video = overlay.querySelector('.home-gym-live-video');
    var canvas = overlay.querySelector('.home-gym-live-canvas');
    var toastEl = overlay.querySelector('[data-live-toast]');
    var countEl = overlay.querySelector('[data-live-count]');
    var detectStatusEl = overlay.querySelector('[data-live-detect]');
    var recognizeBtn = overlay.querySelector('[data-live-recognize]');
    var doneBtn = overlay.querySelector('[data-live-done]');
    var closeBtn = overlay.querySelector('[data-live-close]');
    var compassRing = overlay.querySelector('[data-compass-ring]');
    var headingEl = overlay.querySelector('[data-live-heading]');
    var dirArrow = overlay.querySelector('[data-dir-arrow]');
    var dirLabel = overlay.querySelector('[data-dir-label]');
    var lockEl = overlay.querySelector('[data-live-lock]');
    var targetEl = overlay.querySelector('[data-live-target]');
    var radarEl = overlay.querySelector('[data-live-radar]');
    var edgeEls = {
      left: overlay.querySelector('[data-edge="left"]'),
      right: overlay.querySelector('[data-edge="right"]'),
      top: overlay.querySelector('[data-edge="top"]'),
      bottom: overlay.querySelector('[data-edge="bottom"]'),
    };

    var stream = null;
    var busy = false;
    var closed = false;
    var detectConfigured = false;
    var detectLoopTimer = null;
    var detectInFlight = false;
    var lastPredictions = [];
    var lastImageSize = null;
    var headingDeg = null;
    var orientationHandler = null;
    var inventory = opts.initial ? JSON.parse(JSON.stringify(opts.initial)) : null;
    var ED = window.EquipmentDetect;

    function toast(msg, isError) {
      if (!toastEl) return;
      toastEl.textContent = msg || '';
      toastEl.hidden = !msg;
      toastEl.classList.toggle('home-gym-live-toast--error', !!isError);
    }

    function setDetectStatus(msg) {
      if (detectStatusEl) detectStatusEl.textContent = msg || '';
    }

    function updateCount() {
      var n = inventory && inventory.equipment ? inventory.equipment.length : 0;
      if (countEl) {
        countEl.textContent = n + ' item' + (n === 1 ? '' : 's') + ' found';
      }
    }

    function stopDetectLoop() {
      if (detectLoopTimer) {
        clearTimeout(detectLoopTimer);
        detectLoopTimer = null;
      }
      detectInFlight = false;
    }

    function stopOrientation() {
      if (orientationHandler) {
        window.removeEventListener('deviceorientation', orientationHandler);
        orientationHandler = null;
      }
    }

    function closeLive(finalInventory) {
      if (closed) return;
      closed = true;
      stopDetectLoop();
      stopOrientation();
      stopStream(stream);
      stream = null;
      document.body.classList.remove('home-gym-live-open');
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof opts.onClose === 'function') opts.onClose(finalInventory || inventory);
    }

    function setBusy(on) {
      busy = !!on;
      if (recognizeBtn) {
        recognizeBtn.disabled = !!on;
        recognizeBtn.textContent = on ? 'Adding…' : 'Add detection';
      }
      if (doneBtn) doneBtn.disabled = !!on;
    }

    function bestPrediction() {
      if (!lastPredictions.length || !ED || !video || !lastImageSize) return null;
      var stageW = stage ? stage.clientWidth : 0;
      var stageH = stage ? stage.clientHeight : 0;
      var best = null;
      lastPredictions.forEach(function (pred) {
        var mapped = ED.mapPredictionToViewport(pred, lastImageSize, video);
        if (!mapped) return;
        var dir = ED.directionFromCenter(mapped, stageW, stageH);
        var score = (pred.confidence || 0) * 2 - dir.dist / Math.max(stageW, 1);
        if (!best || score > best.score) {
          best = { pred: pred, mapped: mapped, dir: dir, score: score };
        }
      });
      return best;
    }

    function drawHud() {
      if (!canvas || !video || !stage) return;
      var w = stage.clientWidth;
      var h = stage.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8b84a';
      var mappedList = [];
      if (ED && lastImageSize) {
        lastPredictions.forEach(function (pred) {
          var mapped = ED.mapPredictionToViewport(pred, lastImageSize, video);
          if (mapped) mappedList.push({ pred: pred, mapped: mapped });
        });
      }

      mappedList.forEach(function (item) {
        var m = item.mapped;
        var conf = Math.round((item.pred.confidence || 0) * 100);
        var label =
          (ED ? ED.titleCaseClass(item.pred.class) : item.pred.class) + '  ' + conf + '%';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(m.left, m.top, m.width, m.height);
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        var tw = ctx.measureText(label).width + 12;
        ctx.fillRect(m.left, Math.max(0, m.top - 22), Math.min(tw, m.width + 40), 20);
        ctx.fillStyle = '#fff';
        ctx.font = '600 12px DM Sans, system-ui, sans-serif';
        ctx.fillText(label, m.left + 6, Math.max(14, m.top - 7));
      });

      var focus = bestPrediction();
      ['left', 'right', 'top', 'bottom'].forEach(function (side) {
        if (edgeEls[side]) edgeEls[side].hidden = true;
      });
      if (radarEl) radarEl.innerHTML = '';

      if (focus && focus.mapped) {
        var dir = focus.dir;
        var labelName = ED ? ED.titleCaseClass(focus.pred.class) : focus.pred.class;
        if (targetEl) {
          targetEl.classList.toggle('is-locked', !!dir.locked);
        }
        if (lockEl) {
          lockEl.hidden = !dir.locked;
          if (dir.locked) lockEl.textContent = 'LOCKED · ' + labelName;
        }
        if (dirArrow && dirLabel) {
          if (!dir.locked && dir.dist > 36) {
            dirArrow.hidden = false;
            dirArrow.style.transform =
              'translate(-50%, -50%) rotate(' + (dir.angle + 90) + 'deg)';
            dirLabel.textContent = labelName;
            dirLabel.style.transform = 'rotate(' + -(dir.angle + 90) + 'deg)';
          } else {
            dirArrow.hidden = true;
          }
        }
        var edgeThresh = 0.55;
        if (dir.nx < -edgeThresh && edgeEls.left) {
          edgeEls.left.hidden = false;
          edgeEls.left.textContent = '◀ ' + labelName;
        } else if (dir.nx > edgeThresh && edgeEls.right) {
          edgeEls.right.hidden = false;
          edgeEls.right.textContent = labelName + ' ▶';
        }
        if (dir.ny < -edgeThresh && edgeEls.top) {
          edgeEls.top.hidden = false;
          edgeEls.top.textContent = '▲ ' + labelName;
        } else if (dir.ny > edgeThresh && edgeEls.bottom) {
          edgeEls.bottom.hidden = false;
          edgeEls.bottom.textContent = '▼ ' + labelName;
        }
        if (radarEl) {
          mappedList.forEach(function (item) {
            var d = ED.directionFromCenter(item.mapped, w, h);
            var blip = document.createElement('span');
            blip.className = 'home-gym-live-radar-blip';
            var rx = 50 + Math.max(-42, Math.min(42, d.nx * 42));
            var ry = 50 + Math.max(-42, Math.min(42, d.ny * 42));
            blip.style.left = rx + '%';
            blip.style.top = ry + '%';
            radarEl.appendChild(blip);
          });
        }
      } else {
        if (targetEl) targetEl.classList.remove('is-locked');
        if (lockEl) lockEl.hidden = true;
        if (dirArrow) dirArrow.hidden = true;
      }
    }

    function scheduleDetectLoop() {
      stopDetectLoop();
      if (closed || !detectConfigured || !ED) return;
      var interval = ED.DEFAULT_INTERVAL_MS || 1500;
      detectLoopTimer = setTimeout(runDetectOnce, interval);
    }

    function runDetectOnce() {
      if (closed || detectInFlight || !video || !ED) return;
      if (!video.videoWidth) {
        scheduleDetectLoop();
        return;
      }
      detectInFlight = true;
      ED.captureDetectFrame(video)
        .then(function (frame) {
          lastImageSize = { width: frame.width, height: frame.height };
          return ED.detectFrame(frame);
        })
        .then(function (result) {
          lastPredictions = (result && result.predictions) || [];
          var n = lastPredictions.length;
          setDetectStatus(
            n
              ? n + ' detection' + (n === 1 ? '' : 's') + ' · live'
              : 'Scanning… point at equipment'
          );
          drawHud();
        })
        .catch(function (err) {
          if (err && err.code === 'ROBOFLOW_NOT_CONFIGURED') {
            detectConfigured = false;
            setDetectStatus('Detector offline — set ROBOFLOW_API_KEY');
            return;
          }
          setDetectStatus((err && err.message) || 'Detection paused');
        })
        .finally(function () {
          detectInFlight = false;
          if (!closed && detectConfigured) scheduleDetectLoop();
        });
    }

    function startOrientationHud() {
      orientationHandler = function (event) {
        var alpha = typeof event.alpha === 'number' ? event.alpha : null;
        var webkitHeading =
          typeof event.webkitCompassHeading === 'number' ? event.webkitCompassHeading : null;
        if (webkitHeading != null) {
          headingDeg = webkitHeading;
        } else if (alpha != null) {
          headingDeg = (360 - alpha + 360) % 360;
        }
        if (headingDeg == null) return;
        if (compassRing) {
          compassRing.style.transform = 'rotate(' + -headingDeg + 'deg)';
        }
        if (headingEl) {
          headingEl.textContent = Math.round(headingDeg) + '°';
        }
      };

      function attach() {
        window.addEventListener('deviceorientation', orientationHandler, true);
      }

      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        DeviceOrientationEvent.requestPermission()
          .then(function (state) {
            if (state === 'granted') attach();
            else if (headingEl) headingEl.textContent = 'compass off';
          })
          .catch(function () {
            if (headingEl) headingEl.textContent = 'compass off';
          });
      } else if (typeof DeviceOrientationEvent !== 'undefined') {
        attach();
      } else if (headingEl) {
        headingEl.textContent = 'compass n/a';
      }
    }

    function addCurrentDetections() {
      if (busy) return;
      var focus = bestPrediction();
      var preds = focus ? [focus.pred] : lastPredictions.slice(0, 3);
      if (!preds.length) {
        toast('No equipment in view yet — keep scanning.', true);
        return;
      }
      if (!ED) {
        toast('Detector not loaded.', true);
        return;
      }
      setBusy(true);
      var found = ED.predictionsToHomeGym(preds);
      inventory = mergeHomeGym(inventory, found);
      updateCount();
      var names = (found.equipment || [])
        .map(function (e) {
          return e.name;
        })
        .slice(0, 2)
        .join(', ');
      toast(names ? 'Added: ' + names : 'Added to your gym list.');
      if (typeof opts.onUpdate === 'function') opts.onUpdate(inventory);
      setBusy(false);

      // Optional Claude enrichment for weight calibration when configured
      if (typeof apiPost === 'function' && focus && focus.dir && focus.dir.locked) {
        captureFrameFromVideo(video)
          .then(function (frame) {
            return apiPost('/coach/gym-scan', {
              images: [frame],
              notes:
                'LIVE ENRICHMENT: Confirm the centered equipment "' +
                (focus.pred.class || '') +
                '". Prefer brand + weightCalibration for numbered stacks if visible. Keep list to 1 primary item.',
            }).then(function (res) {
              return res.json().then(function (body) {
                return { res: res, body: body };
              });
            });
          })
          .then(function (x) {
            if (!x.res.ok || !x.body.homeGym) return;
            inventory = mergeHomeGym(inventory, x.body.homeGym);
            updateCount();
            if (typeof opts.onUpdate === 'function') opts.onUpdate(inventory);
          })
          .catch(function () {});
      }
    }

    updateCount();

    return navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then(function (mediaStream) {
        stream = mediaStream;
        if (video) {
          video.srcObject = mediaStream;
          var play = video.play();
          if (play && typeof play.catch === 'function') play.catch(function () {});
        }

        startOrientationHud();
        window.addEventListener('resize', drawHud);

        var statusPromise =
          ED && typeof ED.getStatus === 'function'
            ? ED.getStatus()
            : Promise.resolve({ configured: false });

        statusPromise.then(function (status) {
          detectConfigured = !!(status && status.configured);
          if (detectConfigured) {
            setDetectStatus('Detector ready · scanning');
            scheduleDetectLoop();
          } else {
            setDetectStatus('Set ROBOFLOW_API_KEY to enable live detection');
            toast('Live detector needs ROBOFLOW_API_KEY on the server.', true);
          }
        });

        if (recognizeBtn) recognizeBtn.addEventListener('click', addCurrentDetections);
        if (doneBtn) {
          doneBtn.addEventListener('click', function () {
            if (busy) return;
            window.removeEventListener('resize', drawHud);
            closeLive(inventory);
          });
        }
        if (closeBtn) {
          closeBtn.addEventListener('click', function () {
            if (busy) return;
            window.removeEventListener('resize', drawHud);
            closeLive(inventory);
          });
        }

        return {
          close: function () {
            window.removeEventListener('resize', drawHud);
            closeLive(inventory);
          },
        };
      })
      .catch(function (err) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.body.classList.remove('home-gym-live-open');
        var msg =
          err && err.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access to walk-and-scan.'
            : (err && err.message) || 'Could not open camera.';
        return Promise.reject(new Error(msg));
      });
  }

  function renderResultHtml(homeGym) {
    if (!homeGym || !homeGym.equipment || !homeGym.equipment.length) {
      return '<p class="home-gym-empty">No equipment saved yet.</p>';
    }
    var html = '';
    if (homeGym.summary) {
      html += '<p class="home-gym-summary">' + escapeHtml(homeGym.summary) + '</p>';
    }
    html += '<ul class="home-gym-list">';
    homeGym.equipment.forEach(function (item) {
      html += '<li class="home-gym-item">';
      html += '<div class="home-gym-item-top">';
      html += '<span class="home-gym-item-name">' + escapeHtml(item.name) + '</span>';
      if (item.brand) {
        html += '<span class="home-gym-item-brand">' + escapeHtml(item.brand) + '</span>';
      }
      html += '</div>';
      if (item.notes) {
        html += '<p class="home-gym-item-notes">' + escapeHtml(item.notes) + '</p>';
      }
      var cal = item.weightCalibration;
      if (cal && (cal.rule || (cal.examples && cal.examples.length))) {
        html += '<div class="home-gym-cal">';
        if (cal.rule) {
          html += '<p class="home-gym-cal-rule">' + escapeHtml(cal.rule) + '</p>';
        }
        if (cal.examples && cal.examples.length) {
          html += '<p class="home-gym-cal-examples">';
          html += cal.examples
            .map(function (ex) {
              return (
                '<span class="home-gym-cal-chip">' +
                escapeHtml(String(ex.display)) +
                ' → ' +
                escapeHtml(String(ex.actual)) +
                ' ' +
                escapeHtml(cal.actualUnit || 'lb') +
                '</span>'
              );
            })
            .join('');
          html += '</p>';
        }
        html += '</div>';
      }
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mount(container, opts) {
    opts = opts || {};
    if (!container) return null;

    var state = {
      attachments: [],
      homeGym: opts.initial || null,
      busy: false,
    };

    container.classList.add('home-gym-scan');
    container.innerHTML =
      '<div class="home-gym-scan-head">' +
      '<p class="home-gym-scan-title">Identify your equipment</p>' +
      '<p class="home-gym-scan-desc">Walk the room with live camera detection (Roboflow) and a directional HUD, or upload photos. Rocky can enrich brands and weight increments once gear is locked in view.</p>' +
      '</div>' +
      '<div class="home-gym-scan-actions">' +
      '<button type="button" class="home-gym-scan-btn home-gym-scan-btn--primary" data-gym-action="live">Walk &amp; scan</button>' +
      '<button type="button" class="home-gym-scan-btn" data-gym-action="pick">Take / add photos</button>' +
      '<button type="button" class="home-gym-scan-btn" data-gym-action="scan" disabled>Identify photos</button>' +
      '<button type="button" class="home-gym-scan-btn home-gym-scan-btn--ghost" data-gym-action="clear" hidden>Clear scan</button>' +
      '<input type="file" class="visually-hidden" data-gym-input accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" multiple>' +
      '</div>' +
      '<div class="home-gym-previews" data-gym-previews hidden></div>' +
      '<label class="home-gym-notes-label" for="' +
      (container.id || 'home-gym') +
      '-notes">Optional notes for Rocky</label>' +
      '<textarea id="' +
      (container.id || 'home-gym') +
      '-notes" class="home-gym-notes" data-gym-notes rows="2" maxlength="1000" placeholder="e.g. cable stack numbers are 10 lb each"></textarea>' +
      '<p class="home-gym-status" data-gym-status role="status" aria-live="polite" hidden></p>' +
      '<div class="home-gym-result" data-gym-result></div>';

    var pickBtn = container.querySelector('[data-gym-action="pick"]');
    var liveBtn = container.querySelector('[data-gym-action="live"]');
    var scanBtn = container.querySelector('[data-gym-action="scan"]');
    var clearBtn = container.querySelector('[data-gym-action="clear"]');
    var fileInput = container.querySelector('[data-gym-input]');
    var previews = container.querySelector('[data-gym-previews]');
    var notesEl = container.querySelector('[data-gym-notes]');
    var statusEl = container.querySelector('[data-gym-status]');
    var resultEl = container.querySelector('[data-gym-result]');

    function applyHomeGym(homeGym, statusMsg) {
      state.homeGym = homeGym;
      renderResult();
      if (statusMsg) setStatus(statusMsg);
      if (typeof opts.onResult === 'function') opts.onResult(state.homeGym);
    }

    function setStatus(msg, isError) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.hidden = !msg;
      statusEl.classList.toggle('home-gym-status--error', !!isError);
    }

    function renderPreviews() {
      if (!previews) return;
      previews.innerHTML = '';
      if (!state.attachments.length) {
        previews.hidden = true;
        if (scanBtn) scanBtn.disabled = true;
        return;
      }
      previews.hidden = false;
      if (scanBtn) scanBtn.disabled = state.busy;
      state.attachments.forEach(function (att, idx) {
        var chip = document.createElement('div');
        chip.className = 'home-gym-preview';
        var img = document.createElement('img');
        img.src = att.previewUrl || 'data:' + att.mediaType + ';base64,' + att.data;
        img.alt = 'Gym photo ' + (idx + 1);
        chip.appendChild(img);
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'home-gym-preview-remove';
        rm.setAttribute('aria-label', 'Remove photo');
        rm.textContent = '×';
        rm.addEventListener('click', function () {
          if (state.attachments[idx] && state.attachments[idx].previewUrl) {
            try {
              URL.revokeObjectURL(state.attachments[idx].previewUrl);
            } catch (e) {}
          }
          state.attachments.splice(idx, 1);
          renderPreviews();
        });
        chip.appendChild(rm);
        previews.appendChild(chip);
      });
    }

    function renderResult() {
      if (!resultEl) return;
      resultEl.innerHTML = renderResultHtml(state.homeGym);
      if (clearBtn) clearBtn.hidden = !(state.homeGym && state.homeGym.equipment && state.homeGym.equipment.length);
    }

    function setBusy(on) {
      state.busy = !!on;
      if (pickBtn) pickBtn.disabled = !!on;
      if (liveBtn) liveBtn.disabled = !!on;
      if (scanBtn) scanBtn.disabled = !!on || !state.attachments.length;
      if (clearBtn) clearBtn.disabled = !!on;
      if (fileInput) fileInput.disabled = !!on;
    }

    if (liveBtn) {
      liveBtn.addEventListener('click', function () {
        if (state.busy) return;
        setStatus('Opening camera…');
        openLiveWalkthrough({
          initial: state.homeGym,
          onUpdate: function (hg) {
            state.homeGym = hg;
            renderResult();
          },
          onClose: function (hg) {
            if (hg && hg.equipment && hg.equipment.length) {
              applyHomeGym(hg, 'Walk & scan saved — review equipment below.');
            } else {
              setStatus('Live scan closed.');
            }
          },
        }).catch(function (err) {
          setStatus((err && err.message) || 'Could not open camera.', true);
        });
      });
    }

    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileInput.files || [], 0);
        fileInput.value = '';
        var room = Math.max(0, MAX_IMAGES - state.attachments.length);
        files = files.slice(0, room);
        if (!files.length) return;
        setStatus('Preparing photos…');
        Promise.all(
          files.map(function (f) {
            return compressImageFile(f).catch(function () {
              return null;
            });
          })
        ).then(function (atts) {
          atts.forEach(function (a) {
            if (a) state.attachments.push(a);
          });
          renderPreviews();
          setStatus(state.attachments.length ? state.attachments.length + ' photo(s) ready.' : '');
        });
      });
    }

    if (scanBtn) {
      scanBtn.addEventListener('click', function () {
        if (state.busy || !state.attachments.length) return;
        if (typeof apiPost !== 'function') {
          setStatus('Could not reach the API.', true);
          return;
        }
        setBusy(true);
        setStatus('Rocky is scanning your gym…');
        apiPost('/coach/gym-scan', {
          images: state.attachments.map(function (a) {
            return { mediaType: a.mediaType, data: a.data };
          }),
          notes: notesEl ? notesEl.value.trim() : '',
        })
          .then(function (res) {
            return res.json().then(function (body) {
              return { res: res, body: body };
            });
          })
          .then(function (x) {
            if (!x.res.ok) {
              throw new Error((x.body && x.body.error) || 'Scan failed.');
            }
            state.homeGym = mergeHomeGym(state.homeGym, x.body.homeGym);
            renderResult();
            setStatus('Scan complete — review equipment below.');
            if (typeof opts.onResult === 'function') {
              opts.onResult(state.homeGym);
            }
          })
          .catch(function (err) {
            setStatus((err && err.message) || 'Scan failed.', true);
          })
          .finally(function () {
            setBusy(false);
          });
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.homeGym = null;
        renderResult();
        setStatus('Cleared home gym scan.');
        if (typeof opts.onClear === 'function') opts.onClear();
      });
    }

    renderResult();
    renderPreviews();

    return {
      getHomeGym: function () {
        return state.homeGym;
      },
      setHomeGym: function (hg) {
        state.homeGym = hg || null;
        renderResult();
      },
    };
  }

  window.HomeGymScan = {
    mount: mount,
    compressImageFile: compressImageFile,
    captureFrameFromVideo: captureFrameFromVideo,
    openLiveWalkthrough: openLiveWalkthrough,
    formatHomeGymForPrompt: formatHomeGymForPrompt,
    formatHomeGymNotesLine: formatHomeGymNotesLine,
    inferEquipmentTier: inferEquipmentTier,
    mergeMachineLabels: mergeMachineLabels,
    mergeHomeGym: mergeHomeGym,
    renderResultHtml: renderResultHtml,
  };
})();
