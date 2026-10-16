import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, WifiOff, CheckCircle2, X, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dismissedOfflineReady, setDismissedOfflineReady] = useState(false);

  // Registro del Service Worker mediante el hook oficial de vite-plugin-pwa
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('✅ [PWA] Service Worker registrado exitosamente:', registration?.scope);
    },
    onRegisterError(error) {
      console.error('❌ [PWA] Error al registrar el Service Worker:', error);
    },
  });

  // Manejo del evento de instalación nativo (PWA Install Prompt)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir el banner por defecto del navegador para mostrar nuestro diseño personalizado
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('🎉 [PWA] Aplicación instalada exitosamente en el sistema');
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Detección de conectividad en tiempo real (Online / Offline)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      console.log('👍 [PWA] El usuario aceptó la instalación');
    } else {
      console.log('👎 [PWA] El usuario canceló la instalación');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const closeOfflineReady = () => {
    setOfflineReady(false);
    setDismissedOfflineReady(true);
  };

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {/* 1. Indicador de Modo Sin Conexión */}
      {!isOnline && (
        <div className="pointer-events-auto bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3 animate-fade-in">
          <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">Modo sin conexión activo</p>
            <p className="text-amber-300/80">Operando gracias al caché del Service Worker</p>
          </div>
        </div>
      )}

      {/* 2. Notificación de Nueva Versión Disponible (Prompt de actualización) */}
      {needRefresh && (
        <div className="pointer-events-auto bg-zinc-900/95 border border-indigo-500/40 text-zinc-100 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-3 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-zinc-100">Nueva versión disponible</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Hay contenido actualizado. Recarga para aplicar los cambios del Service Worker.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setNeedRefresh(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Más tarde
            </button>
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar ahora</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Notificación de App lista para trabajar sin conexión */}
      {offlineReady && !dismissedOfflineReady && (
        <div className="pointer-events-auto bg-zinc-900/95 border border-emerald-500/30 text-zinc-100 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200">App lista para uso offline</p>
              <p className="text-[11px] text-zinc-400">Recursos en caché del Service Worker</p>
            </div>
          </div>
          <button
            onClick={closeOfflineReady}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Botón de Instalación PWA (Aparece cuando el navegador emite beforeinstallprompt) */}
      {isInstallable && (
        <div className="pointer-events-auto bg-linear-to-r from-zinc-900 to-zinc-850 border border-purple-500/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-bounce-short">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-linear-to-tr from-indigo-500 to-purple-600 text-white rounded-xl shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-100">Instalar GPAQ</p>
              <p className="text-[11px] text-zinc-400">Accede como app de escritorio o móvil</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsInstallable(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
