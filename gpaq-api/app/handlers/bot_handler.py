from fastapi import APIRouter, Depends
from app.dependencies.database import obtener_conexion_bd
from app.dependencies.auth_deps import obtener_usuario_actual
from app.models.bot_model import BotConfigUpdate, BotConfigResponse
from app.repositories.bot_repository import BotRepository
from app.services.bot_service import BotService
import asyncmy

router = APIRouter(prefix="/bot-config", tags=["Configuración de la IA (Bot)"])

async def obtener_bot_service(db: asyncmy.Connection = Depends(obtener_conexion_bd)) -> BotService:
    """
    Inyecta el servicio de configuración del bot.
    """
    return BotService(BotRepository(db))

@router.get("", response_model=BotConfigResponse)
async def obtener_configuracion(
    service: BotService = Depends(obtener_bot_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Obtiene la configuración actual de la identidad del chatbot. Ruta protegida.
    """
    return await service.obtener_configuracion()

@router.put("", response_model=BotConfigResponse)
async def guardar_configuracion(
    body: BotConfigUpdate,
    service: BotService = Depends(obtener_bot_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Actualiza la configuración de identidad del chatbot. Ruta protegida.
    """
    return await service.guardar_configuracion(body.model_dump(exclude_unset=True))
