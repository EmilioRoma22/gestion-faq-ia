from pydantic import BaseModel, Field
from typing import Optional

class PaginationParams(BaseModel):
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    order_by: Optional[str] = None
    order_dir: str = Field(default="ASC")
    search: Optional[str] = None
