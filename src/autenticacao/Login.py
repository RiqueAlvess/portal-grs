from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi_login import LoginManager
from fastapi.security import OAuth2PasswordRequestForm
from passlib.hash import bcrypt
from sqlalchemy.orm import sessionmaker, Session
from jose import jwt, JWTError
import os
import logging
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Optional, Dict, Any, Union

from models.UsuariosSchema import Usuario
from database.Engine import engine
from database.Dependencias import get_db

load_dotenv()
SECRET = os.getenv("SECRET_KEY", "sxZyrN1u18flZ9V0YglqjNi9U5oDiYkE")

SECURE_COOKIES = os.getenv("SECURE_COOKIES", "False").lower() == "true"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
COOKIE_PATH = "/"
COOKIE_NAME = "portal_grs_session"

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REMEMBER_TOKEN_EXPIRE_DAYS = int(os.getenv("REMEMBER_TOKEN_EXPIRE_DAYS", "7"))

manager = LoginManager(SECRET, token_url="/api/login", use_cookie=True)
SessionLocal = sessionmaker(bind=engine)

log_dir = "log"
os.makedirs(log_dir, exist_ok=True)
log_path = os.path.join(log_dir, "login.log")

logger = logging.getLogger("login_logger")
logger.setLevel(logging.INFO)
handler = TimedRotatingFileHandler(log_path, when="midnight", interval=1, backupCount=7)
formatter = logging.Formatter("[%(asctime)s] %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

router = APIRouter(prefix="/api")

def get_user_by_email(email: str, db: Session) -> Optional[Usuario]:
    return db.query(Usuario).filter(Usuario.email == email).first()

def create_access_token(data: Dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET, algorithm="HS256")
    return encoded_jwt

def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        return payload
    except JWTError as e:
        logger.error(f"Erro ao decodificar token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado"
        )

def set_auth_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        path=COOKIE_PATH,
        domain=COOKIE_DOMAIN,
        secure=SECURE_COOKIES,
        httponly=True,
        samesite="lax"
    )

def get_user_response_data(user: Usuario) -> Dict[str, Any]:
    return {
        "status": "success",
        "message": "Login bem-sucedido",
        "user": {
            "nome": user.nome,
            "email": user.email,
            "type_user": user.type_user
        }
    }

@router.post("/login")
def login(
    response: Response, 
    data: OAuth2PasswordRequestForm = Depends(), 
    remember: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_email(data.username, db)
        
        if not user:
            logger.warning(f"Tentativa de login com e-mail inexistente: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail não encontrado."
            )

        if not bcrypt.verify(data.password, user.senha):
            logger.warning(f"Senha incorreta para o e-mail: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Senha incorreta."
            )

        expires_delta = (
            timedelta(days=REMEMBER_TOKEN_EXPIRE_DAYS)
            if remember == "true"
            else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        token_data = {
            "sub": user.email,
            "user_id": str(user.id),
            "scope": user.type_user
        }
        
        access_token = create_access_token(token_data, expires_delta)
        max_age = int(expires_delta.total_seconds())
        set_auth_cookie(response, access_token, max_age)

        user.dt_last_acess = datetime.utcnow()
        db.commit()

        logger.info(f"Login bem-sucedido para: {user.email}")
        return get_user_response_data(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro inesperado durante login de {data.username}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro interno no servidor. Tente novamente mais tarde."
        )

@router.get("/verify-auth")
def verify_auth(session: Optional[str] = Cookie(None, alias=COOKIE_NAME)):
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado"
        )
    
    try:
        payload = decode_token(session)
        return {"status": "authenticated", "user_id": payload.get("user_id")}
    except Exception as e:
        logger.warning(f"Falha na verificação de autenticação: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada"
        )

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path=COOKIE_PATH,
        domain=COOKIE_DOMAIN
    )
    
    return {"status": "success", "message": "Logout realizado com sucesso"}

def get_current_user(session: Optional[str] = Cookie(None, alias=COOKIE_NAME), db: Session = Depends(get_db)):
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária"
        )
    
    try:
        payload = decode_token(session)
        user_email = payload.get("sub")
        
        if not user_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
        
        user = get_user_by_email(user_email, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado"
            )
        
        return user
    
    except Exception as e:
        logger.warning(f"Falha na autenticação: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada"
        )

@router.get("/user-profile")
def user_profile(current_user: Usuario = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "nome": current_user.nome,
        "email": current_user.email,
        "type_user": current_user.type_user
    }