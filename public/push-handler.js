/* AlphaClone push notification handlers.
 * Imported into the generated service worker (/sw.js) via next-pwa `importScripts`.
 * Displays notifications when a web-push arrives even if the app/tab is closed,
 * and focuses/opens the right page when the notification is clicked.
 */
self.addEventListener('push', function (event) {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'AlphaClone', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'AlphaClone';
    const options = {
        body: data.body || '',
        icon: data.icon || '/favicon-192x192.png',
        badge: data.badge || '/favicon-96x96.png',
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        data: { url: data.url || '/dashboard' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const urlToOpen = (event.notification.data && event.notification.data.url) || '/dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) {
                    client.navigate && client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
