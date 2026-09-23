from app.repositories.chat_repository import ChatRepository
from app.repositories.faq_repository import FAQRepository
from app.repositories.bot_repository import BotRepository
from app.services.ai_service import AIService
from app.core.excepciones import AppException
from typing import Dict, Any, List

class ChatService:
    def __init__(
        self,
        chat_repo: ChatRepository,
        faq_repo: FAQRepository,
        bot_repo: BotRepository,
        ai_service: AIService
    ):
        self.chat_repo = chat_repo
        self.faq_repo = faq_repo
        self.bot_repo = bot_repo
        self.ai_service = ai_service

    async def iniciar_conversacion(self) -> Dict[str, Any]:
        """
        Crea una nueva conversación en base de datos y devuelve el ID junto al saludo inicial.
        """
        config = await self.bot_repo.obtener_configuracion()
        mensaje_bienvenida = config["mensaje_bienvenida"] if config else "¡Hola! ¿En qué puedo ayudarte hoy?"
        
        conv_id = await self.chat_repo.crear_conversacion()
        return {
            "conversacion_id": conv_id,
            "mensaje_bienvenida": mensaje_bienvenida
        }

    async def procesar_mensaje(self, conv_id: str, contenido_mensaje: str) -> Dict[str, Any]:
        """
        Orquesta el flujo del chat: guarda el mensaje del usuario, recupera FAQs afines,
        invoca la respuesta de DeepSeek, la almacena y la devuelve.
        """
        # 1. Validar que la conversación existe
        conversacion = await self.chat_repo.obtener_conversacion(conv_id)
        if not conversacion:
            raise AppException(
                status_code=404,
                code="conversation_not_found",
                message=f"La conversación con ID {conv_id} no existe."
            )

        # 2. Guardar mensaje del usuario en base de datos
        mensaje_usuario = await self.chat_repo.agregar_mensaje(conv_id, "user", contenido_mensaje)

        # 3. Obtener el historial completo
        historial = await self.chat_repo.obtener_mensajes(conv_id)

        # 4. Cargar configuración del bot
        bot_config = await self.bot_repo.obtener_configuracion()
        if not bot_config:
            bot_config = {
                "bot_nombre": "GPAQ Bot",
                "mensaje_bienvenida": "¡Hola!",
                "mensaje_fallback": "Lo siento, no poseo información sobre eso.",
                "sector": "General",
                "temperatura": 0.2,
                "system_prompt": "Responde de forma profesional."
            }

        # 5. RAG: Buscar FAQs más similares en base al mensaje actual del usuario
        faqs_contexto = await self.faq_repo.buscar_similares(contenido_mensaje, limite=4)

        # 6. Consultar a la IA pasándole el historial previo al mensaje recién insertado
        historial_previo = [m for m in historial if m["id"] != mensaje_usuario["id"]]
        
        respuesta_ia = await self.ai_service.consultar_ia(
            pregunta_usuario=contenido_mensaje,
            historial=historial_previo,
            bot_config=bot_config,
            faqs_contexto=faqs_contexto
        )

        # 7. Guardar el mensaje de respuesta de la IA en la base de datos
        mensaje_asistente = await self.chat_repo.agregar_mensaje(conv_id, "assistant", respuesta_ia)
        return mensaje_asistente

    async def obtener_historial(self, conv_id: str) -> List[Dict[str, Any]]:
        """
        Devuelve el historial de mensajes de la conversación.
        """
        conversacion = await self.chat_repo.obtener_conversacion(conv_id)
        if not conversacion:
            raise AppException(
                status_code=404,
                code="conversation_not_found",
                message=f"La conversación con ID {conv_id} no existe."
            )
        return await self.chat_repo.obtener_mensajes(conv_id)
