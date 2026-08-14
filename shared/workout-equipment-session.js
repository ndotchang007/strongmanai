/**
 * Session equipment gate: gym camera scan (Roboflow) or tap-to-select equipment.
 */
(function () {
  var rootEl = null;
  var onDone = null;

  function ensureDom() {
    if (rootEl) return rootEl;
    rootEl = document.createElement('div');
    rootEl.id = 'workout-equipment-gate';
    rootEl.className = 'we-gate';
    rootEl.hidden = true;
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-labelledby', 'we-gate-title');
    document.body.appendChild(rootEl);
    return rootEl;
  }

  function close() {
    if (rootEl) rootEl.hidden = true;
    document.body.classList.remove('we-gate-open');
  }

  function finish(ids) {
    if (window.WorkoutPredict && window.WorkoutPredict.setSessionEquipment) {
      window.WorkoutPredict.setSessionEquipment(ids);
    }
    close();
    if (typeof onDone === 'function') onDone(ids);
  }

  function equipmentIdsFromHomeGym(homeGym) {
    var ids = {};
    ((homeGym && homeGym.equipment) || []).forEach(function (item) {
      if (item.equipmentId) {
        ids[item.equipmentId] = true;
        return;
      }
      if (window.EquipmentDetect && window.EquipmentDetect.mapClassToMeta) {
        var meta = window.EquipmentDetect.mapClassToMeta(item.name || item.category || '');
        if (meta && meta.equipmentId) ids[meta.equipmentId] = true;
      }
    });
    return Object.keys(ids);
  }

  function render() {
    var catalog =
      (window.WorkoutPredict && window.WorkoutPredict.EQUIPMENT_POPULARITY) || [];
    var selected = {};
    ((window.WorkoutPredict && window.WorkoutPredict.getUserEquipmentIds()) || []).forEach(
      function (id) {
        selected[id] = true;
      }
    );

    var listHtml = catalog
      .map(function (item) {
        return (
          '<button type="button" class="we-equip-btn' +
          (selected[item.id] ? ' is-selected' : '') +
          '" data-equip-id="' +
          item.id +
          '" aria-pressed="' +
          (selected[item.id] ? 'true' : 'false') +
          '">' +
          '<span class="we-equip-label">' +
          item.label +
          '</span>' +
          '</button>'
        );
      })
      .join('');

    rootEl.innerHTML =
      '<div class="we-gate-panel">' +
      '<h2 class="we-gate-title" id="we-gate-title">What can you train with?</h2>' +
      '<p class="we-gate-lede">Scan your gym with live detection or tap the gear you have — most common first.</p>' +
      '<div class="we-scan-row">' +
      '<button type="button" class="we-scan-btn" id="we-scan-camera">' +
      '<span class="we-new-banner">Live</span>' +
      '<span class="we-scan-icon" aria-hidden="true">📷</span>' +
      '<span class="we-scan-title">Scan gym</span>' +
      '<span class="we-scan-hint">Roboflow + directional HUD</span>' +
      '</button>' +
      '</div>' +
      '<div class="we-equip-list" id="we-equip-list" role="group" aria-label="Equipment">' +
      listHtml +
      '</div>' +
      '<div class="we-gate-actions">' +
      '<button type="button" class="wd-btn wd-btn--ghost" id="we-gate-skip">Use my saved setup</button>' +
      '<button type="button" class="wd-btn wd-btn--finish" id="we-gate-continue">Continue</button>' +
      '</div>' +
      '<p class="we-scan-status" id="we-scan-status" role="status" hidden></p>' +
      '</div>';

    rootEl.querySelectorAll('[data-equip-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-equip-id');
        selected[id] = !selected[id];
        btn.classList.toggle('is-selected', !!selected[id]);
        btn.setAttribute('aria-pressed', selected[id] ? 'true' : 'false');
      });
    });

    var scanBtn = document.getElementById('we-scan-camera');
    var status = document.getElementById('we-scan-status');
    if (scanBtn) {
      scanBtn.addEventListener('click', function () {
        if (!window.HomeGymScan || typeof window.HomeGymScan.openLiveWalkthrough !== 'function') {
          if (status) {
            status.hidden = false;
            status.textContent = 'Camera scan is unavailable on this page.';
          }
          return;
        }
        if (status) {
          status.hidden = false;
          status.textContent = 'Opening live detector…';
        }
        window.HomeGymScan.openLiveWalkthrough({
          onClose: function (homeGym) {
            var ids = equipmentIdsFromHomeGym(homeGym);
            if (!ids.length) {
              if (status) {
                status.hidden = false;
                status.textContent = 'No equipment locked in — pick from the list or scan again.';
              }
              return;
            }
            ids.forEach(function (id) {
              selected[id] = true;
            });
            rootEl.querySelectorAll('[data-equip-id]').forEach(function (btn) {
              var id = btn.getAttribute('data-equip-id');
              var on = !!selected[id];
              btn.classList.toggle('is-selected', on);
              btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            if (status) {
              status.hidden = false;
              status.textContent =
                'Detected ' + ids.length + ' equipment type' + (ids.length === 1 ? '' : 's') + '. Continue when ready.';
            }
          },
        }).catch(function (err) {
          if (status) {
            status.hidden = false;
            status.textContent = (err && err.message) || 'Could not open camera.';
          }
        });
      });
    }

    var skip = document.getElementById('we-gate-skip');
    if (skip) {
      skip.addEventListener('click', function () {
        finish(
          window.WorkoutPredict ? window.WorkoutPredict.getUserEquipmentIds() : []
        );
      });
    }
    var cont = document.getElementById('we-gate-continue');
    if (cont) {
      cont.addEventListener('click', function () {
        var ids = Object.keys(selected).filter(function (k) {
          return selected[k];
        });
        if (!ids.length) {
          if (status) {
            status.hidden = false;
            status.textContent = 'Pick at least one piece of equipment, Champ.';
          }
          return;
        }
        finish(ids);
      });
    }
  }

  function open(callback) {
    onDone = callback;
    ensureDom();
    render();
    rootEl.hidden = false;
    document.body.classList.add('we-gate-open');
  }

  window.WorkoutEquipmentSession = {
    open: open,
    close: close,
  };
})();
