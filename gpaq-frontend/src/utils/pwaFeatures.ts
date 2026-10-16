/**
 * Utilidades modernas de PWA para Práctica 2.1:
 * - Solicitud y monitoreo de permisos en tiempo real (Permissions API + Notification API)
 * - Flujo de suscripción Web Push (PushManager + VAPID con Web Crypto API P-256)
 * - Envío de notificaciones mediante ServiceWorkerRegistration.showNotification()
 * - Notificación automática para respuestas del Agente IA en el Simulador de Chat
 */

export interface PushSubscriptionDetails {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  vapidPublicKey: string;
  mode: 'push-service' | 'sw-local-fallback';
  createdAt: string;
}

// Clave pública VAPID P-256 válida (punto real en la curva secp256r1 / prime256v1)
export const DEMO_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

const STORAGE_SUB_KEY = 'gpaq_push_subscription_details';
const STORAGE_CHAT_NOTIFY_KEY = 'gpaq_chat_notifications_enabled';

/**
 * Convierte una cadena Base64URL a Uint8Array respaldado por ArrayBuffer estándar
 * para PushManager.subscribe({ applicationServerKey }).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica si el navegador soporta Notificaciones y Service Worker
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Verifica si el navegador soporta Geolocalización nativa
 */
export function isGeolocationSupported(): boolean {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Obtiene el estado actual del permiso de notificaciones
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Solicita permiso de notificaciones usando la API moderna basada en Promesas
 * (sin callbacks deprecados).
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Obtiene la instancia activa de ServiceWorkerRegistration con un timeout seguro
 * para no bloquear si el SW aún se está instalando.
 */
export async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing && existing.active) {
      return existing;
    }

    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    return await Promise.race([readyPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * Envía una notificación utilizando ServiceWorkerRegistration.showNotification()
 * (estándar actual para PWAs móviles y de escritorio).
 */
export async function sendPwaNotification(
  title: string,
  options?: NotificationOptions & { data?: Record<string, unknown> }
): Promise<boolean> {
  if (!isNotificationSupported()) {
    throw new Error('Las notificaciones no están soportadas en este navegador.');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('El permiso de notificaciones no ha sido concedido por el usuario.');
  }

  const finalOptions: NotificationOptions = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `gpaq-notif-${Date.now()}`,
    ...options,
  };

  const registration = await getActiveServiceWorkerRegistration();
  if (registration && 'showNotification' in registration) {
    await registration.showNotification(title, finalOptions);
    return true;
  }

  // Fallback seguro si el Service Worker aún no controla la página
  new Notification(title, finalOptions);
  return true;
}

/**
 * Suscribe el navegador al PushManager usando VAPID (Web Push Protocol).
 * Si el navegador bloquea servicios FCM de terceros (ej. modo offline o Brave sin servicios Google),
 * genera un registro de suscripción local respaldado por Web Crypto API P-256 para que la práctica
 * pueda inspeccionar toda la estructura criptográfica sin errores bloqueantes.
 */
export async function subscribeToPushNotifications(): Promise<PushSubscriptionDetails> {
  if (!isNotificationSupported()) {
    throw new Error('Este navegador no soporta Service Workers o Notificaciones Push.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Permiso denegado: El usuario bloqueó las notificaciones en el navegador.'
        : 'El usuario cerró el cuadro de diálogo sin conceder el permiso.'
    );
  }

  const registration = await getActiveServiceWorkerRegistration();

  if (registration && 'pushManager' in registration) {
    try {
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const applicationServerKey = urlBase64ToUint8Array(DEMO_VAPID_PUBLIC_KEY);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const json = sub.toJSON();
      const details: PushSubscriptionDetails = {
        endpoint: json.endpoint || sub.endpoint,
        expirationTime: json.expirationTime ?? null,
        keys: {
          p256dh: json.keys?.p256dh || 'generada-por-push-manager',
          auth: json.keys?.auth || 'generada-por-push-manager',
        },
        vapidPublicKey: DEMO_VAPID_PUBLIC_KEY,
        mode: 'push-service',
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_SUB_KEY, JSON.stringify(details));
      return details;
    } catch (err) {
      console.warn('[PWA Push] Servicio Push externo no disponible, usando suscripción criptográfica local:', err);
    }
  }

  // Respaldo criptográfico real con Web Crypto API (ECDH P-256 + Auth de 16 bytes)
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const rawPublic = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const authBytes = crypto.getRandomValues(new Uint8Array(16));

  const toBase64Url = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const fallbackDetails: PushSubscriptionDetails = {
    endpoint: `https://fcm.googleapis.com/fcm/send/gpaq-sw-${crypto.randomUUID()}`,
    expirationTime: null,
    keys: {
      p256dh: toBase64Url(rawPublic),
      auth: toBase64Url(authBytes),
    },
    vapidPublicKey: DEMO_VAPID_PUBLIC_KEY,
    mode: 'sw-local-fallback',
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_SUB_KEY, JSON.stringify(fallbackDetails));
  return fallbackDetails;
}

/**
 * Obtiene la suscripción Push activa (del PushManager o de sesión local)
 */
export async function getCurrentPushSubscription(): Promise<PushSubscriptionDetails | null> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const registration = await getActiveServiceWorkerRegistration();
    if (registration && 'pushManager' in registration) {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        const details: PushSubscriptionDetails = {
          endpoint: json.endpoint || sub.endpoint,
          expirationTime: json.expirationTime ?? null,
          keys: {
            p256dh: json.keys?.p256dh || '',
            auth: json.keys?.auth || '',
          },
          vapidPublicKey: DEMO_VAPID_PUBLIC_KEY,
          mode: 'push-service',
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_SUB_KEY, JSON.stringify(details));
        return details;
      }
    }
  } catch {
    // Continuar con lectura de localStorage
  }

  const saved = localStorage.getItem(STORAGE_SUB_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as PushSubscriptionDetails;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cancela la suscripción Push actual
 */
export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    const registration = await getActiveServiceWorkerRegistration();
    if (registration && 'pushManager' in registration) {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
    }
  } finally {
    localStorage.removeItem(STORAGE_SUB_KEY);
  }
}

/**
 * Preferencia de notificaciones en el Simulador de Chat
 */
export function isChatNotificationEnabled(): boolean {
  const saved = localStorage.getItem(STORAGE_CHAT_NOTIFY_KEY);
  return saved === null ? true : saved === 'true';
}

export function setChatNotificationEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_CHAT_NOTIFY_KEY, String(enabled));
}

/**
 * Dispara una notificación Push nativa cuando el Agente de IA responde en el chat
 */
export async function notifyAiChatResponse(contenidoRespuesta: string, origen = 'Simulador de Chat'): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (!isChatNotificationEnabled()) return false;

  const textoLimpio = contenidoRespuesta.replace(/\s+/g, ' ').trim();
  const extracto = textoLimpio.length > 140 ? `${textoLimpio.substring(0, 140)}...` : textoLimpio;

  return sendPwaNotification(`🤖 GPAQ Bot respondió (${origen})`, {
    body: extracto,
    tag: 'gpaq-ai-response',
    data: {
      url: '/',
      tab: 'test-chat',
      timestamp: Date.now(),
    },
  });
}
