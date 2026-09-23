import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Save, Bot, Loader, CheckCircle, Info } from 'lucide-react';

export default function BotConfig() {
  const [config, setConfig] = useState({
    bot_nombre: 'FAQ Bot',
    mensaje_bienvenida: '',
    mensaje_fallback: '',
    sector: 'General',
    temperatura: 0.2,
    system_prompt: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    cargarConfig();
  }, []);

  const cargarConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getBotConfig();
      setConfig(data);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al cargar la configuración.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: name === 'temperatura' ? parseFloat(value) : value
    }));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setConfig(prev => ({ ...prev, temperatura: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMensaje(null);

    try {
      const data = await api.updateBotConfig(config);
      setConfig(data);
      setMensaje({ tipo: 'success', texto: 'Configuración guardada exitosamente.' });
      setTimeout(() => setMensaje(null), 4000);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al guardar la configuración.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <Loader className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Cargando parámetros del bot...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-400" />
            Configuración de la Identidad de la IA
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Define la personalidad, el sector, el tono y las instrucciones base de tu asistente.
          </p>
        </div>
      </div>

      {mensaje && (
        <div className={`flex items-start gap-3 border rounded-xl p-4 text-sm transition-all ${
          mensaje.tipo === 'success' 
            ? 'bg-emerald-950/35 border-emerald-800/50 text-emerald-300' 
            : 'bg-red-950/35 border-red-800/50 text-red-300'
        }`}>
          {mensaje.tipo === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <Info className="w-5 h-5 shrink-0 text-red-400" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Nombre del Bot
            </label>
            <input
              type="text"
              name="bot_nombre"
              required
              value={config.bot_nombre}
              onChange={handleChange}
              placeholder="Ej. GPAQ Assistant"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all"
            />
          </div>

          {/* Sector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Sector del Negocio
            </label>
            <input
              type="text"
              name="sector"
              required
              value={config.sector}
              onChange={handleChange}
              placeholder="Ej. E-commerce de Calzado, Universidad, etc."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mensaje de Bienvenida */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Mensaje de Bienvenida
            </label>
            <input
              type="text"
              name="mensaje_bienvenida"
              required
              value={config.mensaje_bienvenida}
              onChange={handleChange}
              placeholder="Ej. ¡Hola! ¿Cómo te puedo ayudar hoy?"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all"
            />
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Mensaje inicial que verá el cliente al abrir la ventana del widget.
            </span>
          </div>

          {/* Mensaje de Fallback */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Mensaje de Fallback (No info)
            </label>
            <input
              type="text"
              name="mensaje_fallback"
              required
              value={config.mensaje_fallback}
              onChange={handleChange}
              placeholder="Ej. Lo siento, no tengo esa información..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all"
            />
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Frase fija que la IA devolverá si no encuentra respuesta en las FAQs.
            </span>
          </div>
        </div>

        {/* Temperatura slider */}
        <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Creatividad / Precisión (Temperatura)
            </label>
            <span className="text-sm font-bold text-indigo-400">{config.temperatura.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.1"
            value={config.temperatura}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
            <span>Preciso (Recomendado para FAQ: 0.1 - 0.3)</span>
            <span>Creativo / Fluido</span>
          </div>
        </div>

        {/* System Prompt (textarea) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Instrucciones del Sistema (System Prompt)
            </label>
            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              Directivas fundamentales del bot
            </div>
          </div>
          <textarea
            name="system_prompt"
            required
            rows={5}
            value={config.system_prompt}
            onChange={handleChange}
            placeholder="Ej. Eres un asistente experto en soporte técnico de hosting. Responde únicamente basándote en la base de datos..."
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-750 outline-none transition-all resize-y min-h-[120px]"
          />
          <span className="text-[11px] text-zinc-500 block mt-1">
            Define la personalidad del bot y las reglas generales. El sistema inyectará las FAQs de coincidencia automáticamente como contexto de forma segura.
          </span>
        </div>

        {/* Botón de envío */}
        <div className="pt-2 border-t border-zinc-800/40 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-6 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-500/15 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
