(function () {
  var STORAGE_BASE = 'strongman-coach-memory';

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

  var syncInflight = null;
  var pushTimer = null;

  function userSuffix() {
    try {
      if (typeof window.getCurrentUser !== 'function') return '_guest';
      var u = window.getCurrentUser();
      return u && u.id != null ? '_u' + u.id : '_guest';
    } catch (e) {
      return '_guest';
    }
  }

  function storageKey() {
    return STORAGE_BASE + userSuffix();
  }

  function canSync() {
    return !!(
      window.isLoggedIn &&
      window.isLoggedIn() &&
      window.getCurrentUser &&
      window.apiGet &&
      window.apiPut
    );
  }

  function defaultStore() {
    return { items: [], updatedAt: null, _syncPending: false };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return defaultStore();
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return defaultStore();
      if (!Array.isArray(data.items)) {
        if (Array.isArray(data)) return { items: data, updatedAt: null, _syncPending: false };
        return defaultStore();
      }
      return data;
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore(store, opts) {
    opts = opts || {};
    try {
      if (!opts.skipTouch) store.updatedAt = new Date().toISOString();
      if (!opts.skipSyncFlag) store._syncPending = true;
      localStorage.setItem(storageKey(), JSON.stringify(store));
      if (!opts.skipPush) schedulePushToServer();
    } catch (e) {}
  }

  function stripSyncMeta(store) {
    return {
      items: Array.isArray(store.items) ? store.items.slice(-12) : [],
      updatedAt: store.updatedAt || null,
    };
  }

  function storeTimestamp(store) {
    if (!store) return 0;
    var t = store.updatedAt || store.serverUpdatedAt;
    if (!t) return 0;
    var ms = Date.parse(t);
    return isNaN(ms) ? 0 : ms;
  }

  function applyFromServer(store) {
    if (!store || typeof store !== 'object') return;
    var next = {
      items: Array.isArray(store.items) ? store.items.slice(-12) : [],
      updatedAt: store.updatedAt || store.serverUpdatedAt || new Date().toISOString(),
      serverUpdatedAt: store.serverUpdatedAt || store.updatedAt || null,
      _syncPending: false,
    };
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next));
    } catch (e) {}
  }

  function load() {
    return loadStore().items.slice();
  }

  function save(items) {
    var store = loadStore();
    store.items = (items || []).slice(-12);
    saveStore(store);
    return store.items.slice();
  }

  function pushToServerAsync(store) {
    if (!canSync()) return Promise.resolve(false);
    store = store || loadStore();
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(false);
    var payload = stripSyncMeta(store);
    return window
      .apiPut('/users/' + u.id + '/coach-memory', { payload: payload })
      .then(function (res) {
        if (!res.ok) return false;
        return res.json();
      })
      .then(function (saved) {
        if (!saved) return false;
        applyFromServer(saved);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function pullFromServerAsync() {
    if (!canSync()) return Promise.resolve(null);
    var u = window.getCurrentUser();
    if (!u || u.id == null) return Promise.resolve(null);
    return window
      .apiGet('/users/' + u.id + '/coach-memory')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (body) {
        return body && typeof body === 'object' ? body : null;
      })
      .catch(function () {
        return null;
      });
  }

  function schedulePushToServer() {
    if (!canSync()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushToServerAsync();
    }, 600);
  }

  function syncFromServerAsync() {
    if (!canSync()) return Promise.resolve(false);
    if (syncInflight) return syncInflight;
    syncInflight = pullFromServerAsync()
      .then(function (serverStore) {
        var localStore = loadStore();
        var localHasItems = localStore.items && localStore.items.length;
        if (!serverStore && localHasItems) {
          return pushToServerAsync(localStore);
        }
        if (serverStore && !localHasItems) {
          applyFromServer(serverStore);
          return true;
        }
        if (serverStore && localHasItems) {
          var localTs = storeTimestamp(localStore);
          var serverTs = storeTimestamp(serverStore);
          if (localStore._syncPending || localTs > serverTs) {
            return pushToServerAsync(localStore);
          }
          if (serverTs > localTs) {
            applyFromServer(serverStore);
            return true;
          }
          if (localStore._syncPending) return pushToServerAsync(localStore);
          return true;
        }
        return true;
      })
      .then(function (ok) {
        syncInflight = null;
        return !!ok;
      })
      .catch(function () {
        syncInflight = null;
        return false;
      });
    return syncInflight;
  }

  function onUserChanged() {
    if (canSync()) syncFromServerAsync();
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
      if (idx >= 0) items[idx] = hit;
      else items.push(hit);
    });
    return save(items);
  }

  function clear() {
    var store = defaultStore();
    saveStore(store, { skipSyncFlag: false });
    if (canSync()) schedulePushToServer();
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
    syncFromServerAsync: syncFromServerAsync,
    onUserChanged: onUserChanged,
  };
})();
