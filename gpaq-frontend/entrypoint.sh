#!/bin/sh
set -eu

PORT="${PORT:-8080}"
API_UPSTREAM="${API_BACKEND_URL:-}"

# Si no se definió API_BACKEND_URL pero VITE_API_BASE_URL es una URL completa (http/https),
# extraemos el origen base quitando /api/v1 para que el proxy /api/ también funcione.
if [ -z "$API_UPSTREAM" ] && [ -n "${VITE_API_BASE_URL:-}" ]; then
    case "$VITE_API_BASE_URL" in
        http://*|https://*)
            API_UPSTREAM=$(echo "$VITE_API_BASE_URL" | sed 's|/api/v1/*$||; s|/*$||')
            ;;
    esac
fi

# En Docker Compose local, si existe el contenedor "api" en la red, usarlo por defecto
if [ -z "$API_UPSTREAM" ]; then
    if getent hosts api >/dev/null 2>&1; then
        API_UPSTREAM="http://api:8000"
    fi
fi

# Quitar barra final si existe
API_UPSTREAM=$(echo "$API_UPSTREAM" | sed 's|/*$||')
if [ "$API_UPSTREAM" = "http:" ] || [ "$API_UPSTREAM" = "https:" ]; then
    API_UPSTREAM=""
fi

echo "[entrypoint-frontend] Configurando NGINX en puerto ${PORT}..."

PROXY_BLOCK=""
if [ -n "$API_UPSTREAM" ]; then
    echo "[entrypoint-frontend] Reverse proxy /api/ -> ${API_UPSTREAM}/api/"
    PROXY_BLOCK="
    location /api/ {
        proxy_pass ${API_UPSTREAM}/api/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host \$proxy_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }"
else
    echo "[entrypoint-frontend] Modo SPA directo (VITE_API_BASE_URL=${VITE_API_BASE_URL:-/api/v1})"
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${PORT};
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        font/woff2;
${PROXY_BLOCK}

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location ~* (sw\.js|sw-push\.js|registerSW\.js|manifest\.webmanifest)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

exec nginx -g "daemon off;"
