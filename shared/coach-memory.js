(function () {
  var STORAGE_KEY = 'strongman-coach-memory';

  var SIGNAL_DEFS = [
    {
      id: 'sick',
      label: 'Feeling unwell',
      patterns: [
        /\b(sick|ill|not feeling well|under the weather|coming down with|got a cold|have a cold|fever|flu|nausea|vomit|throwing up)\b/i,
      ],
    },
    {
      id: 'sore',
      label: 'Muscle soreness',
      patterns: [/\b(sore|achy|tight muscles|really tight|tender|doms)\b/i],
    },
    {
      id: 'fatigue',
      label: 'Fatigue / low energy',
      patterns: [
        /\b(tired|exhausted|fatigue|fatigued|burned out|burnt out|no energy|low energy|drained|wiped)\b/i,
      ],
    },
    {
      id: 'heavy_practice',
      label: 'Heavy practice load',
      patterns: [
        /\b(heavy practice|hard practice|killer practice|long practice|brutal practice|two-a-day|2-a-day|double practice)\b/i,
      ],
    },
    {
      id: 'poor_sleep',
      label: 'Poor sleep',
      patterns: [
        /\b(didn'?t sleep|bad sleep|no sleep|couldn'?t sleep|only \d+ hours? of sleep|insomnia|slept badly)\b/i,
      ],
    },
    {
      id: 'injury',
      label: 'Pain / injury concern',
      patterns: [
        /\b(hurt my|injured|injury|pain in|sprain|strained|pulled a|pulled my|twisted my|can'?t move my)\b/i,
      ],
    },
    {
      id: 'stress',
      label: 'Stress / school pressure',
      patterns: [
        /\b(stressed|stressful|exam|test tomorrow|midterm|finals week|too much homework|overwhelmed)\b/i,
      ],
    },
    {
      id: 'game_nerves',
      label: 'Pre-competition nerves',
      patterns: [
        /\b(nervous|anxious|jitters).*(game|match|meet|competition)/i,
        /\bpre[- ]?(game|match) nerves\b/i,
      ],
    },
    {
      id: 'travel',
      label: 'Travel / away game',
      patterns: [/\b(away game|on the road|traveling|bus ride|tournament weekend)\b/i],
    },
    {
      id: 'deload',
      label: 'Needs lighter week',
      patterns: [/\b(deload|back off|ease up|take it easy|need a break|overtrained)\b/i],
    },
  ];

  function load() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function save(items) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-12)));
    } catch (e) {}
  }

  function snippetFromMessage(text, maxLen) {
    var s = String(text || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (s.length <= (maxLen || 72)) return s;
    return s.slice(0, maxLen || 72) + '…';
  }

  function scanMessage(text) {
    var msg = String(text || '');
    if (!msg.trim()) return [];
    var found = [];
    SIGNAL_DEFS.forEach(function (def) {
      for (var i = 0; i < def.patterns.length; i++) {
        if (def.patterns[i].test(msg)) {
          found.push({
            id: def.id,
            label: def.label,
            snippet: snippetFromMessage(msg),
            at: Date.now(),
          });
          break;
        }
      }
    });
    return found;
  }

  function ingestUserMessage(text) {
    var hits = scanMessage(text);
    if (!hits.length) return load();
    var items = load();
    hits.forEach(function (hit) {
      var idx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === hit.id) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        items[idx] = hit;
      } else {
        items.push(hit);
      }
    });
    save(items);
    return items;
  }

  function clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    return [];
  }

  function buildPromptBlock(items) {
    if (!items || !items.length) return '';
    var lines = ['[Session signals — athlete mentioned these; adjust volume, intensity, and advice]'];
    items.forEach(function (item) {
      var line = '- ' + item.label;
      if (item.snippet) line += ' (they said: "' + item.snippet + '")';
      lines.push(line);
    });
    lines.push('[End session signals]');
    return lines.join('\n');
  }

  window.CoachMemory = {
    load: load,
    save: save,
    clear: clear,
    ingestUserMessage: ingestUserMessage,
    scanMessage: scanMessage,
    buildPromptBlock: buildPromptBlock,
    SIGNAL_DEFS: SIGNAL_DEFS,
  };
})();
