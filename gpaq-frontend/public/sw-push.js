/**
 * Service Worker - Módulo de Notificaciones Push (Práctica 2.1)
 * Maneja eventos 'push', 'notificationclick' y mensajes desde el cliente PWA
 * utilizando estándares modernos de ServiceWorkerRegistration.
 */

// 1. Escuchar eventos Push provenientes de un servidor Web Push (VAPID) o DevTools
self.addEventListener('push', (event) => {
  let payload = {
    title: '🤖 GPAQ - Notificación Push',
    body: 'Tienes una nueva actualización del asistente inteligente.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'gpaq-push-notification',
    data: {
      url: '/',
      tab: 'test-chat',
      timestamp: Date.now(),
    },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: {
          ...payload.data,
          ...(parsed.data || {}),
        },
      };
    } catch {
      // Si el payload es texto plano (ej. prueba desde Chrome DevTools -> Push)
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || 'gpaq-push-notification',
    data: payload.data,
    requireInteraction: Boolean(payload.requireInteraction),
    silent: Boolean(payload.silent),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// 2. Escuchar mensajes directos desde la aplicación React para disparar notificaciones vía SW
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_PUSH_NOTIFICATION') {
    return;
  }

  const { title, options } = event.data.payload || {};
  if (!title) return;

  event.waitUntil(
    self.registration.showNotification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...options,
    })
  );
});

// 3. Manejar el clic del usuario sobre la notificación del sistema operativo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetData = event.notification.data || { url: '/', tab: 'test-chat' };
  const targetUrl = targetData.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya existe una ventana abierta de la PWA, la enfocamos y le notificamos la pestaña
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: targetData,
            });
            return client.focus();
          }
        }
        // Si la PWA estaba cerrada, abrimos una nueva ventana
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
