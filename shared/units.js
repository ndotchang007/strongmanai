(function () {
  'use strict';

  var UNITS_KEY = 'strongman-home-units';
  var INCREMENT_KEY = 'strongman-home-weight-increment';

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

  /** @returns {'standard'|'fine'|'personal'} */
  function getWeightIncrementMode() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ac = u && u.athleteContext;
    if (ac && (ac.weightIncrement === 'standard' || ac.weightIncrement === 'fine' || ac.weightIncrement === 'personal')) {
      return ac.weightIncrement;
    }
    try {
      var stored = localStorage.getItem(INCREMENT_KEY);
      if (stored === 'fine' || stored === 'personal' || stored === 'standard') return stored;
    } catch (e) {}
    return 'standard';
  }

  function setWeightIncrementMode(mode) {
    var next = mode === 'fine' || mode === 'personal' ? mode : 'standard';
    try {
      localStorage.setItem(INCREMENT_KEY, next);
    } catch (e) {}
    return next;
  }

  function personalIncrementFromHomeGym(homeGym, units) {
    if (!homeGym || !Array.isArray(homeGym.equipment)) return null;
    var metric = (units || getUnits()) === 'metric';
    var steps = [];
    homeGym.equipment.forEach(function (item) {
      var cal = item && item.weightCalibration;
      if (!cal) return;
      var examples = Array.isArray(cal.examples) ? cal.examples : [];
      if (examples.length >= 2) {
        var a = parseFloat(examples[0].actual);
        var b = parseFloat(examples[1].actual);
        if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
          var step = Math.abs(b - a);
          var unit = String(cal.actualUnit || 'lb').toLowerCase();
          if (metric && unit.indexOf('kg') === -1) step = lbToKg(step);
          if (!metric && unit.indexOf('kg') !== -1) step = kgToLb(step);
          if (step > 0) steps.push(step);
        }
      }
      if (cal.rule) {
        var m = String(cal.rule).match(/(\d+(?:\.\d+)?)\s*(lb|kg)/i);
        if (m) {
          var step2 = parseFloat(m[1]);
          var u2 = m[2].toLowerCase();
          if (metric && u2 === 'lb') step2 = lbToKg(step2);
          if (!metric && u2 === 'kg') step2 = kgToLb(step2);
          if (step2 > 0) steps.push(step2);
        }
      }
    });
    if (acPersonalStep(units)) steps.push(acPersonalStep(units));
    if (!steps.length) return null;
    steps.sort(function (a, b) {
      return a - b;
    });
    return round1(steps[0]);
  }

  function acPersonalStep(units) {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var ac = u && u.athleteContext;
    if (!ac || ac.personalWeightStep == null) return null;
    var n = parseFloat(ac.personalWeightStep);
    if (!Number.isFinite(n) || n <= 0) return null;
    var storedUnits = ac.personalWeightStepUnits === 'metric' ? 'metric' : 'imperial';
    var want = units || getUnits();
    if (storedUnits === want) return round1(n);
    return convertWeight(n, storedUnits, want);
  }

  /**
   * Step used by weight number inputs.
   * standard: 5 lb / 2.5 kg
   * fine: 2.5 lb / 1.25 kg
   * personal: from scanned equipment calibration or athleteContext.personalWeightStep
   */
  function getWeightStep(units) {
    var u = units || getUnits();
    var mode = getWeightIncrementMode();
    if (mode === 'personal') {
      var homeGym = null;
      try {
        var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
        homeGym = user && user.athleteContext && user.athleteContext.homeGym;
      } catch (e) {}
      var personal = personalIncrementFromHomeGym(homeGym, u) || acPersonalStep(u);
      if (personal && personal > 0) return personal;
      // Fallback until a scan exists
      return u === 'metric' ? 1.25 : 2.5;
    }
    if (mode === 'fine') return u === 'metric' ? 1.25 : 2.5;
    return u === 'metric' ? 2.5 : 5;
  }

  function applyWeightStepsToDocument(root) {
    var scope = root || document;
    var step = String(getWeightStep());
    var nodes = scope.querySelectorAll(
      'input[data-weight-step], input.create-exercise-weight, input.create-superset-weight, input.wt-set-input--weight, #tracking-pr-wl-weight'
    );
    nodes.forEach(function (inp) {
      try {
        inp.step = step;
      } catch (e) {}
    });
  }

  window.Units = {
    UNITS_KEY: UNITS_KEY,
    INCREMENT_KEY: INCREMENT_KEY,
    getUnits: getUnits,
    weightLabel: weightLabel,
    heightLabel: heightLabel,
    convertWeight: convertWeight,
    convertHeight: convertHeight,
    formatWeight: formatWeight,
    getWeightIncrementMode: getWeightIncrementMode,
    setWeightIncrementMode: setWeightIncrementMode,
    getWeightStep: getWeightStep,
    applyWeightStepsToDocument: applyWeightStepsToDocument,
    lbToKg: lbToKg,
    kgToLb: kgToLb,
    inToCm: inToCm,
    cmToIn: cmToIn,
  };

  function bootApplySteps() {
    applyWeightStepsToDocument();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApplySteps);
  } else {
    bootApplySteps();
  }
  window.addEventListener('strongman:units-changed', bootApplySteps);
  window.addEventListener('strongman:weight-increment-changed', bootApplySteps);
})();
