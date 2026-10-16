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

DB_HOST = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "localhost"
DB_PORT = int(os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or "3306")
DB_USER = os.getenv("DB_USER") or os.getenv("MYSQLUSER") or "root"
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD") or ""
DB_NAME = os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or "gestion_faq_bd"

SEED_FAQS = [
    (
        "¿Cuáles son los horarios de atención?",
        "Nuestro horario de atención al cliente es de lunes a viernes de 9:00 AM a 6:00 PM y los sábados de 9:00 AM a 1:00 PM. Los domingos permanecemos cerrados.",
        "Soporte",
        1,
    ),
    (
        "¿Cuánto tiempo tarda el envío de un producto?",
        "Los envíos nacionales tardan entre 3 y 5 días hábiles, mientras que los envíos internacionales pueden tardar de 7 a 15 días hábiles dependiendo del país de destino.",
        "Envíos",
        1,
    ),
    (
        "¿Cómo puedo solicitar una devolución o reembolso?",
        "Para solicitar una devolución, dispones de 14 días naturales desde la recepción de tu producto. El producto debe estar en su empaque original y sin signos de uso. Escribe a devoluciones@gpaq.com con tu número de orden.",
        "Devoluciones",
        1,
    ),
    (
        "¿Cuáles son los métodos de pago aceptados?",
        "Aceptamos tarjetas de crédito y débito Visa, Mastercard y American Express, además de pagos mediante PayPal, transferencias bancarias SPEI y pagos en efectivo en tiendas de conveniencia asociadas.",
        "Pagos",
        1,
    ),
    (
        "¿Cómo puedo rastrear mi pedido?",
        "Una vez enviado tu pedido, recibirás un correo electrónico automático con el número de guía y un enlace directo para rastrearlo en el sitio web de la paquetería (DHL, FedEx o Estafeta).",
        "Envíos",
        1,
    ),
]


async def conectar_con_reintentos(database: str | None = None, intentos: int = 10, espera: int = 3):
    ultimo_error = None
    for intento in range(1, intentos + 1):
        try:
            kwargs = {
                "host": DB_HOST,
                "port": DB_PORT,
                "user": DB_USER,
                "password": DB_PASSWORD,
                "autocommit": True,
            }
            if database:
                kwargs["database"] = database
            return await asyncmy.connect(**kwargs)
        except Exception as e:
            ultimo_error = e
            print(
                f"[Intento {intento}/{intentos}] Esperando disponibilidad de MySQL en {DB_HOST}:{DB_PORT}... ({e})"
            )
            if intento < intentos:
                await asyncio.sleep(espera)

    print(f"Error al conectar con MySQL tras {intentos} intentos: {ultimo_error}", file=sys.stderr)
    sys.exit(1)


async def inicializar_bd():
    print(f"Conectando al servidor MySQL en {DB_HOST}:{DB_PORT}...")

    # 1. Conexión inicial para crear la base de datos si no existe (o continuar si el usuario ya apunta a railway)
    try:
        conn = await conectar_con_reintentos()
        async with conn.cursor() as cursor:
            print(f"Verificando base de datos '{DB_NAME}'...")
            await cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        await conn.ensure_closed()
    except Exception as e:
        print(f"Aviso al verificar/crear base de datos '{DB_NAME}' (conectando directo): {e}")

    # 2. Conectarse directamente a la base de datos para ejecutar el esquema
    print(f"Conectando a la base de datos '{DB_NAME}'...")
    conn = await conectar_con_reintentos(database=DB_NAME)

    # 3. Leer y procesar init.sql
    init_sql_path = Path(__file__).parent / "init.sql"
    if not init_sql_path.exists():
        print(f"No se encontró el archivo {init_sql_path}", file=sys.stderr)
        sys.exit(1)

    with open(init_sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

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

        # 4. Crear el usuario administrador de forma segura si no existe
        await cursor.execute("SELECT COUNT(*) FROM usuarios WHERE email = %s", ("admin@gpaq.com",))
        row = await cursor.fetchone()
        if row and row[0] == 0:
            print("Creando usuario administrador inicial (admin@gpaq.com)...")
            password_plana = "admin123"
            salt = bcrypt.gensalt(rounds=12)
            password_hash = bcrypt.hashpw(password_plana.encode("utf-8"), salt).decode("utf-8")

            await cursor.execute(
                "INSERT INTO usuarios (nombre, email, password_hash, activo) VALUES (%s, %s, %s, %s)",
                ("Administrador", "admin@gpaq.com", password_hash, 1),
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
                (
                    "GPAQ Assistant",
                    "¡Hola! Bienvenido al soporte de GPAQ. ¿En qué puedo ayudarte hoy?",
                    "Lo siento, no poseo información sobre esa consulta en mi base de conocimiento. ¿Te gustaría que te asista un agente humano?",
                    "Soporte E-Commerce",
                    0.1,
                    "Eres un asistente virtual experto para una tienda de comercio electrónico. Responde de manera profesional, concisa y amable.",
                ),
            )
            print("Configuración inicial del bot creada.")

        # 6. Insertar FAQs iniciales de forma idempotente (solo si la tabla está vacía)
        await cursor.execute("SELECT COUNT(*) FROM faqs")
        row = await cursor.fetchone()
        if row and row[0] == 0:
            print("Insertando semillas iniciales de FAQs...")
            await cursor.executemany(
                "INSERT INTO faqs (pregunta, respuesta, categoria, activo) VALUES (%s, %s, %s, %s)",
                SEED_FAQS,
            )
            print("FAQs iniciales insertadas con éxito.")

    await conn.ensure_closed()
    print("¡Inicialización de la Base de Datos finalizada con éxito!")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(inicializar_bd())
