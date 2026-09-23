import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_flujo_chat(client: AsyncClient):
    """
    Prueba el flujo del chat: iniciar sesión, enviar mensaje y obtener historial de mensajes.
    """
    # 1. INICIAR CONVERSACIÓN
    start_response = await client.post("/api/v1/chat/start")
    assert start_response.status_code == 200
    start_data = start_response.json()
    assert "conversacion_id" in start_data
    assert "mensaje_bienvenida" in start_data
    conv_id = start_data["conversacion_id"]
    
    # 2. ENVIAR MENSAJE
    # Preguntamos por los horarios de atención (que es una FAQ cargada en la base de datos)
    message_response = await client.post(
        f"/api/v1/chat/{conv_id}/message",
        json={"contenido": "¿Cuáles son sus horarios de atención?"}
    )
    assert message_response.status_code == 200
    msg_data = message_response.json()
    assert msg_data["conversacion_id"] == conv_id
    assert msg_data["remitente"] == "assistant"
    # La respuesta simulada/real debe contener información de los días lunes a viernes
    assert "lunes a viernes" in msg_data["contenido"].lower()
    
    # 3. VERIFICAR HISTORIAL
    history_response = await client.get(f"/api/v1/chat/{conv_id}/history")
    assert history_response.status_code == 200
    history_data = history_response.json()
    # Historial debe contener el mensaje del usuario y la respuesta de la IA
    assert len(history_data) == 2
    assert history_data[0]["remitente"] == "user"
    assert history_data[1]["remitente"] == "assistant"
