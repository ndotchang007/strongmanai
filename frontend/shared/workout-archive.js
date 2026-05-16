(function () {
  var STORAGE_BASE = 'strongman_workout_archive_v1';

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

  function load() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return { templates: [] };
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.templates)) return { templates: [] };
      return data;
    } catch (e) {
      return { templates: [] };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(data));
    } catch (e) {}
  }

  function list() {
    return load().templates.slice();
  }

  /**
   * @param {{ name?: string, bodyText: string, source?: string }} entry
   */
  function add(entry) {
    var body = (entry && entry.bodyText) || '';
    body = String(body).trim();
    if (!body) return null;
    var store = load();
    var name = (entry && entry.name && String(entry.name).trim()) || 'Saved workout';
    var item = {
      id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
      name: name.slice(0, 120),
      bodyText: body.slice(0, 32000),
      source: entry && entry.source ? String(entry.source).slice(0, 32) : 'manual',
      createdAt: new Date().toISOString()
    };
    store.templates.unshift(item);
    save(store);
    return item;
  }

  function remove(id) {
    var store = load();
    store.templates = store.templates.filter(function (t) {
      return t && t.id !== id;
    });
    save(store);
  }

  window.WorkoutArchive = {
    list: list,
    add: add,
    remove: remove,
    _storageKey: storageKey
  };
})();
