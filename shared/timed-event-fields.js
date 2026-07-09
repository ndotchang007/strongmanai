/**
 * Parse and normalize sport / distance / event fields for timed personal records.
 */
(function () {
  function trim(s) {
    return String(s || '').trim();
  }

  function parseTimeDisplaySeconds(valueDisplay) {
    if (!valueDisplay || typeof valueDisplay !== 'string') return null;
    var raw = valueDisplay.trim();
    if (!raw) return null;
    var secOnly = /^(\d+(?:\.\d+)?)\s*s$/i.exec(raw);
    if (secOnly) {
      var n = parseFloat(secOnly[1]);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    var parts = raw.split(':');
    if (parts.length === 2) {
      var mins = parseInt(parts[0], 10);
      var secs = parseFloat(parts[1]);
      if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0) return null;
      var total = mins * 60 + secs;
      return total > 0 ? total : null;
    }
    return null;
  }

  function parseSwimmingEvent(raw) {
    var t = trim(raw);
    if (!t) return { distance: '', event: '' };
    var m = /^([\d.]+\s*(?:m|km|yd|yards?))\s+(.+)$/i.exec(t);
    if (m) {
      return { distance: trim(m[1]), event: trim(m[2]) };
    }
    m = /^([\d.]+\s*(?:m|km|yd))(.+)$/i.exec(t.replace(/\s+/g, ''));
    if (m) {
      return { distance: trim(m[1]), event: trim(m[2]) };
    }
    return { distance: t, event: t };
  }

  function parseRunningEvent(raw) {
    var t = trim(raw);
    if (!t) return { distance: '', event: '' };
    return { distance: t, event: t };
  }

  function stripCourseFromEventLabel(eventLabel) {
    var label = trim(eventLabel);
    if (!label) return '';
    return label.replace(/\s*\((?:SCM|LCM|SCY|LCY|short course|long course)\)\s*$/i, '').trim();
  }

  function enrichRecord(record) {
    if (!record || typeof record !== 'object') return record;
    var out = Object.assign({}, record);
    var discipline = trim(out.discipline || out.sport).toLowerCase();
    if (discipline !== 'running' && discipline !== 'swimming') return out;

    out.sport = discipline;
    out.discipline = discipline;

    var baseLabel = stripCourseFromEventLabel(out.eventLabel);
    var parsed =
      discipline === 'swimming'
        ? parseSwimmingEvent(baseLabel)
        : parseRunningEvent(baseLabel);

    if (parsed.distance) out.distance = parsed.distance;
    if (parsed.event) out.event = parsed.event;

    var secs = parseTimeDisplaySeconds(out.valueDisplay);
    if (secs != null) out.valueSeconds = secs;

    return out;
  }

  window.TimedEventFields = {
    parseRunningEvent: parseRunningEvent,
    parseSwimmingEvent: parseSwimmingEvent,
    parseTimeDisplaySeconds: parseTimeDisplaySeconds,
    enrichRecord: enrichRecord,
  };
})();
