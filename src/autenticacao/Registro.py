from fastapi import APIRouter, HTTPException, status, Depends, Response
from pydantic import BaseModel, EmailStr, constr, Field
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from datetime import datetime
import uuid
import logging
from typing import Annotated, Dict, Any, Optional

from models.UsuariosSchema import Usuario
from database.Dependencias import get_db

router = APIRouter(prefix="/api")

logger = logging.getLogger("registro_logger")

class UsuarioCreate(BaseModel):
    nome: Annotated[str, constr(min_length=2, max_length=100)]
    email: EmailStr
    senha: Annotated[str, constr(min_length=6, max_length=100)]
    type_user: str = Field(default="user", description="Tipo de usuário")
    active: bool = Field(default=True, description="Status ativo/inativo")
    
    class Config:
        schema_extra = {
            "example": {
                "nome": "Nome Completo",
                "email": "usuario@exemplo.com",
                "senha": "senhaSegura123",
                "type_user": "user",
                "active": True
            }
        }

class UsuarioResponse(BaseModel):
    id: str
    nome: str
    email: str
    type_user: str
    active: bool
    dt_criacao: datetime
    
    class Config:
        orm_mode = True

def get_user_by_email(db: Session, email: str) -> Optional[Usuario]:
    return db.query(Usuario).filter(Usuario.email == email).first()

def create_user(db: Session, user_data: UsuarioCreate) -> Usuario:
    usuario = Usuario(
        id=uuid.uuid4(),
        nome=user_data.nome,
        email=user_data.email,
        senha=bcrypt.hash(user_data.senha),
        type_user=user_data.type_user,
        active=user_data.active,
        dt_criacao=datetime.utcnow()
    )
    
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario

@router.post("/register", 
             status_code=status.HTTP_201_CREATED, 
             response_model=Dict[str, Any],
             summary="Registra um novo usuário",
             description="Cria um novo usuário no sistema com as informações fornecidas")
async def register_user(
    user: UsuarioCreate, 
    response: Response,
    db: Session = Depends(get_db)
):
    try:
        existing_user = get_user_by_email(db, user.email)
        
        if existing_user:
            logger.warning(f"Tentativa de registro com e-mail já cadastrado: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail já cadastrado."
            )
        
        novo_usuario = create_user(db, user)
        logger.info(f"Novo usuário registrado: {user.email}")
        
        return {
            "status": "success",
            "msg": "Usuário registrado com sucesso!",
            "id": str(novo_usuario.id)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao registrar usuário: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao processar o registro."
        )