from fastapi import APIRouter, Depends
from typing import List
import asyncmy
from app.dependencies.database import obtener_conexion_bd
from app.models.chat_model import ChatInitResponse, MessageCreate, MessageResponse
from app.repositories.chat_repository import ChatRepository
from app.repositories.faq_repository import FAQRepository
from app.repositories.bot_repository import BotRepository
from app.services.ai_service import AIService
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Chat Público (Widget)"])

async def obtener_chat_service(db: asyncmy.Connection = Depends(obtener_conexion_bd)) -> ChatService:
    """
    Inyecta el servicio de chat público con sus dependencias.
    """
    return ChatService(
        chat_repo=ChatRepository(db),
        faq_repo=FAQRepository(db),
        bot_repo=BotRepository(db),
        ai_service=AIService()
    )

@router.post("/start", response_model=ChatInitResponse)
async def iniciar_conversacion(
    service: ChatService = Depends(obtener_chat_service)
):
    """
    Inicia una sesión de chat para el widget del cliente. Devuelve conversacion_id y mensaje de bienvenida.
    """
    return await service.iniciar_conversacion()

@router.post("/{conversacion_id}/message", response_model=MessageResponse)
async def enviar_mensaje(
    conversacion_id: str,
    body: MessageCreate,
    service: ChatService = Depends(obtener_chat_service)
):
    """
    Recibe un mensaje de un cliente anónimo, busca respuestas y devuelve la respuesta generada por la IA.
    """
    return await service.procesar_mensaje(conversacion_id, body.contenido)

@router.get("/{conversacion_id}/history", response_model=List[MessageResponse])
async def obtener_historial(
    conversacion_id: str,
    service: ChatService = Depends(obtener_chat_service)
):
    """
    Recupera el historial de chat completo para que la sesión no se pierda al recargar el widget.
    """
    return await service.obtener_historial(conversacion_id)
