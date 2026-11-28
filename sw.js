/* sw.js — 离线缓存（P1）。file:// 下不会注册，HTTP(S) 首次访问后可用。 */
const CACHE = 'cas-v3';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './core.js',
  './manifest.webmanifest', './icon.svg'
];
/* xlsx.b64.js（1.17 MB）不参与预缓存：它按需懒加载，首次用到时由 fetch handler 自动写入缓存，
   这样 Service Worker 安装不会被这个大文件拖慢或拖失败，离线 Excel 在用过一次后依然可用。 */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
