import asyncio
import os
import sys
from pathlib import Path
import bcrypt
import asyncmy
from dotenv import load_dotenv

# Asegurar que importamos las configuraciones correctas
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "gestion_faq_bd")

async def inicializar_bd():
    print(f"Conectando al servidor MySQL en {DB_HOST}:{DB_PORT}...")
    
    # 1. Conexión inicial sin base de datos para crearla si no existe
    try:
        conn = await asyncmy.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            autocommit=True
        )
    except Exception as e:
        print(f"Error al conectar con MySQL: {e}", file=sys.stderr)
        print("Asegúrate de que el servidor MySQL está corriendo y las credenciales en .env son correctas.", file=sys.stderr)
        sys.exit(1)

    async with conn.cursor() as cursor:
        print(f"Creando base de datos '{DB_NAME}' si no existe...")
        await cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    await conn.ensure_closed()

    # 2. Conectarse directamente a la base de datos para ejecutar el esquema
    print(f"Conectando a la base de datos '{DB_NAME}'...")
    conn = await asyncmy.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        autocommit=True
    )

    # 3. Leer y procesar init.sql
    init_sql_path = Path(__file__).parent / "init.sql"
    if not init_sql_path.exists():
        print(f"No se encontró el archivo {init_sql_path}", file=sys.stderr)
        sys.exit(1)

    with open(init_sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Dividir por sentencias SQL (separadas por ;)
    # Para evitar errores con comentarios o saltos de línea
    statements = []
    current_statement = []
    for line in sql_content.splitlines():
        if line.strip().startswith("--") or not line.strip():
            continue
        current_statement.append(line)
        if line.strip().endswith(";"):
            statements.append("\n".join(current_statement))
            current_statement = []

    async with conn.cursor() as cursor:
        print("Ejecutando sentencias del esquema SQL...")
        for stmt in statements:
            if stmt.strip():
                try:
                    await cursor.execute(stmt)
                except Exception as e:
                    print(f"Error ejecutando sentencia:\n{stmt}\nDetalle: {e}", file=sys.stderr)
                    # Continuar con el resto de sentencias si es posible
    
        # 4. Crear el usuario administrador de forma segura si no existe
        await cursor.execute("SELECT COUNT(*) FROM usuarios WHERE email = %s", ("admin@gpaq.com",))
        row = await cursor.fetchone()
        if row and row[0] == 0:
            print("Creando usuario administrador inicial (admin@gpaq.com)...")
            password_plana = "admin123"
            salt = bcrypt.gensalt(rounds=12)
            password_hash = bcrypt.hashpw(password_plana.encode('utf-8'), salt).decode('utf-8')
            
            await cursor.execute(
                "INSERT INTO usuarios (nombre, email, password_hash, activo) VALUES (%s, %s, %s, %s)",
                ("Administrador", "admin@gpaq.com", password_hash, 1)
            )
            print("Usuario administrador creado con éxito.")
        else:
            print("El usuario administrador inicial ya existe.")

        # 5. Asegurar que haya al menos una configuración del bot por defecto
        await cursor.execute("SELECT COUNT(*) FROM configuraciones_bot")
        row = await cursor.fetchone()
        if row and row[0] == 0:
            print("Insertando configuración del bot por defecto...")
            await cursor.execute(
                """
                INSERT INTO configuraciones_bot (bot_nombre, mensaje_bienvenida, mensaje_fallback, sector, temperatura, system_prompt)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                ("GPAQ Assistant", "¡Hola! Bienvenido al soporte de GPAQ. ¿En qué puedo ayudarte hoy?", 
                 "Lo siento, no poseo información sobre esa consulta en mi base de conocimiento. ¿Te gustaría que te asista un agente humano?", 
                 "Soporte E-Commerce", 0.1, "Eres un asistente virtual experto para una tienda de comercio electrónico. Responde de manera profesional, concisa y amable.")
            )
            print("Configuración inicial del bot creada.")

    await conn.ensure_closed()
    print("¡Inicialización de la Base de Datos finalizada con éxito!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(inicializar_bd())
