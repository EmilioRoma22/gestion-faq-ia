# syntax=docker/dockerfile:1.7

########################################
# Stage 1: build — compila el frontend con Node 24.17.0 + pnpm 11.8.0
########################################
FROM node:24.17.0-bookworm-slim AS build

# Habilita corepack y fija la versión exacta de pnpm requerida por el proyecto
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

# Instalación de dependencias con cache eficiente (capa separada del código)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Base URL de la API inyectada en tiempo de build (Vite la "hornea" en el bundle)
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Código fuente y build de producción -> genera /app/dist
COPY . .
RUN pnpm build

########################################
# Stage 2: runtime — NGINX sin privilegios sirviendo los estáticos en :8080
########################################
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Config de NGINX (SPA fallback + reverse proxy /api -> servicio api)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Artefactos estáticos ya construidos
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
