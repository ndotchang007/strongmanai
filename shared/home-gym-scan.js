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
      '<div class="home-gym-live-reticle" aria-hidden="true"></div>' +
      '<div class="home-gym-live-top">' +
      '<p class="home-gym-live-hint">Walk around · center gear in the ring · tap Recognize</p>' +
      '<button type="button" class="home-gym-live-close" data-live-close aria-label="Close camera">×</button>' +
      '</div>' +
      '<div class="home-gym-live-toast" data-live-toast hidden></div>' +
      '<div class="home-gym-live-dock">' +
      '<p class="home-gym-live-count" data-live-count>0 items found</p>' +
      '<button type="button" class="home-gym-live-recognize" data-live-recognize>Recognize</button>' +
      '<button type="button" class="home-gym-live-done" data-live-done>Done</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('home-gym-live-open');

    var video = overlay.querySelector('.home-gym-live-video');
    var toastEl = overlay.querySelector('[data-live-toast]');
    var countEl = overlay.querySelector('[data-live-count]');
    var recognizeBtn = overlay.querySelector('[data-live-recognize]');
    var doneBtn = overlay.querySelector('[data-live-done]');
    var closeBtn = overlay.querySelector('[data-live-close]');
    var stream = null;
    var busy = false;
    var inventory = opts.initial ? JSON.parse(JSON.stringify(opts.initial)) : null;

    function toast(msg, isError) {
      if (!toastEl) return;
      toastEl.textContent = msg || '';
      toastEl.hidden = !msg;
      toastEl.classList.toggle('home-gym-live-toast--error', !!isError);
    }

    function updateCount() {
      var n = inventory && inventory.equipment ? inventory.equipment.length : 0;
      if (countEl) {
        countEl.textContent = n + ' item' + (n === 1 ? '' : 's') + ' found';
      }
    }

    function closeLive(finalInventory) {
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
        recognizeBtn.textContent = on ? 'Recognizing…' : 'Recognize';
      }
      if (doneBtn) doneBtn.disabled = !!on;
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

        function onRecognize() {
          if (busy) return;
          if (typeof apiPost !== 'function') {
            toast('Could not reach the API.', true);
            return;
          }
          setBusy(true);
          toast('Rocky is looking…');
          captureFrameFromVideo(video)
            .then(function (frame) {
              return apiPost('/coach/gym-scan', {
                images: [frame],
                notes:
                  'LIVE POINT-AND-SCAN: The athlete is walking around their gym pointing the camera. Identify the equipment centered in the viewfinder (primary focus). Include brand if visible and weightCalibration for numbered stacks (e.g. pin 1=10 lb). Keep the list short — usually 1 primary item, plus any clearly attached accessories.',
              }).then(function (res) {
                return res.json().then(function (body) {
                  return { res: res, body: body };
                });
              });
            })
            .then(function (x) {
              if (!x.res.ok) {
                throw new Error((x.body && x.body.error) || 'Could not recognize that.');
              }
              var found = x.body.homeGym;
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
            })
            .catch(function (err) {
              toast((err && err.message) || 'Recognition failed.', true);
            })
            .finally(function () {
              setBusy(false);
            });
        }

        if (recognizeBtn) recognizeBtn.addEventListener('click', onRecognize);
        if (doneBtn) {
          doneBtn.addEventListener('click', function () {
            if (busy) return;
            closeLive(inventory);
          });
        }
        if (closeBtn) {
          closeBtn.addEventListener('click', function () {
            if (busy) return;
            closeLive(inventory);
          });
        }

        return {
          close: function () {
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
      '<p class="home-gym-scan-desc">Take a photo or walk the room with live camera. Rocky names the gear and reads weight increments (e.g. pin 1–4 = 10 lb steps), then saves them to your profile.</p>' +
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
