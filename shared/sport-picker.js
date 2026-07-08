(function () {
  function bindSportPicker(opts) {
    opts = opts || {};
    var inputId = opts.inputId || 'customize-sport';
    var hiddenId = opts.hiddenId || 'customize-sport-id';
    var datalistId = opts.datalistId || 'sport-datalist';
    var positionLabelId = opts.positionLabelId || null;
    var positionInputId = opts.positionInputId || null;
    var tipElId = opts.tipElId || null;
    var onChange = opts.onChange;

    var input = document.getElementById(inputId);
    if (!input) return;

    var hidden = hiddenId ? document.getElementById(hiddenId) : null;
    var datalist = document.getElementById(datalistId);
    if (!datalist && input.list) {
      datalist = document.getElementById(input.getAttribute('list'));
    }
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = datalistId;
      document.body.appendChild(datalist);
      input.setAttribute('list', datalistId);
    }

    var SD = window.SportDatabase;
    if (!SD) return;

    function refreshDatalist(query) {
      var list = SD.search(query || '', 20);
      datalist.innerHTML = '';
      list.forEach(function (sp) {
        var opt = document.createElement('option');
        opt.value = sp.name;
        opt.setAttribute('data-sport-id', sp.id);
        datalist.appendChild(opt);
      });
    }

    function applySport(sp) {
      if (hidden) hidden.value = sp ? sp.id : '';
      if (positionLabelId) {
        var lbl = document.getElementById(positionLabelId);
        if (lbl && sp) lbl.textContent = sp.positionLabel || 'Position / event';
      }
      if (tipElId) {
        var tipEl = document.getElementById(tipElId);
        if (tipEl) {
          if (sp && sp.liftingFocus) {
            tipEl.hidden = false;
            tipEl.innerHTML =
              '<strong>' +
              sp.name +
              ':</strong> ' +
              sp.liftingFocus;
          } else {
            tipEl.hidden = true;
            tipEl.innerHTML = '';
          }
        }
      }
      if (typeof onChange === 'function') onChange(sp);
    }

    function syncFromInput() {
      var val = input.value.trim();
      if (!val) {
        applySport(null);
        return;
      }
      var sp = SD.resolveSport(val) || SD.search(val, 1)[0] || null;
      if (sp && sp.name.toLowerCase() !== val.toLowerCase() && !SD.resolveSport(val)) {
        applySport(null);
        if (hidden) hidden.value = '';
        return;
      }
      applySport(sp);
      if (sp && input.value !== sp.name) input.value = sp.name;
    }

    refreshDatalist('');
    input.addEventListener('input', function () {
      refreshDatalist(input.value);
      syncFromInput();
    });
    input.addEventListener('change', syncFromInput);
    input.addEventListener('blur', syncFromInput);

    return {
      setSport: function (sportId, sportName) {
        if (sportId && SD.getById(sportId)) {
          var sp = SD.getById(sportId);
          input.value = sp.name;
          applySport(sp);
          return;
        }
        if (sportName) {
          input.value = sportName;
          syncFromInput();
          return;
        }
        input.value = '';
        applySport(null);
      },
      getSportId: function () {
        return hidden ? hidden.value : '';
      },
      getSportRecord: function () {
        var id = hidden && hidden.value ? hidden.value : null;
        if (id) return SD.getById(id);
        return SD.resolveSport(input.value.trim());
      },
    };
  }

  window.bindSportPicker = bindSportPicker;
})();
