"""
Repositorio base abstracto para todos los repositorios de la app.

Centraliza:
- Conversión de filas tupla → dict (por nombre de columna).
- Validación de identificadores SQL (anti SQLi en nombres de tabla/columna).
- CRUD genérico (`create`, `update`, `delete`, `soft_delete`).
- Listado/conteo con paginación y búsqueda.

## Por qué un base repo en lugar de un ORM
Mantenemos SQL crudo (vía `asyncmy`) por simplicidad de auditoría y control
fino sobre transacciones, locks (`FOR UPDATE`) y queries específicas. El
base repo solo elimina la repetición común; no oculta SQL.

## Cómo crear un repositorio nuevo
```python
class MiRepo(BaseRepository):
    table_name = "mi_tabla"
    searchable_fields = ["nombre", "descripcion"]
    allowed_create_fields = ["id", "nombre", "descripcion"]
    allowed_update_fields = ["nombre", "descripcion"]
```

Las listas blancas `allowed_*_fields` son obligatorias para `create`/`update`:
sin ellas el repo lanza `ValueError` (defensa en profundidad ante mass
assignment).
""" 

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple, TypeVar

import asyncmy

from app.models.pagination_model import PaginationParams

logger = logging.getLogger(__name__)

#: TypeVar para filas devueltas por el driver (típicamente tuplas).
RowT = TypeVar("RowT", bound=Sequence[Any])


