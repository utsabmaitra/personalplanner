const CACHE_NAME = 'personal-planner-v28'; // ভার্সন বাড়িয়ে দিন
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './success.mp3',
  './click.mp3',
  './alert.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // অডিও ফাইলের জন্য বিশেষ লজিক
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.match(event.request).then((cacheResponse) => {
        if (cacheResponse) {
          // Range রিকোয়েস্ট থাকলেও ক্যাশ থেকে ফাইলটি যেন ঠিকঠাক পাঠায়
          return cacheResponse;
        }
        return fetch(event.request);
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
  }
});
