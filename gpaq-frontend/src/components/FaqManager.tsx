import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Search, Plus, Edit2, Trash2, Loader, CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function FaqManager() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 6;

  // Estados del modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ pregunta: '', respuesta: '', categoria: 'Soporte', activo: true });
  const [formSaving, setFormSaving] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Mensajes globales
  const [notificacion, setNotificacion] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  // Cargar FAQs cuando cambie la página (offset) o búsqueda
  useEffect(() => {
    cargarFaqs();
  }, [offset, search]);

  const cargarFaqs = async () => {
    try {
      setLoading(true);
      const data = await api.listarFaqs({ limit, offset, search });
      setFaqs(data.items);
      setTotal(data.total);
    } catch (err: any) {
      mostrarNotificacion('error', err.message || 'Error al cargar FAQs.');
    } finally {
      setLoading(false);
    }
  };

  const mostrarNotificacion = (tipo: 'success' | 'error', texto: string) => {
    setNotificacion({ tipo, texto });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOffset(0); // Reiniciar a la primera página en búsquedas
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ pregunta: '', respuesta: '', categoria: 'General', activo: true });
    setErrorModal(null);
    setModalOpen(true);
  };

  const openEditModal = (faq: any) => {
    setEditingId(faq.id);
    setForm({
      pregunta: faq.pregunta,
      respuesta: faq.respuesta,
      categoria: faq.categoria,
      activo: faq.activo === 1 || faq.activo === true
    });
    setErrorModal(null);
    setModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'activo' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: checked }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setErrorModal(null);

    try {
      if (editingId) {
        await api.actualizarFaq(editingId, form);
        mostrarNotificacion('success', 'FAQ actualizada correctamente.');
      } else {
        await api.crearFaq(form);
        mostrarNotificacion('success', 'FAQ creada exitosamente.');
      }
      setModalOpen(false);
      cargarFaqs();
    } catch (err: any) {
      setErrorModal(err.message || 'Error al guardar.');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleEstado = async (faq: any) => {
    try {
      const nuevoEstado = !(faq.activo === 1 || faq.activo === true);
      await api.actualizarFaq(faq.id, { activo: nuevoEstado });
      cargarFaqs();
      mostrarNotificacion('success', `FAQ ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`);
    } catch (err: any) {
      mostrarNotificacion('error', err.message || 'Error al cambiar estado.');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta FAQ permanentemente?')) return;
    try {
      await api.eliminarFaq(id);
      mostrarNotificacion('success', 'FAQ eliminada correctamente.');
      cargarFaqs();
    } catch (err: any) {
      mostrarNotificacion('error', err.message || 'Error al eliminar.');
    }
  };

  const totalPaginas = Math.ceil(total / limit);
  const paginaActual = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Preguntas Frecuentes (FAQs)</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Administra la base de conocimiento con la que responderá la Inteligencia Artificial.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-500/15 active:scale-[0.99] transition-all text-sm self-start sm:self-auto"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>Agregar FAQ</span>
        </button>
      </div>

      {notificacion && (
        <div className={`flex items-start gap-3 border rounded-xl p-4 text-sm transition-all animate-fadeIn ${
          notificacion.tipo === 'success' 
            ? 'bg-emerald-950/35 border-emerald-800/50 text-emerald-300' 
            : 'bg-red-950/35 border-red-800/50 text-red-300'
        }`}>
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{notificacion.texto}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar pregunta, respuesta o categoría..."
          className="w-full bg-zinc-900/40 border border-zinc-800/60 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-550 outline-none backdrop-blur-md transition-all"
        />
      </div>

      {/* Lista de FAQs */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
          <p className="text-sm">Cargando base de conocimiento...</p>
        </div>
      ) : faqs.length === 0 ? (
        <div className="bg-zinc-900/10 border border-zinc-800/50 rounded-2xl p-12 text-center">
          <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-zinc-300 font-semibold text-lg">No se encontraron FAQs</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
            {search 
              ? 'No hay registros que coincidan con los términos de búsqueda. Inténtalo con otras palabras.' 
              : 'La base de conocimiento está vacía. Comienza agregando tu primera FAQ para alimentar al bot.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {faqs.map((faq) => {
              const activo = faq.activo === 1 || faq.activo === true;
              return (
                <div 
                  key={faq.id} 
                  className="bg-zinc-900/35 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700/60 transition-all flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-zinc-850 border border-zinc-850 text-zinc-300 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md">
                        {faq.categoria}
                      </span>
                      <button 
                        onClick={() => toggleEstado(faq)}
                        className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                          activo 
                            ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400 hover:bg-emerald-950/40' 
                            : 'bg-zinc-950/20 border-zinc-800/50 text-zinc-500 hover:bg-zinc-800/20'
                        }`}
                      >
                        {activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                    <h3 className="text-zinc-100 font-semibold text-base">{faq.pregunta}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{faq.respuesta}</p>
                  </div>

                  <div className="flex items-center md:flex-col justify-end gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/30">
                    <button
                      onClick={() => openEditModal(faq)}
                      className="p-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-indigo-400 border border-zinc-800 rounded-xl cursor-pointer transition-all"
                      title="Editar FAQ"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEliminar(faq.id)}
                      className="p-2.5 bg-zinc-800/50 hover:bg-red-950/30 text-zinc-300 hover:text-red-400 border border-zinc-800 hover:border-red-900/30 rounded-xl cursor-pointer transition-all"
                      title="Eliminar FAQ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
              <span className="text-xs text-zinc-400">
                Página <strong className="text-zinc-200">{paginaActual}</strong> de <strong className="text-zinc-200">{totalPaginas}</strong> ({total} registros)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(prev => Math.max(0, prev - limit))}
                  className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 rounded-xl cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  disabled={paginaActual === totalPaginas}
                  onClick={() => setOffset(prev => prev + limit)}
                  className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 rounded-xl cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Agregar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}></div>

          {/* Contenido del Modal */}
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-zoomIn">
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
              <h3 className="text-lg font-bold text-zinc-100">
                {editingId ? 'Modificar FAQ' : 'Agregar Nueva FAQ'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 cursor-pointer p-1 rounded-lg hover:bg-zinc-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorModal && (
              <div className="m-6 mb-0 flex items-start gap-3 bg-red-950/45 border border-red-900/60 text-red-300 rounded-lg p-3 text-xs">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-400" />
                <span>{errorModal}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Pregunta
                </label>
                <input
                  type="text"
                  name="pregunta"
                  required
                  value={form.pregunta}
                  onChange={handleInputChange}
                  placeholder="Ej. ¿Cómo puedo cambiar mi contraseña?"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Respuesta
                </label>
                <textarea
                  name="respuesta"
                  required
                  rows={4}
                  value={form.respuesta}
                  onChange={handleInputChange}
                  placeholder="Ej. Ingresa a la sección de configuración, pulsa en 'Cambiar contraseña' y sigue los pasos del correo..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-750 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Categoría
                  </label>
                  <input
                    type="text"
                    name="categoria"
                    required
                    value={form.categoria}
                    onChange={handleInputChange}
                    placeholder="Ej. Pagos, Envíos, Soporte"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="activo"
                    name="activo"
                    checked={form.activo}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-indigo-600 border-zinc-850 rounded bg-zinc-950 focus:ring-indigo-500 focus:ring-offset-zinc-900 focus:ring-2"
                  />
                  <label htmlFor="activo" className="text-sm text-zinc-300 font-medium cursor-pointer">
                    Habilitada / Activa
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-5 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl cursor-pointer hover:bg-zinc-800/30 text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-5 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-500/15 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {formSaving ? (
                    <>
                      <Loader className="w-4.5 h-4.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar FAQ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
