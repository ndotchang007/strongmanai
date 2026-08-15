(function () {
  'use strict';

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function canUsePush() {
    return !!(
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      window.isLoggedIn &&
      window.isLoggedIn()
    );
  }

  function registerServiceWorker() {
    if (window.StrongmanPWA && typeof window.StrongmanPWA.registerServiceWorker === 'function') {
      return window.StrongmanPWA.registerServiceWorker();
    }
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (err) {
      console.warn('[push] service worker registration failed', err);
      return null;
    });
  }

  function fetchVapidPublicKey() {
    if (typeof window.apiGet !== 'function') return Promise.resolve(null);
    return window
      .apiGet('/notifications/vapid-public-key')
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (body) {
        return body && body.publicKey ? String(body.publicKey) : null;
      })
      .catch(function () {
        return null;
      });
  }

  function subscribe() {
    if (!canUsePush()) return Promise.resolve({ ok: false, reason: 'unsupported' });
    return registerServiceWorker()
      .then(function () {
        return navigator.serviceWorker.ready;
      })
      .then(function (reg) {
        return fetchVapidPublicKey().then(function (publicKey) {
          if (!publicKey) {
            return { ok: false, reason: 'not_configured', registration: reg };
          }
          return reg.pushManager.getSubscription().then(function (existing) {
            if (existing) return existing;
            return reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
          });
        });
      })
      .then(function (subOrResult) {
        if (subOrResult && subOrResult.ok === false) return subOrResult;
        var sub = subOrResult;
        if (!sub || typeof window.apiPost !== 'function') {
          return { ok: false, reason: 'no_subscription' };
        }
        var json = typeof sub.toJSON === 'function' ? sub.toJSON() : sub;
        return window
          .apiPost('/notifications/push-subscription', {
            endpoint: json.endpoint,
            keys: json.keys,
          })
          .then(function (res) {
            if (!res.ok) throw new Error('save_failed');
            return { ok: true, subscription: sub };
          });
      })
      .catch(function (err) {
        console.warn('[push] subscribe failed', err);
        return { ok: false, reason: (err && err.message) || 'subscribe_failed' };
      });
  }

  function unsubscribe() {
    if (!('serviceWorker' in navigator)) return Promise.resolve({ ok: true });
    return navigator.serviceWorker.ready
      .then(function (reg) {
        return reg.pushManager.getSubscription();
      })
      .then(function (sub) {
        if (!sub) return { ok: true };
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          if (typeof window.apiDelete === 'function') {
            return window
              .apiDelete('/notifications/push-subscription', { endpoint: endpoint })
              .catch(function () {})
              .then(function () {
                return { ok: true };
              });
          }
          if (typeof window.apiPost === 'function') {
            return window
              .apiPost('/notifications/push-subscription/delete', { endpoint: endpoint })
              .catch(function () {})
              .then(function () {
                return { ok: true };
              });
          }
          return { ok: true };
        });
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function syncReminderSchedule(schedule) {
    if (!window.isLoggedIn || !window.isLoggedIn() || typeof window.apiPut !== 'function') {
      return Promise.resolve(false);
    }
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!u || !u.id) return Promise.resolve(false);
    var tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {}
    return window
      .apiPut('/users/' + u.id, {
        notifyPush: localStorage.getItem('strongman-home-notify-push') === '1',
        reminderSchedule: schedule || null,
        reminderTimezone: tz || null,
      })
      .then(function (res) {
        return res.ok;
      })
      .catch(function () {
        return false;
      });
  }

  function ensureRegisteredIfEnabled() {
    if (localStorage.getItem('strongman-home-notify-push') !== '1') return Promise.resolve();
    if (!('Notification' in window) || Notification.permission !== 'granted') return Promise.resolve();
    return registerServiceWorker().then(function () {
      return subscribe();
    });
  }

  window.StrongmanPush = {
    canUsePush: canUsePush,
    registerServiceWorker: registerServiceWorker,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    syncReminderSchedule: syncReminderSchedule,
    ensureRegisteredIfEnabled: ensureRegisteredIfEnabled,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ensureRegisteredIfEnabled();
    });
  } else {
    ensureRegisteredIfEnabled();
  }
})();
