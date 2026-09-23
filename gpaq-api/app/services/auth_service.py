import os
import datetime
from typing import Dict, Any, Optional
import jwt
import bcrypt
from app.repositories.auth_repository import AuthRepository
from app.core.excepciones import AppException

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-gpaq-faq-key-1234567890-xyz")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

class AuthService:
    def __init__(self, auth_repo: AuthRepository):
        self.auth_repo = auth_repo

    def hash_password(self, password: str) -> str:
        """
        Hashea una contraseña utilizando bcrypt.
        """
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def verificar_password(self, password_plana: str, password_hash: str) -> bool:
        """
        Compara una contraseña en texto plano con un hash de bcrypt.
        """
        try:
            return bcrypt.checkpw(password_plana.encode('utf-8'), password_hash.encode('utf-8'))
        except Exception:
            return False

    async def login(self, email: str, password_plana: str) -> str:
        """
        Verifica las credenciales y genera un token JWT si son válidas.
        """
        user = await self.auth_repo.obtener_por_email(email)
        if not user:
            raise AppException(
                status_code=401,
                code="invalid_credentials",
                message="El correo electrónico o la contraseña son incorrectos."
            )
        
        if not user.get("activo"):
            raise AppException(
                status_code=403,
                code="inactive_user",
                message="Esta cuenta de administrador está desactivada."
            )

        if not self.verificar_password(password_plana, user["password_hash"]):
            raise AppException(
                status_code=401,
                code="invalid_credentials",
                message="El correo electrónico o la contraseña son incorrectos."
            )

        # Crear token JWT usando datetime con timezone-aware UTC
        ahora = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": str(user["id"]),
            "email": user["email"],
            "exp": ahora + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token

    def verificar_token(self, token: str) -> Dict[str, Any]:
        """
        Decodifica y valida un token JWT.
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise AppException(
                status_code=401,
                code="token_expired",
                message="La sesión ha expirado. Por favor, inicia sesión de nuevo."
            )
        except jwt.PyJWTError:
            raise AppException(
                status_code=401,
                code="invalid_token",
                message="Sesión inválida. Por favor, inicia sesión de nuevo."
            )
