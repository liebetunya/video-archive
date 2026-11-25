/* 예전에 남아 있을 수 있는 서비스워커·캐시를 지우고, 스스로 등록을 해제합니다. */
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.resolve()
      .then(function () {
        return caches.keys();
      })
      .then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      })
      .catch(function () { /* ignore */ })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});
