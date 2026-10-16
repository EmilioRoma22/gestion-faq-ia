import { useState } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ChatWidget from './components/ChatWidget';
import PwaPrompt from './components/PwaPrompt';
import { api } from './utils/api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(api.isLoggedIn());

  return (
    <div className="relative font-sans antialiased bg-zinc-950 text-zinc-150 min-h-screen">
      {isLoggedIn ? (
        <AdminDashboard onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <Login onLoginSuccess={() => setIsLoggedIn(true)} />
      )}
      
      {/* Widget de chat flotante disponible globalmente */}
      <ChatWidget />

      {/* Control y notificaciones de PWA y Service Worker */}
      <PwaPrompt />
    </div>
  );
}
