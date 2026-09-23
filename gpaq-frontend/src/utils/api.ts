const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// Obtiene el token guardado en localStorage
const obtenerToken = (): string | null => {
  return localStorage.getItem('gpaq_token');
};

// Genera los headers estándar para las peticiones
const obtenerHeaders = (requiereAuth = true): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiereAuth) {
    const token = obtenerToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

// Maneja la respuesta HTTP lanzando errores formateados
const manejarRespuesta = async (response: Response) => {
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  
  if (!response.ok) {
    // Si la API devuelve el error estándar {"error": {"message": "..."}}
    const mensaje = data.error?.message || 'Ha ocurrido un error en la solicitud.';
    throw new Error(mensaje);
  }

  return data;
};

export const api = {
  // --- AUTENTICACIÓN ---
  async login(email: string, password: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: obtenerHeaders(false),
      body: JSON.stringify({ email, password }),
    });
    const data = await manejarRespuesta(res);
    localStorage.setItem('gpaq_token', data.access_token);
    return data.access_token;
  },

  logout(): void {
    localStorage.removeItem('gpaq_token');
  },

  isLoggedIn(): boolean {
    return !!obtenerToken();
  },

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: obtenerHeaders(true),
    });
    return manejarRespuesta(res);
  },

  // --- CONFIGURACIÓN DEL BOT ---
  async getBotConfig() {
    const res = await fetch(`${API_BASE_URL}/bot-config`, {
      method: 'GET',
      headers: obtenerHeaders(true),
    });
    return manejarRespuesta(res);
  },

  async updateBotConfig(config: any) {
    const res = await fetch(`${API_BASE_URL}/bot-config`, {
      method: 'PUT',
      headers: obtenerHeaders(true),
      body: JSON.stringify(config),
    });
    return manejarRespuesta(res);
  },

  // --- CRUD DE FAQS ---
  async listarFaqs(params: { limit?: number; offset?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    if (params.offset !== undefined) query.append('offset', params.offset.toString());
    if (params.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE_URL}/faqs?${query.toString()}`, {
      method: 'GET',
      headers: obtenerHeaders(true),
    });
    return manejarRespuesta(res);
  },

  async crearFaq(faq: { pregunta: string; respuesta: string; categoria: string; activo: boolean }) {
    const res = await fetch(`${API_BASE_URL}/faqs`, {
      method: 'POST',
      headers: obtenerHeaders(true),
      body: JSON.stringify(faq),
    });
    return manejarRespuesta(res);
  },

  async actualizarFaq(id: number, faq: any) {
    const res = await fetch(`${API_BASE_URL}/faqs/${id}`, {
      method: 'PUT',
      headers: obtenerHeaders(true),
      body: JSON.stringify(faq),
    });
    return manejarRespuesta(res);
  },

  async eliminarFaq(id: number) {
    const res = await fetch(`${API_BASE_URL}/faqs/${id}`, {
      method: 'DELETE',
      headers: obtenerHeaders(true),
    });
    return manejarRespuesta(res);
  },

  // --- WIDGET CHAT PÚBLICO ---
  async startChat() {
    const res = await fetch(`${API_BASE_URL}/chat/start`, {
      method: 'POST',
      headers: obtenerHeaders(false),
    });
    return manejarRespuesta(res);
  },

  async sendChatMessage(conversacionId: string, contenido: string) {
    const res = await fetch(`${API_BASE_URL}/chat/${conversacionId}/message`, {
      method: 'POST',
      headers: obtenerHeaders(false),
      body: JSON.stringify({ contenido }),
    });
    return manejarRespuesta(res);
  },

  async getChatHistory(conversacionId: string) {
    const res = await fetch(`${API_BASE_URL}/chat/${conversacionId}/history`, {
      method: 'GET',
      headers: obtenerHeaders(false),
    });
    return manejarRespuesta(res);
  }
};
