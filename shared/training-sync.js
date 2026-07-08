/**
 * Training data sync — pushes pending local workouts/PRs to the database
 * and pulls the latest on login and page load for cross-device use.
 */
(function () {
  'use strict';

  var syncInflight = null;

  function canSync() {
    return !!(window.isLoggedIn && window.isLoggedIn() && window.getCurrentUser);
  }

  function prepareUserNamespace() {
    var u = window.getCurrentUser && window.getCurrentUser();
    if (!u || u.id == null) return;
    if (window.WorkoutLog && typeof window.WorkoutLog.onUserChanged === 'function') {
      window.WorkoutLog.onUserChanged(u.id);
    }
    if (window.PRLog && typeof window.PRLog.onUserChanged === 'function') {
      window.PRLog.onUserChanged(u.id);
    }
    if (window.WorkoutLog && typeof window.WorkoutLog.invalidateCache === 'function') {
      window.WorkoutLog.invalidateCache();
    }
  }

  function syncAll(opts) {
    opts = opts || {};
    if (!canSync()) {
      var skipped = { workouts: false, prs: false };
      if (opts.callback) opts.callback(skipped);
      return Promise.resolve(skipped);
    }

    prepareUserNamespace();

    if (syncInflight) {
      if (opts.callback) {
        syncInflight.then(function (result) {
          opts.callback(result);
        });
      }
      return syncInflight;
    }

    var wl = window.WorkoutLog;
    var pr = window.PRLog;
    var workoutsP =
      wl && typeof wl.syncFromServerAsync === 'function'
        ? wl.syncFromServerAsync()
        : Promise.resolve(false);

    syncInflight = workoutsP
      .then(function (workoutsOk) {
        var prsP =
          pr && typeof pr.syncFromServerAsync === 'function'
            ? pr.syncFromServerAsync()
            : Promise.resolve(false);
        return prsP.then(function (prsOk) {
          return { workouts: workoutsOk, prs: prsOk };
        });
      })
      .then(function (result) {
        syncInflight = null;
        try {
          window.dispatchEvent(
            new CustomEvent('strongman:training-synced', { detail: result })
          );
        } catch (e) {}
        if (opts.callback) opts.callback(result);
        return result;
      })
      .catch(function () {
        syncInflight = null;
        var fail = { workouts: false, prs: false };
        if (opts.callback) opts.callback(fail);
        return fail;
      });

    return syncInflight;
  }

  function bootSync() {
    if (!canSync()) return;
    syncAll();
  }

  window.TrainingSync = {
    syncAll: syncAll,
    bootSync: bootSync,
  };

  window.addEventListener('strongman:user-updated', bootSync);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSync);
  } else {
    bootSync();
  }
})();
