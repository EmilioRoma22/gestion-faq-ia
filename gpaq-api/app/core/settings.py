import os
from typing import List


def _obtener_int_env(nombre: str, default: int) -> int:
    raw = os.getenv(nombre)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _obtener_cors_origins() -> List[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()

    if raw:
        limpios = [
            o.strip().rstrip("/")
            for o in raw.split(",")
            if o.strip() and o.strip().rstrip("/") not in ("http:", "https:")
        ]
        if limpios:
            return limpios

    origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
    ]

    return origins


class Settings:
    PROJECT_NAME: str = "Gestión de FAQ con IA"
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_VERSION: str = "1.0.0"
    PROJECT_DESCRIPTION: str = "API para el Sistema de Gestión de FAQ con IA"

    ENV: str = os.getenv("ENV", "development")
    DOCS_ENABLED: bool = os.getenv("DOCS_ENABLED", "false").lower() == "true"
    CORS_ORIGINS: List[str] = _obtener_cors_origins()
    COOKIES_SECURE: bool = os.getenv("COOKIES_SECURE", "false").lower() == "true"
    COOKIES_SAMESITE: str = os.getenv("COOKIES_SAMESITE", "lax")

    DB_HOST: str = os.getenv("DB_HOST") or os.getenv("MYSQLHOST")
    DB_PORT: int = _obtener_int_env("DB_PORT", _obtener_int_env("MYSQLPORT", 3306))
    DB_USER: str = os.getenv("DB_USER") or os.getenv("MYSQLUSER")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD")
    DB_NAME: str = os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE")
    DB_POOL_SIZE: int = _obtener_int_env("DB_POOL_SIZE", 5)
    DB_CONNECTION_TIMEOUT: int = _obtener_int_env("DB_CONNECTION_TIMEOUT", 10)

    # Configuración de DeepSeek
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_BASE: str = os.getenv(
        "DEEPSEEK_API_BASE", "https://api.deepseek.com/v1"
    )


settings = Settings()
