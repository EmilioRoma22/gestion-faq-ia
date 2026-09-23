from fastapi import APIRouter, Depends
from app.dependencies.auth_deps import obtener_usuario_actual, obtener_auth_service
from app.models.auth_model import LoginRequest, TokenResponse, UsuarioResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    auth_service: AuthService = Depends(obtener_auth_service)
):
    """
    Inicia sesión de un administrador y devuelve un token Bearer JWT.
    """
    token = await auth_service.login(body.email, body.password)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UsuarioResponse)
async def me(usuario_actual: dict = Depends(obtener_usuario_actual)):
    """
    Devuelve los datos del administrador autenticado actualmente.
    """
    return usuario_actual
