import pytest
from httpx import AsyncClient

async def _obtener_token(client: AsyncClient) -> str:
    """
    Helper para obtener el token de autenticación.
    """
    login_response = await client.post("/api/v1/auth/login", json={
        "email": "admin@gpaq.com",
        "password": "admin123"
    })
    return login_response.json()["access_token"]

@pytest.mark.asyncio
async def test_crud_faq(client: AsyncClient):
    """
    Verifica el flujo completo de CRUD de FAQs: creación, lectura, actualización y eliminación.
    """
    token = await _obtener_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. CREAR FAQ
    nueva_faq = {
        "pregunta": "¿Cuál es la política de garantía?",
        "respuesta": "Ofrecemos 1 año de garantía en todos nuestros productos electrónicos por defectos de fábrica.",
        "categoria": "Garantías",
        "activo": True
    }
    create_response = await client.post("/api/v1/faqs", json=nueva_faq, headers=headers)
    assert create_response.status_code == 201
    created_data = create_response.json()
    assert created_data["pregunta"] == nueva_faq["pregunta"]
    faq_id = created_data["id"]
    
    # 2. OBTENER DETALLE
    get_response = await client.get(f"/api/v1/faqs/{faq_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["pregunta"] == nueva_faq["pregunta"]
    
    # 3. ACTUALIZAR FAQ
    updated_faq = {
        "pregunta": "¿Cuál es la política de garantía extendida?",
        "respuesta": "La garantía estándar es de 1 año. Puedes extenderla a 3 años por un costo adicional."
    }
    update_response = await client.put(f"/api/v1/faqs/{faq_id}", json=updated_faq, headers=headers)
    assert update_response.status_code == 200
    assert update_response.json()["pregunta"] == updated_faq["pregunta"]
    assert update_response.json()["respuesta"] == updated_faq["respuesta"]
    
    # 4. LISTAR
    list_response = await client.get("/api/v1/faqs", headers=headers)
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["total"] >= 1
    ids = [item["id"] for item in list_data["items"]]
    assert faq_id in ids
    
    # 5. ELIMINAR FAQ
    delete_response = await client.delete(f"/api/v1/faqs/{faq_id}", headers=headers)
    assert delete_response.status_code == 204
    
    # 6. VERIFICAR ELIMINACIÓN
    get_deleted = await client.get(f"/api/v1/faqs/{faq_id}", headers=headers)
    assert get_deleted.status_code == 404
