/* Strongman AI — app-shell service worker (logged-in routes only; no marketing pages) */
var CACHE_VERSION = 'strongman-app-shell-v2';

var APP_SHELL = [
  '/manifest.webmanifest',
  '/assets/logo.png',
  '/login.html',
  '/shared/theme.js',
  '/shared/api.js',
  '/shared/offline-db.js',
  '/shared/pwa-client.js',
  '/css/site-fonts.css',
  '/css/theme.css',
  '/css/login.css',
];

var APP_PAGES = [
  '/home.html',
  '/profile.html',
  '/init.html',
  '/catchup.html',
  '/log.html',
  '/coach.html',
  '/customize.html',
  '/info.html',
  '/learn.html',
  '/timeline.html',
  '/leaderboard.html',
  '/verify-email.html',
];

var LANDING_PATHS = {
  '/': 1,
  '/index.html': 1,
  '/about.html': 1,
  '/download.html': 1,
  '/legal.html': 1,
  '/blog.html': 1,
  '/post.html': 1,
  '/leaderboards.html': 1,
  '/surveys.html': 1,
  '/survey.html': 1,
  '/versions.html': 1,
  '/version.html': 1,
  '/explore.html': 1,
  '/404.html': 1,
};

function isLandingPath(pathname) {
  if (LANDING_PATHS[pathname]) return true;
  if (/^\/blog\//.test(pathname)) return true;
  if (/^\/survey\//.test(pathname)) return true;
  if (/^\/versions\//.test(pathname)) return true;
  return false;
}

function isAppDocument(pathname) {
  if (isLandingPath(pathname)) return false;
  if (pathname === '/login.html' || pathname === '/login' || pathname === '/signup') return true;
  var i;
  for (i = 0; i < APP_PAGES.length; i++) {
    if (pathname === APP_PAGES[i]) return true;
    if (pathname === APP_PAGES[i].replace('.html', '')) return true;
  }
  return false;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_SHELL.concat(APP_PAGES)).catch(function () {
        return cache.addAll(APP_SHELL);
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key.indexOf('strongman-app-shell-') === 0 && key !== CACHE_VERSION;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf('/api/') === 0) return;

  if (isLandingPath(url.pathname)) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    if (!isAppDocument(url.pathname)) return;
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_VERSION).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            if (cached) return cached;
            return caches.match('/login.html');
          });
        })
    );
    return;
  }

  if (
    url.pathname.indexOf('/shared/') === 0 ||
    url.pathname.indexOf('/css/') === 0 ||
    url.pathname.indexOf('/js/') === 0 ||
    url.pathname.indexOf('/assets/') === 0
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var networkFetch = fetch(req)
          .then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(CACHE_VERSION).then(function (cache) {
                cache.put(req, copy);
              });
            }
            return res;
          })
          .catch(function () {
            return cached;
          });
        return cached || networkFetch;
      })
    );
  }
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
