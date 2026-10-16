import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  MapPin,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Send,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Clock,
  Activity,
  Trash2,
  Sparkles,
  Radio,
  Info,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendPwaNotification,
  subscribeToPushNotifications,
  getCurrentPushSubscription,
  unsubscribeFromPushNotifications,
  isChatNotificationEnabled,
  setChatNotificationEnabled,
  isGeolocationSupported,
  type PushSubscriptionDetails,
} from '../utils/pwaFeatures';

interface GeoData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface EventLogItem {
  id: string;
  time: string;
  category: 'Permisos' | 'Push SW' | 'Geolocalización';
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

interface DeviceFeaturesProps {
  onNavigateToChat?: () => void;
}

export default function DeviceFeatures({ onNavigateToChat }: DeviceFeaturesProps) {
  // Estados de Permisos
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );
  const [geoPermission, setGeoPermission] = useState<PermissionState | 'unsupported'>(
    isGeolocationSupported() ? 'prompt' : 'unsupported'
  );

  // Estados de Suscripción y Notificaciones Push
  const [subscription, setSubscription] = useState<PushSubscriptionDetails | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [chatNotifyActive, setChatNotifyActive] = useState<boolean>(isChatNotificationEnabled());
  const [testTitle, setTestTitle] = useState('🤖 GPAQ - Notificación Push de Prueba');
  const [testBody, setTestBody] = useState(
    '¡Hola! El Service Worker de la PWA está procesando notificaciones correctamente.'
  );
  const [delayedCountdown, setDelayedCountdown] = useState<number | null>(null);
  const [copiedSub, setCopiedSub] = useState(false);

  // Estados de Geolocalización Nativa
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<{ code: number; message: string } | null>(null);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [isWatching, setIsWatching] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Bitácora de eventos para evidencia de la Práctica 2.1
  const [logs, setLogs] = useState<EventLogItem[]>([]);

