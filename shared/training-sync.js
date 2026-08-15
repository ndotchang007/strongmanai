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
    if (window.WorkoutSplit && typeof window.WorkoutSplit.onUserChanged === 'function') {
      window.WorkoutSplit.onUserChanged(u.id);
    }
    if (window.CoachMemory && typeof window.CoachMemory.onUserChanged === 'function') {
      window.CoachMemory.onUserChanged();
    }
    if (window.WorkoutArchive && typeof window.WorkoutArchive.onUserChanged === 'function') {
      window.WorkoutArchive.onUserChanged();
    }
    if (window.WorkoutLog && typeof window.WorkoutLog.invalidateCache === 'function') {
      window.WorkoutLog.invalidateCache();
    }
  }

  function syncAll(opts) {
    opts = opts || {};
    if (!canSync()) {
      var skipped = {
        profile: false,
        workouts: false,
        prs: false,
        splits: false,
        coachMemory: false,
        templates: false,
      };
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

    var profileP =
      opts.includeProfile !== false &&
      typeof window.refreshCurrentUserFromServer === 'function'
        ? window.refreshCurrentUserFromServer()
        : Promise.resolve(false);

    var wl = window.WorkoutLog;
    var pr = window.PRLog;
    var ws = window.WorkoutSplit;
    var cm = window.CoachMemory;
    var wa = window.WorkoutArchive;

    syncInflight = profileP
      .then(function (profileOk) {
        var workoutsP =
          wl && typeof wl.syncFromServerAsync === 'function'
            ? wl.syncFromServerAsync()
            : Promise.resolve(false);
        return workoutsP.then(function (workoutsOk) {
          var prsP =
            pr && typeof pr.syncFromServerAsync === 'function'
              ? pr.syncFromServerAsync()
              : Promise.resolve(false);
          return prsP.then(function (prsOk) {
            var splitsP =
              ws && typeof ws.syncFromServerAsync === 'function'
                ? ws.syncFromServerAsync()
                : Promise.resolve(false);
            return splitsP.then(function (splitsOk) {
              var coachP =
                cm && typeof cm.syncFromServerAsync === 'function'
                  ? cm.syncFromServerAsync()
                  : Promise.resolve(false);
              return coachP.then(function (coachOk) {
                var templatesP =
                  wa && typeof wa.syncFromServerAsync === 'function'
                    ? wa.syncFromServerAsync()
                    : Promise.resolve(false);
                return templatesP.then(function (templatesOk) {
                  return {
                    profile: profileOk,
                    workouts: workoutsOk,
                    prs: prsOk,
                    splits: splitsOk,
                    coachMemory: coachOk,
                    templates: templatesOk,
                  };
                });
              });
            });
          });
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
        var fail = {
          profile: false,
          workouts: false,
          prs: false,
          splits: false,
          coachMemory: false,
          templates: false,
        };
        if (opts.callback) opts.callback(fail);
        return fail;
      });

    return syncInflight;
  }

  function bootSync(opts) {
    opts = opts || {};
    if (!canSync()) return;
    syncAll({ includeProfile: opts.includeProfile !== false });
  }

  window.TrainingSync = {
    syncAll: syncAll,
    bootSync: bootSync,
  };

  window.addEventListener('strongman:user-updated', function () {
    bootSync({ includeProfile: false });
  });
  window.addEventListener('online', bootSync);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') bootSync();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSync);
  } else {
    bootSync();
  }
})();
