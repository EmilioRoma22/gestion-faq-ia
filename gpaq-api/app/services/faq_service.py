from app.repositories.faq_repository import FAQRepository
from app.models.pagination_model import PaginationParams
from app.core.excepciones import AppException
from typing import Dict, Any, List

class FAQService:
    def __init__(self, faq_repo: FAQRepository):
        self.faq_repo = faq_repo

    async def obtener_faq(self, faq_id: int) -> Dict[str, Any]:
        """
        Obtiene una FAQ por su ID o lanza error 404.
        """
        faq = await self.faq_repo.fetch_one(
            f"SELECT * FROM {self.faq_repo.table_name} WHERE id = %s LIMIT 1",
            (faq_id,)
        )
        if not faq:
            raise AppException(
                status_code=404,
                code="faq_not_found",
                message=f"La FAQ con ID {faq_id} no existe o fue eliminada."
            )
        return faq

    async def listar_faqs(self, pagination: PaginationParams) -> Dict[str, Any]:
        """
        Lista y pagina todas las FAQs aplicando filtros de búsqueda si existen.
        """
        columnas_orden = {
            "id": "id",
            "pregunta": "pregunta",
            "categoria": "categoria",
            "activo": "activo",
            "created_at": "created_at",
            "updated_at": "updated_at"
        }
        
        items = await self.faq_repo.list(pagination, columnas_orden, "id DESC")
        total = await self.faq_repo.count(pagination.search)
        
        return {
            "total": total,
            "items": items,
            "limit": pagination.limit,
            "offset": pagination.offset
        }

    async def crear_faq(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Crea una nueva pregunta frecuente y la devuelve con su ID generado.
        """
        faq_id = await self.faq_repo.create(data, returning="id")
        return await self.obtener_faq(faq_id)

    async def actualizar_faq(self, faq_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Actualiza una FAQ por su ID y devuelve el objeto resultante.
        """
        await self.obtener_faq(faq_id)  # Lanza 404 si no existe
        await self.faq_repo.update(faq_id, "id", data)
        return await self.obtener_faq(faq_id)

    async def eliminar_faq(self, faq_id: int) -> None:
        """
        Elimina físicamente una FAQ.
        """
        await self.obtener_faq(faq_id)  # Lanza 404 si no existe
        await self.faq_repo.delete(faq_id, "id")
