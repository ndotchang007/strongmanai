/* Strongman AI — Web Push service worker */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var payload = {
    title: 'Strongman AI',
    body: 'You have a new update.',
    url: '/home',
    tag: 'strongman-push',
  };
  try {
    if (event.data) {
      var data = event.data.json();
      if (data && typeof data === 'object') {
        if (data.title) payload.title = String(data.title);
        if (data.body) payload.body = String(data.body);
        if (data.url) payload.url = String(data.url);
        if (data.tag) payload.tag = String(data.tag);
      }
    }
  } catch (e) {
    try {
      var text = event.data && event.data.text();
      if (text) payload.body = text;
    } catch (e2) {}
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          client.focus();
          if (client.navigate) client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
