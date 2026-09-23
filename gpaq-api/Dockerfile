# syntax=docker/dockerfile:1.7

########################################
# Stage 1: builder — compila dependencias (incluye asyncmy/Cython)
########################################
FROM python:3.14.6-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Herramientas de compilación necesarias para construir asyncmy (extensión C/Cython)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
    && rm -rf /var/lib/apt/lists/*

# Entorno virtual aislado que luego se copia a la imagen final
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

########################################
# Stage 2: runtime — imagen final mínima y sin toolchain
########################################
FROM python:3.14.6-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    UVICORN_WORKERS=2

# Utilidad usada por el HEALTHCHECK
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app --no-create-home app

# Copia del entorno virtual ya construido
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# Código de la aplicación y entrypoint
COPY --chown=app:app . .
# Normaliza finales de línea (evita fallos por CRLF de Windows) y da permisos
RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
