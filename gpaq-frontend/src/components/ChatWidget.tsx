import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { MessageSquare, X, Send, Bot, Loader } from 'lucide-react';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inicializando, setInicializando] = useState(false);

  const finalMensajesRef = useRef<HTMLDivElement>(null);

  // Cargar sesión previa del chat al montar el widget
  useEffect(() => {
    const sesionId = localStorage.getItem('gpaq_chat_session');
    if (sesionId) {
      setConversacionId(sesionId);
      cargarHistorial(sesionId);
    }
  }, []);

  // Hacer scroll automático al final de la conversación al recibir nuevos mensajes
  useEffect(() => {
    if (isOpen) {
      scrollAlFinal();
    }
  }, [mensajes, isOpen, loading]);

  const scrollAlFinal = () => {
    finalMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cargarHistorial = async (id: string) => {
    try {
      setLoading(true);
      const historial = await api.getChatHistory(id);
      // Para mostrar la bienvenida también, si el historial está vacío o para iniciar la experiencia:
      // Si el historial está vacío, significa que iniciamos sesión pero no chateamos
      const config = await api.startChat(); // Para obtener el saludo por defecto en base de datos
      const bienvenida = { id: 0, remitente: 'assistant', contenido: config.mensaje_bienvenida };
      
      if (historial.length === 0) {
        setMensajes([bienvenida]);
      } else {
        setMensajes([bienvenida, ...historial]);
      }
    } catch (err) {
      // Si el ID de conversación ya no existe en la BD o falló, limpiamos la sesión
      localStorage.removeItem('gpaq_chat_session');
      setConversacionId(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleWidget = async () => {
    const nuevoEstado = !isOpen;
    setIsOpen(nuevoEstado);

    if (nuevoEstado && !conversacionId) {
      await inicializarChat();
    }
  };

  const inicializarChat = async () => {
    try {
      setInicializando(true);
      const data = await api.startChat();
      setConversacionId(data.conversacion_id);
      localStorage.setItem('gpaq_chat_session', data.conversacion_id);
      setMensajes([
        { id: 0, remitente: 'assistant', contenido: data.mensaje_bienvenida }
      ]);
    } catch (err) {
      setMensajes([
        { id: -1, remitente: 'assistant', contenido: 'Lo siento, en este momento el soporte por chat no está disponible.' }
      ]);
    } finally {
      setInicializando(false);
    }
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversacionId || loading) return;

    const textoUsuario = input;
    setInput('');
    setMensajes(prev => [...prev, { id: Date.now(), remitente: 'user', contenido: textoUsuario }]);
    setLoading(true);

    try {
      const respuesta = await api.sendChatMessage(conversacionId, textoUsuario);
      setMensajes(prev => [...prev, respuesta]);
    } catch (err: any) {
      setMensajes(prev => [
        ...prev, 
        { 
          id: Date.now() + 1, 
          remitente: 'assistant', 
          contenido: 'Disculpa, ha ocurrido un error al conectar con el servidor.' 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Ventana de Chat */}
      {isOpen && (
        <div className="w-[350px] sm:w-[400px] h-[500px] bg-zinc-900 border border-zinc-850 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 animate-slideUp backdrop-blur-md">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-650 px-5 py-4 flex items-center justify-between text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                <Bot className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight text-white">Soporte Inteligente</h3>
                <span className="text-[10px] text-indigo-200 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  En línea
                </span>
              </div>
            </div>
            <button 
              onClick={toggleWidget}
              className="text-white/80 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-950/20">
            {inicializando ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                <Loader className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs">Iniciando asistente...</span>
              </div>
            ) : (
              mensajes.map((msg, index) => (
                <div 
                  key={msg.id || index} 
                  className={`flex ${msg.remitente === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm
                    ${msg.remitente === 'user' 
                      ? 'bg-indigo-650 text-white rounded-tr-none' 
                      : 'bg-zinc-800/80 border border-zinc-850/60 text-zinc-150 rounded-tl-none'}
                  `}>
                    {msg.contenido}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800/40 border border-zinc-800/40 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={finalMensajesRef} />
          </div>

          {/* Formulario envío */}
          <form onSubmit={handleEnviar} className="p-3 border-t border-zinc-850 bg-zinc-900/60 flex gap-2">
            <input
              type="text"
              required
              disabled={loading || inicializando}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Haz tu pregunta aquí..."
              className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-4 text-xs text-zinc-200 placeholder-zinc-700 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || inicializando}
              className="bg-indigo-650 hover:bg-indigo-550 text-white p-2.5 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.96] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Botón flotante del Chat */}
      <button
        onClick={toggleWidget}
        className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-500 hover:to-purple-550 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-indigo-500/25 cursor-pointer active:scale-95 hover:scale-105 transition-all focus:outline-none"
        title="Abrir soporte por chat"
      >
        {isOpen ? (
          <X className="w-6 h-6 rotate-90 transition-transform duration-300" />
        ) : (
          <MessageSquare className="w-6 h-6 scale-100 transition-transform" />
        )}
      </button>
    </div>
  );
}
