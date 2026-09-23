from app.repositories.base_repository import BaseRepository
from typing import List, Dict, Any

class FAQRepository(BaseRepository):
    table_name = "faqs"
    searchable_fields = ["pregunta", "respuesta", "categoria"]
    allowed_create_fields = {"pregunta", "respuesta", "categoria", "activo"}
    allowed_update_fields = {"pregunta", "respuesta", "categoria", "activo"}

    async def buscar_similares(self, texto: str, limite: int = 4) -> List[Dict[str, Any]]:
        """
        Busca FAQs similares a la consulta del usuario.
        Intenta usar FULLTEXT search y si falla o no da resultados, hace un fallback de tipo LIKE.
        """
        texto_limpio = texto.strip()
        if not texto_limpio:
            query = f"SELECT * FROM {self.table_name} WHERE activo = 1 LIMIT %s"
            return await self.fetch_all(query, (limite,))

        try:
            # Búsqueda por FULLTEXT en MySQL (alta relevancia)
            query = f"""
                SELECT *, MATCH(pregunta, respuesta) AGAINST(%s IN NATURAL LANGUAGE MODE) AS relevancia
                FROM {self.table_name}
                WHERE activo = 1
                  AND MATCH(pregunta, respuesta) AGAINST(%s IN NATURAL LANGUAGE MODE) > 0.05
                ORDER BY relevancia DESC
                LIMIT %s
            """
            resultados = await self.fetch_all(query, (texto_limpio, texto_limpio, limite))
            if resultados:
                return resultados
        except Exception:
            # Fallback en caso de que FULLTEXT no esté soportado o falle
            pass

        # Fallback a coincidencia LIKE por palabras claves
        palabras = [p for p in texto_limpio.split() if len(p) > 2]
        if not palabras:
            # Si no hay palabras largas, buscamos coincidencia parcial con el texto completo
            query = f"SELECT * FROM {self.table_name} WHERE activo = 1 AND (pregunta LIKE %s OR respuesta LIKE %s) LIMIT %s"
            return await self.fetch_all(query, (f"%{texto_limpio}%", f"%{texto_limpio}%", limite))

        condiciones = []
        params = []
        for p in palabras[:3]:  # Tomar máximo 3 palabras clave para evitar consultas pesadas
            condiciones.append("(pregunta LIKE %s OR respuesta LIKE %s)")
            params.extend([f"%{p}%", f"%{p}%"])

        sql_condicion = " OR ".join(condiciones)
        query = f"SELECT * FROM {self.table_name} WHERE activo = 1 AND ({sql_condicion}) LIMIT %s"
        params.append(limite)
        return await self.fetch_all(query, tuple(params))
