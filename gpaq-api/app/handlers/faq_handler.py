from fastapi import APIRouter, Depends, Query, status
from typing import Dict, Any, Optional
import asyncmy
from app.dependencies.database import obtener_conexion_bd
from app.dependencies.auth_deps import obtener_usuario_actual
from app.models.faq_model import FAQCreate, FAQUpdate, FAQResponse
from app.models.pagination_model import PaginationParams
from app.repositories.faq_repository import FAQRepository
from app.services.faq_service import FAQService

router = APIRouter(prefix="/faqs", tags=["Preguntas Frecuentes (FAQs)"])

async def obtener_faq_service(db: asyncmy.Connection = Depends(obtener_conexion_bd)) -> FAQService:
    """
    Inyecta el servicio de FAQs.
    """
    return FAQService(FAQRepository(db))

@router.get("", response_model=Dict[str, Any])
async def listar_faqs(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    order_by: Optional[str] = Query(None),
    order_dir: str = Query("ASC"),
    search: Optional[str] = Query(None),
    service: FAQService = Depends(obtener_faq_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Lista las FAQs de manera paginada y filtrada. Ruta protegida.
    """
    params = PaginationParams(
        limit=limit,
        offset=offset,
        order_by=order_by,
        order_dir=order_dir,
        search=search
    )
    return await service.listar_faqs(params)

@router.get("/{id}", response_model=FAQResponse)
async def obtener_faq(
    id: int,
    service: FAQService = Depends(obtener_faq_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Obtiene el detalle de una FAQ por ID. Ruta protegida.
    """
    return await service.obtener_faq(id)

@router.post("", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
async def crear_faq(
    body: FAQCreate,
    service: FAQService = Depends(obtener_faq_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Crea una nueva FAQ. Ruta protegida.
    """
    return await service.crear_faq(body.model_dump())

@router.put("/{id}", response_model=FAQResponse)
async def actualizar_faq(
    id: int,
    body: FAQUpdate,
    service: FAQService = Depends(obtener_faq_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Actualiza parcialmente una FAQ existente. Ruta protegida.
    """
    return await service.actualizar_faq(id, body.model_dump(exclude_unset=True))

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_faq(
    id: int,
    service: FAQService = Depends(obtener_faq_service),
    _user: dict = Depends(obtener_usuario_actual)
):
    """
    Elimina permanentemente una FAQ. Ruta protegida.
    """
    await service.eliminar_faq(id)
    return None
