import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import FaqManager from './FaqManager';
import BotConfig from './BotConfig';
import { LogOut, BookOpen, Bot, MessageSquare, Menu, X, Send } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'faqs' | 'bot' | 'test-chat'>('faqs');
  const [usuario, setUsuario] = useState<{ nombre: string; email: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Estados para el Simulador de Chat en el Dashboard
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const [chatMensajes, setChatMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    cargarUsuario();
  }, []);

  const cargarUsuario = async () => {
    try {
      const data = await api.getMe();
      setUsuario(data);
    } catch (err) {
      // Si falla, probablemente token expirado
      api.logout();
      onLogout();
    }
  };

  const handleLogout = () => {
    api.logout();
    onLogout();
  };

  // Inicializar Chat de Prueba en Dashboard
  const iniciarChatPrueba = async () => {
    try {
      setChatLoading(true);
      const data = await api.startChat();
      setChatConvId(data.conversacion_id);
      setChatMensajes([
        { id: 0, remitente: 'assistant', contenido: data.mensaje_bienvenida }
      ]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'test-chat' && !chatConvId) {
      iniciarChatPrueba();
    }
  }, [activeTab]);

  const enviarMensajePrueba = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !chatConvId || chatLoading) return;

    const msgUsuario = nuevoMensaje;
    setNuevoMensaje('');
    setChatMensajes(prev => [...prev, { id: Date.now(), remitente: 'user', contenido: msgUsuario }]);
    setChatLoading(true);

    try {
      const res = await api.sendChatMessage(chatConvId, msgUsuario);
      setChatMensajes(prev => [...prev, res]);
    } catch (err: any) {
      setChatMensajes(prev => [...prev, { id: Date.now() + 1, remitente: 'assistant', contenido: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const reiniciarChat = () => {
    setChatConvId(null);
    setChatMensajes([]);
    iniciarChatPrueba();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-20">
        <h1 className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
          GPAQ Admin
        </h1>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay on mobile */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800/80 p-6 flex flex-col z-40 transform transition-transform duration-300 md:relative md:transform-none md:z-10
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="mb-10 hidden md:block">
          <h1 className="font-black text-xl tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Gestión FAQ IA
          </h1>
          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mt-1 block">
            Panel de Control
          </span>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => { setActiveTab('faqs'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
              activeTab === 'faqs' 
                ? 'bg-indigo-650 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Base de FAQs</span>
          </button>

          <button
            onClick={() => { setActiveTab('bot'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
              activeTab === 'bot' 
                ? 'bg-indigo-650 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40'
            }`}
          >
            <Bot className="w-5 h-5" />
            <span>Configuración IA</span>
          </button>

          <button
            onClick={() => { setActiveTab('test-chat'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
              activeTab === 'test-chat' 
                ? 'bg-indigo-650 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Simulador de Chat</span>
          </button>
        </nav>

        {/* User Info & Logout */}
        <div className="pt-6 border-t border-zinc-800/60 space-y-4">
          {usuario && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-850 border border-zinc-800 flex items-center justify-center text-zinc-300 font-semibold uppercase">
                {usuario.nombre.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-zinc-200 truncate">{usuario.nombre}</p>
                <p className="text-[11px] text-zinc-500 truncate">{usuario.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-3 border border-zinc-800 hover:bg-red-950/25 hover:border-red-900/30 text-zinc-400 hover:text-red-400 rounded-xl text-sm font-semibold cursor-pointer transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        {activeTab === 'faqs' && <FaqManager />}
        
        {activeTab === 'bot' && <BotConfig />}

        {activeTab === 'test-chat' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-400" />
                Simulador de Chat
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Realiza pruebas de diálogo en tiempo real con el asistente virtual para verificar su comportamiento.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl flex flex-col h-[520px] overflow-hidden backdrop-blur-md">
              {/* Header chat panel */}
              <div className="bg-zinc-900/80 border-b border-zinc-800/60 px-5 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-zinc-200">GPAQ Bot (Prueba Activa)</span>
                </div>
                <button
                  onClick={reiniciarChat}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-all"
                >
                  Reiniciar Conversación
                </button>
              </div>

              {/* Contenedor Mensajes */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chatMensajes.map((msg, index) => (
                  <div 
                    key={msg.id || index} 
                    className={`flex ${msg.remitente === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`
                      max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                      ${msg.remitente === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-zinc-800/70 border border-zinc-800 text-zinc-100 rounded-tl-none'}
                    `}>
                      {msg.contenido}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800/40 border border-zinc-800/40 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                      <span className="text-xs text-zinc-500 font-medium">El bot está pensando...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input de Envío */}
              <form onSubmit={enviarMensajePrueba} className="p-4 border-t border-zinc-800/60 bg-zinc-950/40 flex gap-2">
                <input
                  type="text"
                  required
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  placeholder="Escribe tu mensaje y prueba la inyección de FAQs..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-650 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!nuevoMensaje.trim() || chatLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-500/15 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
