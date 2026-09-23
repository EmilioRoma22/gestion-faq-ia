import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_exitoso(client: AsyncClient):
    """
    Prueba que el inicio de sesión sea exitoso con credenciales correctas.
    """
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@gpaq.com",
        "password": "admin123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_fallido(client: AsyncClient):
    """
    Prueba que el inicio de sesión falle con contraseña incorrecta.
    """
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@gpaq.com",
        "password": "password_incorrecto"
    })
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "invalid_credentials"

@pytest.mark.asyncio
async def test_obtener_me_sin_token(client: AsyncClient):
    """
    Prueba que el acceso a rutas protegidas sin token devuelva 401.
    """
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_obtener_me_con_token(client: AsyncClient):
    """
    Prueba que se obtenga el perfil correcto al pasar un token JWT válido.
    """
    login_response = await client.post("/api/v1/auth/login", json={
        "email": "admin@gpaq.com",
        "password": "admin123"
    })
    token = login_response.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@gpaq.com"
    assert data["activo"] is True
