import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.dependencies.database import crear_pool_conexiones, cerrar_pool_conexiones

@pytest.fixture(autouse=True)
async def db_pool():
    """
    Inicializa y cierra el pool de conexiones de base de datos para cada caso de prueba,
    evitando conflictos de event loops en asyncmy.
    """
    await crear_pool_conexiones()
    yield
    await cerrar_pool_conexiones()

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """
    Proporciona un cliente HTTP asíncrono para interactuar con la aplicación.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