  const addLog = (
    category: EventLogItem['category'],
    status: EventLogItem['status'],
    message: string
  ) => {
    const now = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time: now,
        category,
        status,
        message,
      },
      ...prev.slice(0, 29),
    ]);
  };

  // Monitoreo reactivo de permisos mediante W3C Permissions API (navigator.permissions.query)
  useEffect(() => {
    let notifStatusObj: PermissionStatus | null = null;
    let geoStatusObj: PermissionStatus | null = null;

    const initPermissions = async () => {
      const currentNotif = getNotificationPermission();
      setNotifPermission(currentNotif);
      addLog(
        'Permisos',
        currentNotif === 'granted' ? 'success' : currentNotif === 'denied' ? 'error' : 'info',
        `Estado inicial de permiso de Notificaciones: "${currentNotif}"`
      );

      // Cargar suscripción Push si existe
      const existingSub = await getCurrentPushSubscription();
      if (existingSub) {
        setSubscription(existingSub);
      }

      if ('permissions' in navigator) {
        try {
          notifStatusObj = await navigator.permissions.query({ name: 'notifications' });
          notifStatusObj.onchange = () => {
            const updated = getNotificationPermission();
            setNotifPermission(updated);
            addLog(
              'Permisos',
              updated === 'granted' ? 'success' : updated === 'denied' ? 'error' : 'warning',
              `Cambio detectado en permiso de Notificaciones -> "${updated}"`
            );
          };
        } catch {
          // Algunos navegadores manejan notifications únicamente vía Notification.permission
        }

        try {
          geoStatusObj = await navigator.permissions.query({ name: 'geolocation' });
          setGeoPermission(geoStatusObj.state);
          addLog(
            'Permisos',
            geoStatusObj.state === 'granted'
              ? 'success'
              : geoStatusObj.state === 'denied'
                ? 'error'
                : 'info',
            `Estado inicial de permiso de Geolocalización: "${geoStatusObj.state}"`
          );

          geoStatusObj.onchange = () => {
            if (!geoStatusObj) return;
            setGeoPermission(geoStatusObj.state);
            if (geoStatusObj.state !== 'denied') {
              setGeoError(null);
            }
            addLog(
              'Permisos',
              geoStatusObj.state === 'granted'
                ? 'success'
                : geoStatusObj.state === 'denied'
                  ? 'error'
                  : 'warning',
              `Cambio detectado en permiso de Geolocalización -> "${geoStatusObj.state}"`
            );
          };
        } catch {
          // Si no soporta query de geolocation, se actualiza al invocar getCurrentPosition
        }
      }
    };

    initPermissions();

    return () => {
      if (notifStatusObj) notifStatusObj.onchange = null;
      if (geoStatusObj) geoStatusObj.onchange = null;
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 1. Solicitar permiso de notificaciones
  const handleRequestNotifPermission = async () => {
    try {
      addLog('Permisos', 'info', 'Solicitando permiso de notificaciones al usuario...');
      const result = await requestNotificationPermission();
      setNotifPermission(result);

      if (result === 'granted') {
        addLog('Permisos', 'success', 'Permiso de notificaciones CONCEDIDO (granted).');
        const sub = await subscribeToPushNotifications();
        setSubscription(sub);
        addLog('Push SW', 'success', 'Suscripción Push VAPID generada automáticamente.');
      } else if (result === 'denied') {
        addLog(
          'Permisos',
          'error',
          'Permiso de notificaciones DENEGADO (denied). El navegador bloqueó el envío.'
        );
      } else {
        addLog('Permisos', 'warning', 'El usuario cerró el diálogo sin decidir (default).');
      }
    } catch (err: any) {
      addLog('Permisos', 'error', err.message || 'Error al solicitar permiso.');
    }
  };

  // 2. Suscribir o cancelar suscripción PushManager VAPID
  const handleSubscribePush = async () => {
    try {
      setSubLoading(true);
      addLog('Push SW', 'info', 'Iniciando flujo de suscripción en PushManager con clave VAPID...');
      const details = await subscribeToPushNotifications();
      setNotifPermission(getNotificationPermission());
      setSubscription(details);
      addLog(
        'Push SW',
        'success',
        `Suscripción activa creada (${details.mode === 'push-service' ? 'Servidor Push FCM/WebPush' : 'Criptografía P-256 Local'}).`
      );
    } catch (err: any) {
      setNotifPermission(getNotificationPermission());
      addLog('Push SW', 'error', err.message || 'No fue posible completar la suscripción Push.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleUnsubscribePush = async () => {
    try {
      setSubLoading(true);
      await unsubscribeFromPushNotifications();
      setSubscription(null);
      addLog('Push SW', 'warning', 'Suscripción Push cancelada y eliminada del navegador.');
    } catch (err: any) {
      addLog('Push SW', 'error', err.message || 'Error al cancelar suscripción.');
    } finally {
      setSubLoading(false);
    }
  };

  // 3. Enviar notificación Push de prueba (inmediata o con retraso de 3s)
  const handleSendTestPush = async (delaySeconds = 0) => {
    if (notifPermission !== 'granted') {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted);
      if (granted !== 'granted') {
        addLog(
          'Push SW',
          'error',
          'No se puede enviar la notificación: el permiso no ha sido concedido.'
        );
        return;
      }
    }

    if (delaySeconds > 0) {
      setDelayedCountdown(delaySeconds);
      addLog(
        'Push SW',
        'info',
        `Notificación programada en ${delaySeconds}s. Puedes minimizar la app para verificarla en segundo plano.`
      );

      let remaining = delaySeconds;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setDelayedCountdown(remaining);
        } else {
          clearInterval(interval);
          setDelayedCountdown(null);
        }
      }, 1000);

      setTimeout(async () => {
        try {
          await sendPwaNotification(testTitle, {
            body: testBody,
            tag: 'gpaq-test-delayed',
            data: { url: '/', tab: 'device-pwa', timestamp: Date.now() },
          });
          addLog('Push SW', 'success', `Notificación diferida entregada: "${testTitle}"`);
        } catch (err: any) {
          addLog('Push SW', 'error', err.message || 'Error al enviar notificación diferida.');
        }
      }, delaySeconds * 1000);
      return;
    }

    try {
      await sendPwaNotification(testTitle, {
        body: testBody,
        tag: 'gpaq-test-instant',
        data: { url: '/', tab: 'device-pwa', timestamp: Date.now() },
      });
      addLog('Push SW', 'success', `Notificación Push enviada vía Service Worker: "${testTitle}"`);
    } catch (err: any) {
      addLog('Push SW', 'error', err.message || 'Error al mostrar la notificación.');
    }
  };

  const handleToggleChatNotify = () => {
    const next = !chatNotifyActive;
    setChatNotifyActive(next);
    setChatNotificationEnabled(next);
    addLog(
      'Push SW',
      next ? 'success' : 'warning',
      next
        ? 'Notificaciones automáticas en el Simulador de Chat ACTIVADAS.'
        : 'Notificaciones automáticas en el Simulador de Chat DESACTIVADAS.'
    );
  };

  // 4. Acceso a característica nativa: Geolocalización (getCurrentPosition y watchPosition)
  const formatGeoError = (error: GeolocationPositionError): { code: number; message: string } => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        setGeoPermission('denied');
        return {
          code: 1,
          message:
            'Permiso denegado por el usuario (PERMISSION_DENIED). La PWA respeta la privacidad y ha bloqueado la lectura del GPS.',
        };
      case error.POSITION_UNAVAILABLE:
        return {
          code: 2,
          message:
            'Ubicación no disponible (POSITION_UNAVAILABLE). El hardware o red no pudo triangular la posición.',
        };
      case error.TIMEOUT:
        return {
          code: 3,
          message:
            'Tiempo de espera agotado (TIMEOUT) al intentar obtener las coordenadas del dispositivo.',
        };
      default:
        return {
          code: 0,
          message: error.message || 'Error desconocido al consultar geolocalización.',
        };
    }
  };

  const handleGetLocation = () => {
    if (!isGeolocationSupported()) {
      setGeoError({ code: -1, message: 'Este dispositivo o navegador no soporta Geolocalización.' });
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    addLog(
      'Geolocalización',
      'info',
      `Consultando navigator.geolocation.getCurrentPosition (Alta precisión: ${highAccuracy ? 'Sí' : 'No'})...`
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        setGeoPermission('granted');
        const coords: GeoData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        };
        setGeoData(coords);
        addLog(
          'Geolocalización',
          'success',
          `Coordenadas obtenidas: Lat ${coords.latitude.toFixed(5)}, Lng ${coords.longitude.toFixed(5)} (±${Math.round(coords.accuracy)}m)`
        );
      },
      (error) => {
        setGeoLoading(false);
        const formatted = formatGeoError(error);
        setGeoError(formatted);
        addLog('Geolocalización', 'error', formatted.message);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleToggleWatchPosition = () => {
    if (!isGeolocationSupported()) return;

    if (isWatching && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsWatching(false);
      addLog('Geolocalización', 'warning', 'Seguimiento en tiempo real (watchPosition) detenido.');
      return;
    }

    setGeoError(null);
    setIsWatching(true);
    addLog('Geolocalización', 'info', 'Iniciando monitoreo continuo con watchPosition()...');

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setGeoPermission('granted');
        const coords: GeoData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        };
        setGeoData(coords);
        addLog(
          'Geolocalización',
          'success',
          `[En vivo] Lat ${coords.latitude.toFixed(5)}, Lng ${coords.longitude.toFixed(5)} (±${Math.round(coords.accuracy)}m)`
        );
      },
      (error) => {
        const formatted = formatGeoError(error);
        setGeoError(formatted);
        setIsWatching(false);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        addLog('Geolocalización', 'error', formatted.message);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = id;
  };

  const handleNotifyLocation = async () => {
    if (!geoData) return;
    try {
      await sendPwaNotification('📍 Ubicación del Dispositivo Verificada', {
        body: `Lat: ${geoData.latitude.toFixed(5)}, Lng: ${geoData.longitude.toFixed(5)} (Precisión: ±${Math.round(geoData.accuracy)}m)`,
        tag: 'gpaq-geo-notification',
        data: { url: '/', tab: 'device-pwa' },
      });
      addLog(
        'Push SW',
        'success',
        'Se envió una notificación Push con las coordenadas actuales del dispositivo.'
      );
    } catch (err: any) {
      addLog('Push SW', 'error', err.message || 'Activa primero el permiso de notificaciones.');
    }
  };

  const copySubscriptionJson = () => {
    if (!subscription) return;
    navigator.clipboard.writeText(JSON.stringify(subscription, null, 2));
    setCopiedSub(true);
    setTimeout(() => setCopiedSub(false), 2000);
  };

  const copyCoordinates = () => {
    if (!geoData) return;
    navigator.clipboard.writeText(`${geoData.latitude}, ${geoData.longitude}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Helpers visuales para estados de permisos
  const renderPermissionBadge = (state: string) => {
    if (state === 'granted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          Concedido (granted)
        </span>
      );
    }
    if (state === 'denied') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
          <ShieldAlert className="w-3.5 h-3.5" />
          Denegado (denied)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <ShieldQuestion className="w-3.5 h-3.5" />
        Sin decidir ({state})
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Práctica 2.1 — PWA & Web APIs Modernas
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <BellRing className="w-6 h-6 text-indigo-400" />
            Notificaciones Push y Acceso a Dispositivo
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Gestión de suscripción Web Push (VAPID), alertas del Agente IA y acceso nativo a Geolocalización con verificación de permisos en tiempo real.
          </p>
        </div>

        {onNavigateToChat && (
          <button
            onClick={onNavigateToChat}
            className="self-start md:self-auto px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
          >
            <Bell className="w-4 h-4" />
            <span>Probar en Simulador de Chat IA</span>
          </button>
        )}
      </div>

      {/* SECCIÓN 1: Verificación de Permisos en Tiempo Real (Paso 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tarjeta Permiso Notificaciones */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Permiso de Notificaciones Push</h3>
                <p className="text-xs text-zinc-400">API: Notification & ServiceWorkerRegistration</p>
              </div>
            </div>
            {renderPermissionBadge(notifPermission)}
          </div>

          <div className="text-xs text-zinc-300 bg-zinc-950/70 border border-zinc-800/70 rounded-xl p-3.5 leading-relaxed">
            {notifPermission === 'granted' && (
              <p className="text-emerald-300">
                ✅ <strong>Permiso concedido:</strong> La PWA puede mostrar notificaciones nativas del sistema operativo tanto en pruebas manuales como cuando el <strong>Agente de IA responde en el Simulador de Chat</strong>.
              </p>
            )}
            {notifPermission === 'denied' && (
              <p className="text-red-300">
                🚫 <strong>Permiso denegado:</strong> El usuario bloqueó las notificaciones. La aplicación desactiva el envío sin fallar. Para reactivarlo, haz clic en el icono de ajustes/candado junto a la URL del navegador y cambia Notificaciones a <em>Permitir</em>.
              </p>
            )}
            {(notifPermission === 'default' || notifPermission === 'unsupported') && (
              <p className="text-amber-200/90">
                ⚡ <strong>Pendiente de autorización:</strong> Haz clic en <em>Solicitar Permiso</em> abajo o abre el Simulador de Chat para desplegar el diálogo nativo del navegador.
              </p>
            )}
          </div>
        </div>

        {/* Tarjeta Permiso Geolocalización */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Permiso de Geolocalización Nativa</h3>
                <p className="text-xs text-zinc-400">API: navigator.geolocation & Permissions API</p>
              </div>
            </div>
            {renderPermissionBadge(geoPermission)}
          </div>

          <div className="text-xs text-zinc-300 bg-zinc-950/70 border border-zinc-800/70 rounded-xl p-3.5 leading-relaxed">
            {geoPermission === 'granted' && (
              <p className="text-emerald-300">
                ✅ <strong>Permiso concedido:</strong> Acceso autorizado al sensor GPS / triangulación de red para obtener coordenadas de latitud, longitud y precisión en metros.
              </p>
            )}
            {geoPermission === 'denied' && (
              <p className="text-red-300">
                🚫 <strong>Permiso denegado:</strong> El navegador impidió el acceso a la ubicación física (código <code>PERMISSION_DENIED = 1</code>). Puedes restablecer el permiso desde el icono de la barra de direcciones.
              </p>
            )}
            {(geoPermission === 'prompt' || geoPermission === 'unsupported') && (
              <p className="text-amber-200/90">
                ⚡ <strong>Sin solicitar aún:</strong> Al presionar <em>Obtener Ubicación Actual</em>, el navegador solicitará confirmación expresa al usuario antes de leer el sensor.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: Notificaciones Push y Suscripción + Geolocalización */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMNA IZQUIERDA: Notificaciones Push y Suscripción VAPID */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-indigo-400" />
              1. Notificaciones Push y Flujo de Suscripción
            </h3>
          </div>

          {/* Botones de Permiso y Suscripción PushManager */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleRequestNotifPermission}
              disabled={notifPermission === 'granted'}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-600/15"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {notifPermission === 'granted'
                  ? 'Permiso de Notificaciones Activo'
                  : 'Solicitar Permiso de Notificaciones'}
              </span>
            </button>

            {!subscription ? (
              <button
                onClick={handleSubscribePush}
                disabled={subLoading || notifPermission === 'denied'}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                <KeyRound className="w-4 h-4" />
                <span>{subLoading ? 'Suscribiendo...' : 'Generar Suscripción Push (VAPID)'}</span>
              </button>
            ) : (
              <button
                onClick={handleUnsubscribePush}
                disabled={subLoading}
                className="px-3.5 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
              >
                <BellOff className="w-4 h-4" />
                <span>Cancelar Suscripción</span>
              </button>
            )}
          </div>

          {/* Detalles de la Suscripción Activa (Endpoint + Keys) */}
          {subscription && (
            <div className="bg-zinc-950/90 border border-indigo-500/30 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Objeto PushSubscription (VAPID P-256)
                </span>
                <button
                  onClick={copySubscriptionJson}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800"
                >
                  {copiedSub ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSub ? 'Copiado' : 'Copiar JSON'}</span>
                </button>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 space-y-1 break-all bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                <div>
                  <span className="text-zinc-500">endpoint:</span>{' '}
                  <span className="text-emerald-400">{subscription.endpoint.substring(0, 68)}...</span>
                </div>
                <div>
                  <span className="text-zinc-500">keys.p256dh:</span>{' '}
                  <span className="text-indigo-300">{subscription.keys.p256dh.substring(0, 44)}...</span>
                </div>
                <div>
                  <span className="text-zinc-500">keys.auth:</span>{' '}
                  <span className="text-purple-300">{subscription.keys.auth}</span>
                </div>
              </div>
            </div>
          )}

          {/* Switch para Notificar en el Simulador de Chat IA */}
          <div className="bg-indigo-950/20 border border-indigo-500/25 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-indigo-200">
                Notificar cuando el Agente IA responda en el Simulador
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Envía automáticamente una notificación Push con la respuesta de GPAQ Bot en el Simulador de Chat.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleChatNotify}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${chatNotifyActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
            >
              {chatNotifyActive ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          {/* Formulario de Prueba de Notificación Push */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Enviar Notificación Push de Prueba
            </h4>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Título de la notificación
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Mensaje (Body)
                </label>
                <textarea
                  rows={2}
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={() => handleSendTestPush(0)}
                disabled={notifPermission === 'denied'}
                className="flex-1 min-w-45 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/15"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Push de Prueba Ahora</span>
              </button>

              <button
                onClick={() => handleSendTestPush(3)}
                disabled={notifPermission === 'denied' || delayedCountdown !== null}
                className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 disabled:opacity-40 text-zinc-200 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>
                  {delayedCountdown !== null
                    ? `Enviando en ${delayedCountdown}s...`
                    : 'Enviar en 3s (Probar 2do Plano)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Característica Nativa - Geolocalización */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-purple-400" />
              2. Característica Nativa: Geolocalización GPS
            </h3>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={highAccuracy}
                onChange={(e) => setHighAccuracy(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
              <span>Alta precisión GPS</span>
            </label>
          </div>

          {/* Botones de Acción de Geolocalización */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleGetLocation}
              disabled={geoLoading}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-purple-600/15"
            >
              <RefreshCw className={`w-4 h-4 ${geoLoading ? 'animate-spin' : ''}`} />
              <span>{geoLoading ? 'Obteniendo coordenadas...' : 'Obtener Ubicación Actual'}</span>
            </button>

            <button
              onClick={handleToggleWatchPosition}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all border ${isWatching
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                }`}
            >
              <Radio className={`w-4 h-4 ${isWatching ? 'animate-pulse text-emerald-400' : 'text-zinc-400'}`} />
              <span>{isWatching ? 'Detener Rastreo en Vivo' : 'Monitoreo en Tiempo Real (Watch)'}</span>
            </button>
          </div>

          {/* Alerta en caso de Permiso Denegado o Error de Hardware */}
          {geoError && (
            <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Error de Geolocalización (Código {geoError.code})</span>
              </div>
              <p className="text-xs text-red-200/90 leading-relaxed">{geoError.message}</p>
            </div>
          )}

          {/* Panel de Datos de Coordenadas */}
          {geoData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                    Latitud
                  </span>
                  <span className="text-sm font-mono font-bold text-zinc-100 mt-0.5 block">
                    {geoData.latitude.toFixed(6)}°
                  </span>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                    Longitud
                  </span>
                  <span className="text-sm font-mono font-bold text-zinc-100 mt-0.5 block">
                    {geoData.longitude.toFixed(6)}°
                  </span>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                    Precisión
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                    ±{Math.round(geoData.accuracy)} metros
                  </span>
                </div>
              </div>

              {/* Acciones con las coordenadas */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={copyCoordinates}
                  className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCoords ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedCoords ? 'Coordenadas copiadas' : 'Copiar coordenadas'}</span>
                </button>

                <button
                  onClick={handleNotifyLocation}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Notificar mi ubicación vía Push</span>
                </button>

                <a
                  href={`https://www.google.com/maps?q=${geoData.latitude},${geoData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 flex items-center gap-1.5 ml-auto"
                >
                  <span>Abrir en Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Mapa embebido de OpenStreetMap */}
              <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 h-48 relative">
                <iframe
                  title="Mapa de Ubicación del Dispositivo"
                  width="100%"
                  height="100%"
                  className="border-0 opacity-90 contrast-125"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoData.longitude - 0.008
                    }%2C${geoData.latitude - 0.008}%2C${geoData.longitude + 0.008}%2C${geoData.latitude + 0.008
                    }&layer=mapnik&marker=${geoData.latitude}%2C${geoData.longitude}`}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
              <MapPin className="w-10 h-10 text-zinc-600 mb-2" />
              <p className="text-xs font-semibold text-zinc-300">
                Aún no se han leído coordenadas del dispositivo
              </p>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-1">
                Haz clic en &ldquo;Obtener Ubicación Actual&rdquo; para probar la solicitud de permisos y visualizar tu posición en el mapa.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN 3: Explicación Interactiva del Flujo de Suscripción Push (Paso 1) */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Arquitectura y Flujo de Suscripción de Notificaciones Push en la PWA</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-indigo-400 font-bold block">1. Solicitud de Permiso</span>
            <p className="text-zinc-400 leading-relaxed">
              La PWA invoca <code>Notification.requestPermission()</code>. El usuario decide conceder (<code>granted</code>) o denegar (<code>denied</code>).
            </p>
          </div>
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-purple-400 font-bold block">2. Suscripción VAPID</span>
            <p className="text-zinc-400 leading-relaxed">
              El <code>ServiceWorkerRegistration.pushManager</code> registra el dispositivo con una clave pública VAPID P-256 y devuelve un <code>endpoint</code> único y llaves <code>p256dh/auth</code>.
            </p>
          </div>
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-emerald-400 font-bold block">3. Disparo / Evento Push</span>
            <p className="text-zinc-400 leading-relaxed">
              Cuando el <strong>Agente IA responde en el chat</strong> o llega un mensaje al evento <code>push</code> del Service Worker (<code>sw-push.js</code>), éste se activa incluso en segundo plano.
            </p>
          </div>
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-amber-400 font-bold block">4. Visualización y Clic</span>
            <p className="text-zinc-400 leading-relaxed">
              <code>registration.showNotification()</code> despliega la alerta en el sistema operativo y <code>notificationclick</code> enfoca la conversación del chat.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: Bitácora de Evidencia en Vivo */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-100">
              Bitácora de Eventos y Permisos en Tiempo Real
            </h3>
          </div>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar registro</span>
            </button>
          )}
        </div>

        <div className="bg-zinc-950 border border-zinc-800/90 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1.5">
          {logs.length === 0 ? (
            <p className="text-zinc-600 text-center py-4">
              Interactúa con los permisos, notificaciones o geolocalización para registrar eventos...
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 py-1 border-b border-zinc-900 last:border-0"
              >
                <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${log.category === 'Permisos'
                      ? 'bg-amber-500/15 text-amber-300'
                      : log.category === 'Push SW'
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'bg-purple-500/15 text-purple-300'
                    }`}
                >
                  {log.category}
                </span>
                <span
                  className={
                    log.status === 'success'
                      ? 'text-emerald-400'
                      : log.status === 'error'
                        ? 'text-red-400'
                        : log.status === 'warning'
                          ? 'text-amber-300'
                          : 'text-zinc-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
