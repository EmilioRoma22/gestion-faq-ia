from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class FAQBase(BaseModel):
    pregunta: str = Field(..., min_length=5, max_length=255)
    respuesta: str = Field(..., min_length=5)
    categoria: str = Field(default="General", max_length=100)
    activo: bool = True

class FAQCreate(FAQBase):
    pass

class FAQUpdate(BaseModel):
    pregunta: Optional[str] = Field(None, min_length=5, max_length=255)
    respuesta: Optional[str] = Field(None, min_length=5)
    categoria: Optional[str] = Field(None, max_length=100)
    activo: Optional[bool] = None

class FAQResponse(FAQBase):
    id: int
    created_at: datetime
    updated_at: datetime
