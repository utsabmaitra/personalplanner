const CACHE_NAME = 'personal-planner-v2'; // ভার্সন পরিবর্তন করা হয়েছে
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

// Install Event - সব ফাইল ক্যাশ করা
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching all assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - পুরনো ক্যাশ ডিলিট করা
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - অফলাইনে ক্যাশ থেকে ফাইল সার্ভ করা
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // যদি রিকোয়েস্টটি অডিও ফাইল (.mp3) হয়
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // ক্যাশে থাকলে সেটিই দাও, না থাকলে নেটওয়ার্ক থেকে আনো
        return response || fetch(event.request);
      })
    );
  } else {
    // অন্যান্য ফাইলের জন্য সাধারণ লজিক
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      }).catch(() => {
        return caches.match('./index.html');
      })
    );
  }
});
