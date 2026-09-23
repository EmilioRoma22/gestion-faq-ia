from pydantic import BaseModel, Field
from typing import Optional

class BotConfigBase(BaseModel):
    bot_nombre: str = Field(default="FAQ Bot", min_length=2, max_length=100)
    mensaje_bienvenida: str = Field(default="¡Hola!", max_length=255)
    mensaje_fallback: str = Field(default="Lo siento...", max_length=255)
    sector: str = Field(default="General", max_length=100)
    temperatura: float = Field(default=0.2, ge=0.0, le=1.0)
    system_prompt: str = Field(...)

class BotConfigUpdate(BaseModel):
    bot_nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    mensaje_bienvenida: Optional[str] = Field(None, max_length=255)
    mensaje_fallback: Optional[str] = Field(None, max_length=255)
    sector: Optional[str] = Field(None, max_length=100)
    temperatura: Optional[float] = Field(None, ge=0.0, le=1.0)
    system_prompt: Optional[str] = None

class BotConfigResponse(BotConfigBase):
    id: int
