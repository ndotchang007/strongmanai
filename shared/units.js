(function () {
  'use strict';

  var UNITS_KEY = 'strongman-home-units';

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function lbToKg(lb) {
    return round1(lb * 0.453592);
  }

  function kgToLb(kg) {
    return Math.round(kg / 0.453592);
  }

  function inToCm(inches) {
    return Math.round(inches * 2.54);
  }

  function cmToIn(cm) {
    return Math.round(cm / 2.54);
  }

  function getUnits() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (u && u.measurement) return u.measurement === 'metric' ? 'metric' : 'imperial';
    try {
      var stored = localStorage.getItem(UNITS_KEY);
      return stored === 'metric' ? 'metric' : 'imperial';
    } catch (e) {
      return 'imperial';
    }
  }

  function weightLabel(units) {
    return (units || getUnits()) === 'metric' ? 'kg' : 'lb';
  }

  function heightLabel(units) {
    return (units || getUnits()) === 'metric' ? 'cm' : 'in';
  }

  function convertWeight(value, fromUnits, toUnits) {
    if (value == null || value === '' || isNaN(value)) return null;
    var n = parseFloat(value);
    if (fromUnits === toUnits) return n;
    if (fromUnits === 'imperial' && toUnits === 'metric') return lbToKg(n);
    if (fromUnits === 'metric' && toUnits === 'imperial') return kgToLb(n);
    return n;
  }

  function convertHeight(value, fromUnits, toUnits) {
    if (value == null || value === '' || isNaN(value)) return null;
    var n = parseFloat(value);
    if (fromUnits === toUnits) return n;
    if (fromUnits === 'imperial' && toUnits === 'metric') return inToCm(n);
    if (fromUnits === 'metric' && toUnits === 'imperial') return cmToIn(n);
    return n;
  }

  function formatWeight(value, units) {
    if (value == null || value === '') return '';
    var u = units || getUnits();
    var n = convertWeight(value, 'metric', u);
    if (n == null) return '';
    return String(u === 'metric' ? round1(n) : Math.round(n));
  }

  window.Units = {
    UNITS_KEY: UNITS_KEY,
    getUnits: getUnits,
    weightLabel: weightLabel,
    heightLabel: heightLabel,
    convertWeight: convertWeight,
    convertHeight: convertHeight,
    formatWeight: formatWeight,
    lbToKg: lbToKg,
    kgToLb: kgToLb,
    inToCm: inToCm,
    cmToIn: cmToIn,
  };
})();
