from app.repositories.bot_repository import BotRepository
from typing import Dict, Any

class BotService:
    def __init__(self, bot_repo: BotRepository):
        self.bot_repo = bot_repo

    async def obtener_configuracion(self) -> Dict[str, Any]:
        """
        Obtiene la configuración actual de identidad del bot.
        Si no hay ninguna en la BD, inicializa y devuelve una por defecto.
        """
        config = await self.bot_repo.obtener_configuracion()
        if not config:
            default_config = {
                "bot_nombre": "GPAQ Assistant",
                "mensaje_bienvenida": "¡Hola! Bienvenido al soporte de GPAQ. ¿En qué puedo ayudarte hoy?",
                "mensaje_fallback": "Lo siento, no poseo información sobre esa consulta en mi base de conocimiento. ¿Te gustaría que te asista un agente humano?",
                "sector": "Soporte General",
                "temperatura": 0.2,
                "system_prompt": "Eres un asistente virtual experto. Responde de manera profesional, concisa y amable."
            }
            await self.bot_repo.guardar_configuracion(default_config)
            config = await self.bot_repo.obtener_configuracion()
        return config

    async def guardar_configuracion(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Guarda o actualiza la configuración de identidad del bot.
        """
        await self.bot_repo.guardar_configuracion(data)
        return await self.obtener_configuracion()
