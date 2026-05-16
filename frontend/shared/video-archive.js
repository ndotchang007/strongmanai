/**
 * IndexedDB store for locally saved upload drafts (Create → video).
 */
(function () {
  var DB_NAME = 'strongmanai_video_archive_v1';
  var STORE = 'videos';

  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onerror = function () {
        reject(req.error);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
    return dbPromise;
  }

  function add(entry) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.add(entry);
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function getAll() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () {
          resolve(req.result || []);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function remove(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function update(id, mutator) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.get(id);
        req.onsuccess = function () {
          var row = req.result;
          if (!row) {
            reject(new Error('not_found'));
            return;
          }
          try {
            mutator(row);
          } catch (e) {
            reject(e);
            return;
          }
          var putReq = store.put(row);
          putReq.onsuccess = function () {
            resolve(row);
          };
          putReq.onerror = function () {
            reject(putReq.error);
          };
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  /**
   * Keeps an optional audio overlay aligned with a video using trim window [trimStart, trimEnd] on the audio file.
   */
  function attachSyncedPlayback(videoEl, audioEl, options) {
    if (!videoEl || !audioEl) {
      return { destroy: function () {} };
    }
    var trimStart = Math.max(0, Number(options && options.trimStart) || 0);
    var trimEnd =
      options && options.trimEnd != null && !isNaN(options.trimEnd)
        ? Number(options.trimEnd)
        : Infinity;
    var muteOriginal = options && !!options.muteOriginal;

    function onPlay() {
      if (!audioEl.src) return;
      videoEl.muted = muteOriginal;
      var t = trimStart + videoEl.currentTime;
      if (t >= trimEnd) return;
      audioEl.currentTime = Math.min(Math.max(trimStart, t), trimEnd - 0.001);
      audioEl.play().catch(function () {});
    }

    function onPause() {
      audioEl.pause();
    }

    function onSeeked() {
      if (!audioEl.src) return;
      videoEl.muted = muteOriginal;
      var t = trimStart + videoEl.currentTime;
      if (t >= trimEnd) {
        audioEl.pause();
        return;
      }
      audioEl.currentTime = Math.min(Math.max(trimStart, t), trimEnd - 0.001);
    }

    function onTimeUpdate() {
      if (!audioEl.src || audioEl.paused) return;
      var at = trimStart + videoEl.currentTime;
      if (at >= trimEnd) {
        audioEl.pause();
        return;
      }
      if (Math.abs(audioEl.currentTime - at) > 0.45) {
        audioEl.currentTime = Math.min(at, trimEnd - 0.001);
      }
    }

    function onEnded() {
      audioEl.pause();
    }

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('ended', onEnded);

    return {
      destroy: function () {
        videoEl.removeEventListener('play', onPlay);
        videoEl.removeEventListener('pause', onPause);
        videoEl.removeEventListener('seeked', onSeeked);
        videoEl.removeEventListener('timeupdate', onTimeUpdate);
        videoEl.removeEventListener('ended', onEnded);
        try {
          audioEl.pause();
        } catch (e) {}
      }
    };
  }

  function incrementViewCount(id) {
    return update(id, function (row) {
      var n = Number(row.viewCount);
      row.viewCount = (Number.isFinite(n) ? n : 0) + 1;
    });
  }

  /** One increment per archive id per browser tab (Explore, Home, etc.). */
  var tabViewCountedIds = new Set();

  function recordPlaybackView(id) {
    if (id == null || tabViewCountedIds.has(id)) {
      return Promise.resolve(false);
    }
    tabViewCountedIds.add(id);
    return incrementViewCount(id)
      .then(function () {
        try {
          window.dispatchEvent(new CustomEvent('strongman-video-views-changed'));
        } catch (e) {}
        return true;
      })
      .catch(function () {
        tabViewCountedIds.delete(id);
        return false;
      });
  }

  window.VideoArchive = {
    add: add,
    getAll: getAll,
    remove: remove,
    update: update,
    attachSyncedPlayback: attachSyncedPlayback,
    incrementViewCount: incrementViewCount,
    recordPlaybackView: recordPlaybackView
  };
})();
