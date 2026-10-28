/*
 * 自毁型 Service Worker
 * ---------------------------------------------------------------
 * 旧版 ST导航 曾用 workbox 把 index.html 预缓存，导致浏览器永远显示旧页面。
 * 线上 sw.js 一度被删除（404），浏览器更新检查失败，旧 SW 就一直存活。
 *
 * 这个文件的作用：被装上后立刻清空所有缓存、注销自己，
 * 并让所有已打开的窗口跳到干净地址，从而彻底终结旧 SW。
 *
 * 注意：不要在这里添加任何 fetch 监听。
 */

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil((async function () {
        // 1) 清空所有 Cache Storage（旧 workbox precache 就存放在这里）
        try {
            var keys = await caches.keys();
            await Promise.all(keys.map(function (k) { return caches.delete(k); }));
        } catch (e) {}

        // 2) 先接管仍被旧 SW 控制的窗口，否则无法让它们跳转
        try { await self.clients.claim(); } catch (e) {}

        var list = [];
        try {
            list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        } catch (e) {}

        // 3) 注销自己，之后的导航请求直接走网络
        try { await self.registration.unregister(); } catch (e) {}

        // 4) 让所有已打开窗口跳到带时间戳的地址，绕过任何 HTTP 缓存
        for (var i = 0; i < list.length; i++) {
            try {
                var u = list[i].url.split('#')[0];
                u += (u.indexOf('?') > -1 ? '&' : '?') + 'sw_clean=' + Date.now();
                await list[i].navigate(u);
            } catch (e) {}
        }
    })());
});
