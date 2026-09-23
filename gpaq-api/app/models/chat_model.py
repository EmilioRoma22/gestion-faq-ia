from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ChatInitResponse(BaseModel):
    conversacion_id: str
    mensaje_bienvenida: str

class MessageCreate(BaseModel):
    contenido: str = Field(..., min_length=1, max_length=400)

class MessageResponse(BaseModel):
    id: int
    conversacion_id: str
    remitente: str
    contenido: str
    created_at: datetime