class BaseRepository:
    """
    Repositorio base (async) para operaciones CRUD comunes usando `asyncmy`.

    ## Contexto (por qué existe)
    `asyncmy` devuelve, por defecto, resultados como **tuplas** (no dicts). Para
    poder trabajar con resultados "tipo diccionario" (por nombre de columna),
    este repositorio expone utilidades que convierten filas a `dict` usando
    `cursor.description`.

    ## Uso esperado
    Instancia este repositorio (o una subclase) con una conexión obtenida desde
    la dependencia `obtener_conexion_bd()` (`app/dependencies/database.py`).

    - La conexión se maneja por request (commit/rollback en la dependencia).
    - Este repositorio solo ejecuta SQL y lee resultados.

    ## Seguridad (identificadores SQL)
    Los parámetros (`%s`) protegen valores, pero **no** protegen identificadores
    SQL (nombres de tabla/columna). Por eso:

    - `table_name` debe ser seguro y validable.
    - `allowed_create_fields` / `allowed_update_fields` deben definirse en
      subclases para evitar escrituras arbitrarias por nombre de campo.

    Subclases típicas deberían definir:
    - `table_name`
    - `searchable_fields`
    - `allowed_create_fields`
    - `allowed_update_fields`
    """

    #: Nombre de la tabla (sin comillas). Debe ser un identificador seguro.
    table_name: str = ""

    #: Campos (columnas) donde se permite búsqueda por `LIKE`.
    searchable_fields: List[str] = []

    #: Lista blanca de columnas permitidas en `create()`.
    allowed_create_fields: Set[str] | None = None

    #: Lista blanca de columnas permitidas en `update()`.
    allowed_update_fields: Set[str] | None = None

    #: Regex conservadora para identificadores MySQL (sin backticks).
    _SAFE_IDENTIFIER = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,63}$")

    def __init__(self, db: asyncmy.Connection):
        """
        Crea el repositorio sobre una conexión `asyncmy`.

        Args:
            db: Conexión `asyncmy.Connection` (típicamente del pool por request).
        """
        self.db = db
        if self.table_name:
            self._validar_identificador_sql(self.table_name, "table_name")

    @classmethod
    def _validar_identificador_sql(cls, nombre: str, contexto: str) -> None:
        """
        Valida que un identificador SQL (tabla/columna) sea seguro.

        Esto evita SQLi al interpolar nombres de tabla/columna (que no pueden
        parametrizarse con `%s`).
        """
        if not cls._SAFE_IDENTIFIER.match(nombre):
            raise ValueError(f"Identificador SQL inválido en {contexto}: {nombre!r}")

    def _validar_campos_escritura(self, data: Dict[str, Any], *, modo: str) -> None:
        """
        Valida que los campos a escribir estén permitidos para el repositorio.

        Requiere que la subclase defina `allowed_create_fields` /
        `allowed_update_fields` según el `modo`.
        """
        permitidos = (
            self.allowed_create_fields
            if modo == "create"
            else self.allowed_update_fields
        )
        if permitidos is None:
            raise ValueError(
                f"Repo {self.__class__.__name__} debe definir allowed_{modo}_fields para escrituras seguras."
            )
        if len(permitidos) == 0:
            raise ValueError(
                f"Repo {self.__class__.__name__} no permite escrituras (allowed_{modo}_fields vacío)."
            )
        desconocidos = [k for k in data.keys() if k not in permitidos]
        if desconocidos:
            raise ValueError(
                f"Campos no permitidos para {modo} en {self.__class__.__name__}: {', '.join(desconocidos)}"
            )

    @staticmethod
    def _column_names_from_description(
        description: Sequence[Sequence[Any]] | None,
    ) -> List[str]:
        """
        Extrae nombres de columna desde `cursor.description`.

        En DB-API (y `asyncmy`), `cursor.description` es una secuencia de
        secuencias/tuplas donde la posición 0 es el nombre de la columna.
        """
        if not description:
            return []
        return [str(col[0]) for col in description]

    @classmethod
    def rows_to_dicts(
        cls,
        *,
        description: Sequence[Sequence[Any]] | None,
        rows: Iterable[RowT],
    ) -> List[Dict[str, Any]]:
        """
        Convierte filas tipo tupla a una lista de diccionarios por nombre de columna.

        Args:
            description: `cursor.description` después de ejecutar un SELECT.
            rows: Iterable de filas (tuplas/secuencias) devueltas por `fetchall()`.

        Returns:
            Lista de `dict` donde cada key es el nombre de columna.

        Notas:
            - Si una fila tiene menos valores que columnas, se omite el resto.
            - Si una fila tiene más valores que columnas (raro), se ignoran extras.
        """
        columns = cls._column_names_from_description(description)
        if not columns:
            return []
        return [dict(zip(columns, row)) for row in rows]

    @classmethod
    def row_to_dict(
        cls,
        *,
        description: Sequence[Sequence[Any]] | None,
        row: RowT | None,
    ) -> Dict[str, Any] | None:
        """
        Convierte una sola fila tipo tupla a dict por nombre de columna.
        """
        if row is None:
            return None
        columns = cls._column_names_from_description(description)
        if not columns:
            return None
        return dict(zip(columns, row))

    async def execute(self, query: str, params: tuple = ()) -> None:
        """
        Ejecuta un SQL que no requiere leer resultados.

        Útil para `INSERT/UPDATE/DELETE` cuando no se necesita `fetch*()`.

        Notas:
            No hace commit: la dependencia `obtener_conexion_bd` se encarga
            al final del request.
        """
        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, params)
        except Exception as e:
            logger.error(
                "Error en execute: %s | Table: %s | ParamCount: %s",
                type(e).__name__,
                self.table_name,
                (len(params) if params else 0),
            )
            raise

    async def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """
        Ejecuta un SELECT y devuelve una lista de dicts (por nombre de columna).
        """
        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, params)
                rows = await cursor.fetchall()
                return self.rows_to_dicts(description=cursor.description, rows=rows)
        except Exception as e:
            logger.error(
                "Error en fetch_all: %s | Table: %s | ParamCount: %s",
                type(e).__name__,
                self.table_name,
                (len(params) if params else 0),
            )
            raise

    async def fetch_one(self, query: str, params: tuple = ()) -> Dict[str, Any] | None:
        """
        Ejecuta un SELECT y devuelve un dict (una fila) o `None`.
        """
        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, params)
                row = await cursor.fetchone()
                return self.row_to_dict(description=cursor.description, row=row)
        except Exception as e:
            logger.error(
                "Error en fetch_one: %s | Table: %s | ParamCount: %s",
                type(e).__name__,
                self.table_name,
                (len(params) if params else 0),
            )
            raise

    async def create(
        self, data: Dict[str, Any], returning: Optional[str] = None
    ) -> Any:
        """
        Inserta una fila en `table_name`.

        Args:
            data: Dict de columna -> valor (solo columnas permitidas).
            returning: Si es truthy, devuelve `cursor.lastrowid` (útil con
                AUTO_INCREMENT). En tablas con PK CHAR(36) (UUID generado
                en app) no aporta valor, dejar en `None`.

        Returns:
            `lastrowid` si `returning` es truthy; en caso contrario `None`.

        Raises:
            ValueError: si alguna columna de `data` no está en
                `allowed_create_fields`.
        """
        self._validar_campos_escritura(data, modo="create")
        for col in data.keys():
            self._validar_identificador_sql(col, "create.column")

        columns = ", ".join(data.keys())
        placeholders = ", ".join(["%s"] * len(data))
        values = tuple(data.values())

        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"

        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, values)
                return cursor.lastrowid if returning else None
        except Exception as e:
            logger.error(
                "Error en create: %s | Table: %s",
                type(e).__name__,
                self.table_name,
            )
            raise

    async def update(self, id_value: Any, id_column: str, data: Dict[str, Any]) -> int:
        """
        Actualiza una fila por su identificador.

        Args:
            id_value: Valor del identificador.
            id_column: Nombre de la columna identificadora (ej. `"id"`).
            data: Dict de columna -> valor (solo columnas permitidas).

        Returns:
            Número de filas afectadas (`0` si `data` está vacío o si no hay
            registro con ese `id_value`).

        Raises:
            ValueError: si alguna columna de `data` no está en
                `allowed_update_fields`, o si `id_column` no es un
                identificador SQL válido.
        """
        if not data:
            return 0

        self._validar_identificador_sql(id_column, "update.id_column")
        self._validar_campos_escritura(data, modo="update")
        for col in data.keys():
            self._validar_identificador_sql(col, "update.column")

        set_clause = ", ".join([f"{k} = %s" for k in data.keys()])
        values = tuple(data.values()) + (id_value,)
        query = f"UPDATE {self.table_name} SET {set_clause} WHERE {id_column} = %s"

        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, values)
                return cursor.rowcount
        except Exception as e:
            logger.error(
                "Error en update: %s | Table: %s",
                type(e).__name__,
                self.table_name,
            )
            raise

    async def soft_delete(
        self, id_value: Any, id_column: str = "id", active_field: str = "activo"
    ) -> int:
        """
        Borrado lógico (marca `active_field = 0`) por id.

        Returns:
            Número de filas afectadas.
        """
        self._validar_identificador_sql(id_column, "soft_delete.id_column")
        self._validar_identificador_sql(active_field, "soft_delete.active_field")
        query = (
            f"UPDATE {self.table_name} SET {active_field} = 0 WHERE {id_column} = %s"
        )
        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, (id_value,))
                return cursor.rowcount
        except Exception as e:
            logger.error(
                "Error en soft_delete: %s | Table: %s",
                type(e).__name__,
                self.table_name,
            )
            raise

    async def delete(self, id_value: Any, id_column: str = "id") -> int:
        """
        Borrado físico por id.

        Returns:
            Número de filas afectadas.
        """
        self._validar_identificador_sql(id_column, "delete.id_column")
        query = f"DELETE FROM {self.table_name} WHERE {id_column} = %s"
        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(query, (id_value,))
                return cursor.rowcount
        except Exception as e:
            logger.error(
                "Error en delete: %s | Table: %s",
                type(e).__name__,
                self.table_name,
            )
            raise

    def _build_search_clause(self, search: Optional[str]) -> Tuple[str, List[Any]]:
        """
        Construye un fragmento SQL `AND (...)` para búsqueda por `LIKE`.

        Returns:
            (clause_sql, params) donde `clause_sql` puede ser `""` si no aplica.
        """
        if not search or not self.searchable_fields:
            return "", []

        conditions = [f"{field} LIKE %s" for field in self.searchable_fields]
        params = [f"%{search}%" for _ in self.searchable_fields]

        clause = " OR ".join(conditions)
        return f" AND ({clause})", params

    async def paginate(
        self,
        base_query: str,
        params: tuple,
        pagination: PaginationParams,
        columnas_permitidas: Dict[str, str],
        default_order: str,
    ) -> List[Dict[str, Any]]:
        """
        Ejecuta una consulta paginada con ORDER BY validado.

        Args:
            base_query: Query sin ORDER/LIMIT/OFFSET.
            params: Parámetros para `base_query`.
            pagination: Parámetros de paginación (limit/offset/order_by/order_dir/search).
            columnas_permitidas: Mapa alias->columna real para ordenar (anti SQLi).
            default_order: ORDER BY por defecto (ej. `"created_at DESC"`).

        Returns:
            Lista de filas como `dict`.
        """
        order_dir = "DESC" if pagination.order_dir.upper() == "DESC" else "ASC"

        if (
            pagination.order_by is None
            or pagination.order_by not in columnas_permitidas
        ):
            order_clause = default_order
        else:
            order_column = columnas_permitidas[pagination.order_by]
            order_clause = f"{order_column} {order_dir}"

        query = f"""
            {base_query}
            ORDER BY {order_clause}
            LIMIT %s OFFSET %s
        """

        try:
            full_params = params + (pagination.limit, pagination.offset)
            async with self.db.cursor() as cursor:
                await cursor.execute(query, full_params)
                rows = await cursor.fetchall()
                return self.rows_to_dicts(description=cursor.description, rows=rows)
        except Exception as e:
            logger.error(
                "Error en paginate: %s | Table: %s",
                type(e).__name__,
                self.table_name,
            )
            raise

    async def list(
        self,
        pagination: PaginationParams,
        columnas_permitidas: Dict[str, str],
        default_order: str,
    ) -> List[Dict[str, Any]]:
        """
        Lista registros con búsqueda (opcional) y paginación.

        Implementación por defecto: `SELECT * FROM table_name WHERE 1=1`
        más la cláusula de búsqueda construida sobre `searchable_fields`. Si
        necesitás JOINs o WHEREs específicos, usá `paginate` directamente
        construyendo `base_query` a mano.

        Returns:
            Lista de filas como `dict`.
        """
        base_query = f"SELECT * FROM {self.table_name} WHERE 1=1"
        search_clause, search_params = self._build_search_clause(pagination.search)

        return await self.paginate(
            base_query=base_query + search_clause,
            params=tuple(search_params),
            pagination=pagination,
            columnas_permitidas=columnas_permitidas,
            default_order=default_order,
        )

    async def count(self, search: Optional[str]) -> int:
        """
        Cuenta registros (con búsqueda opcional).

        Returns:
            Total de registros. Si la query falla, devuelve `0` y loggea
            el error (a diferencia del resto de métodos que propagan): el
            uso típico es para `total` en respuestas paginadas y un `0`
            es un valor razonable de fallback.
        """
        base = f"SELECT COUNT(*) as total FROM {self.table_name} WHERE 1=1"
        search_clause, params = self._build_search_clause(search)

        try:
            async with self.db.cursor() as cursor:
                await cursor.execute(base + search_clause, tuple(params))
                row = await cursor.fetchone()
                if not row:
                    return 0

                return int(row[0])
        except Exception as e:
            logger.error(
                "Error en count: %s | Table: %s",
                type(e).__name__,
                self.table_name,
            )
            return 0
