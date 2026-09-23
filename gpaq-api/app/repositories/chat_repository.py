from app.repositories.base_repository import BaseRepository
from typing import Dict, Any, List, Optional
import uuid

class ChatRepository(BaseRepository):
    table_name = "conversaciones"
    allowed_create_fields = {"id"}
    allowed_update_fields = set()

    async def crear_conversacion(self) -> str:
        """
        Crea una nueva conversación asignándole un UUID generado en la aplicación.
        """
        conv_id = str(uuid.uuid4())
        await self.create({"id": conv_id})
        return conv_id

    async def obtener_conversacion(self, conv_id: str) -> Optional[Dict[str, Any]]:
        """
        Busca una conversación por su UUID.
        """
        query = f"SELECT * FROM {self.table_name} WHERE id = %s LIMIT 1"
        return await self.fetch_one(query, (conv_id,))

    async def agregar_mensaje(self, conv_id: str, remitente: str, contenido: str) -> Dict[str, Any]:
        """
        Inserta un nuevo mensaje asociado a una conversación y devuelve el registro insertado.
        """
        query_insert = """
            INSERT INTO mensajes (conversacion_id, remitente, contenido)
            VALUES (%s, %s, %s)
        """
        async with self.db.cursor() as cursor:
            await cursor.execute(query_insert, (conv_id, remitente, contenido))
            msg_id = cursor.lastrowid
            
        query_select = "SELECT * FROM mensajes WHERE id = %s"
        return await self.fetch_one(query_select, (msg_id,))

    async def obtener_mensajes(self, conv_id: str) -> List[Dict[str, Any]]:
        """
        Obtiene el historial completo de mensajes para una conversación ordenado por fecha.
        """
        query = """
            SELECT * FROM mensajes
            WHERE conversacion_id = %s
            ORDER BY created_at ASC
        """
        return await self.fetch_all(query, (conv_id,))
