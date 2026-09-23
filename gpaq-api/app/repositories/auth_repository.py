from app.repositories.base_repository import BaseRepository
from typing import Dict, Any, Optional

class AuthRepository(BaseRepository):
    table_name = "usuarios"
    allowed_create_fields = {"nombre", "email", "password_hash", "activo"}
    allowed_update_fields = {"nombre", "email", "password_hash", "activo"}

    async def obtener_por_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Busca un usuario administrador por su email.
        """
        query = f"SELECT * FROM {self.table_name} WHERE email = %s LIMIT 1"
        return await self.fetch_one(query, (email,))
