from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncmy
from app.dependencies.database import obtener_conexion_bd
from app.repositories.auth_repository import AuthRepository
from app.services.auth_service import AuthService
from app.core.excepciones import AppException

security = HTTPBearer(auto_error=False)

async def obtener_auth_service(db: asyncmy.Connection = Depends(obtener_conexion_bd)) -> AuthService:
    """
    Inyecta el servicio de autenticación asociado a la conexión de base de datos activa.
    """
    return AuthService(AuthRepository(db))

async def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: asyncmy.Connection = Depends(obtener_conexion_bd)
) -> dict:
    """
    Dependencia que extrae el token Bearer, lo valida y devuelve la información del usuario actual.
    """
    if not credentials:
        raise AppException(
            status_code=401,
            code="missing_token",
            message="No se proporcionó un token de autenticación. Inicie sesión por favor."
        )
        
    token = credentials.credentials
    auth_service = AuthService(AuthRepository(db))
    payload = auth_service.verificar_token(token)
    
    usuario_id = payload.get("sub")
    if not usuario_id:
        raise AppException(
            status_code=401,
            code="invalid_token",
            message="Sesión inválida o expirada. Por favor, reautentíquese."
        )
        
    auth_repo = AuthRepository(db)
    user = await auth_repo.fetch_one(
        "SELECT id, nombre, email, activo FROM usuarios WHERE id = %s LIMIT 1",
        (usuario_id,)
    )
    
    if not user:
        raise AppException(
            status_code=401,
            code="user_not_found",
            message="El usuario administrador ya no existe."
        )
        
    if not user.get("activo"):
        raise AppException(
            status_code=403,
            code="inactive_user",
            message="Su usuario administrador ha sido desactivado."
        )
        
    return user
