from app.repositories.base_repository import BaseRepository
from typing import Dict, Any, Optional

class BotRepository(BaseRepository):
    table_name = "configuraciones_bot"
    allowed_create_fields = {
        "bot_nombre", 
        "mensaje_bienvenida", 
        "mensaje_fallback", 
        "sector", 
        "temperatura", 
        "system_prompt"
    }
    allowed_update_fields = {
        "bot_nombre", 
        "mensaje_bienvenida", 
        "mensaje_fallback", 
        "sector", 
        "temperatura", 
        "system_prompt"
    }

    async def obtener_configuracion(self) -> Optional[Dict[str, Any]]:
        """
        Obtiene la primera fila de configuración disponible en la BD.
        """
        query = f"SELECT * FROM {self.table_name} LIMIT 1"
        return await self.fetch_one(query)

    async def guardar_configuracion(self, data: Dict[str, Any]) -> int:
        """
        Actualiza la configuración actual del bot. Si no existe, la crea.
        """
        config = await self.obtener_configuracion()
        if config:
            return await self.update(config["id"], "id", data)
        else:
            await self.create(data)
            return 1
