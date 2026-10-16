#!/bin/sh
set -eu

PORT="${PORT:-8000}"

# Inicializa la base de datos (crea esquema, admin, FAQs y config inicial del bot).
# run_init.py es idempotente: solo crea lo que aún no exista.
echo "[entrypoint] Inicializando base de datos..."
python db/run_init.py

echo "[entrypoint] Arrancando API en 0.0.0.0:${PORT} (workers=${UVICORN_WORKERS:-2})..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers "${UVICORN_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips '*'
