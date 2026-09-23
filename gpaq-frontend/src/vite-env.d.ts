/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL de la API. En contenedores se inyecta en build (por defecto /api/v1). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
