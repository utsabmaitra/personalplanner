const cacheName = 'hsc26-v1';
const assets = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap'
];

// ইনস্টল এবং ক্যাশ সেভ করা
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assets))
  );
});

// অফলাইনে ফাইল ডেলিভারি করা
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});