from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import cast, String
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID, uuid4
from datetime import datetime

from database.Dependencias import get_db
from models.UsuariosSchema import Usuario
from models.EmpresasSchema import Empresa
from src.autenticacao.Login import get_current_user

router = APIRouter(prefix="/api/admin")

class UserBase(BaseModel):
    nome: str
    email: EmailStr
    type_user: str = "user"
    active: bool = True

class UserCreate(UserBase):
    senha: str

class UserUpdate(UserBase):
    senha: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    dt_criacao: datetime
    dt_last_acess: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    
    class Config:
        orm_mode = True

class CompanyBase(BaseModel):
    id: UUID
    codigo: int
    nome_abreviado: str
    razao_social: str
    
    class Config:
        orm_mode = True

class CompanyListResponse(BaseModel):
    items: List[CompanyBase]
    total: int
    
    class Config:
        orm_mode = True

class UserCompanyAssignment(BaseModel):
    company_ids: List[UUID]

# User management endpoints
@router.get("/users", response_model=UserListResponse)
async def get_users(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    query = db.query(Usuario)
    
    if search:
        query = query.filter(
            (Usuario.nome.ilike(f"%{search}%")) | 
            (Usuario.email.ilike(f"%{search}%"))
        )
    
    total = query.count()
    users = query.offset(skip).limit(limit).all()
    
    return {
        "items": users,
        "total": total
    }

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID, 
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    
    return user

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate, 
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    # Only superadmin can create admin users
    if user_data.type_user == "admin" and current_user.type_user != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas superadmins podem criar usuários admin")
    
    # Check if email already exists
    existing_user = db.query(Usuario).filter(Usuario.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email já cadastrado")
    
    # Hash the password (using passlib.hash.bcrypt)
    from passlib.hash import bcrypt
    hashed_password = bcrypt.hash(user_data.senha)
    
    try:
        new_user = Usuario(
            id=uuid4(),
            nome=user_data.nome,
            email=user_data.email,
            senha=hashed_password,
            type_user=user_data.type_user,
            active=user_data.active,
            dt_criacao=datetime.utcnow(),
            user_updt=current_user.id
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao criar usuário")

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID, 
    user_data: UserUpdate, 
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    
    # Only superadmin can modify admin users or change user type
    if (user.type_user == "admin" or user_data.type_user == "admin") and current_user.type_user != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente")
    
    # Check if email already exists (if changing email)
    if user_data.email != user.email:
        existing_user = db.query(Usuario).filter(Usuario.email == user_data.email).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email já cadastrado")
    
    # Update fields
    user.nome = user_data.nome
    user.email = user_data.email
    user.type_user = user_data.type_user
    user.active = user_data.active
    user.dt_last_updt = datetime.utcnow()
    user.user_updt = current_user.id
    
    # Update password if provided
    if user_data.senha:
        from passlib.hash import bcrypt
        user.senha = bcrypt.hash(user_data.senha)
    
    try:
        db.commit()
        db.refresh(user)
        return user
    
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao atualizar usuário")

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID, 
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    
    # Prevent deleting yourself
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não é possível excluir seu próprio usuário")
    
    # Only superadmin can delete admin users
    if user.type_user == "admin" and current_user.type_user != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas superadmins podem excluir usuários admin")
    
    try:
        # Check if user has companies associated
        if user.empresas:
            # Remove all company associations
            for empresa in user.empresas:
                empresa.usuario_id = None
        
        db.delete(user)
        db.commit()
        return None
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Erro ao excluir usuário: {str(e)}")

# Company management endpoints
@router.get("/companies", response_model=CompanyListResponse)
async def get_companies(
    skip: int = 0, 
    limit: int = 1000, 
    search: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of companies.
    
    - Set limit=1000 to get a larger list of companies at once
    - Use search parameter to filter by name or code
    """
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    query = db.query(Empresa)
    
    if search:
        query = query.filter(
            (Empresa.nome_abreviado.ilike(f"%{search}%")) | 
            (Empresa.razao_social.ilike(f"%{search}%")) |
            (cast(Empresa.codigo, String).ilike(f"%{search}%"))
        )
    
    # Count total before applying pagination
    total = query.count()
    
    # Apply pagination - use a higher limit if requested
    limit = min(limit, 1000)  
    companies = query.offset(skip).limit(limit).all()
    
    return {
        "items": companies,
        "total": total
    }

@router.get("/users/{user_id}/companies", response_model=List[CompanyBase])
async def get_user_companies(
    user_id: UUID, 
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    
    return user.empresas

@router.post("/users/{user_id}/companies")
async def assign_companies(
    user_id: UUID,
    assignment: UserCompanyAssignment,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.type_user not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    
    try:
        # First, remove all existing company associations
        companies = db.query(Empresa).filter(Empresa.usuario_id == user_id).all()
        for company in companies:
            company.usuario_id = None
        
        # Then, add new company associations
        for company_id in assignment.company_ids:
            company = db.query(Empresa).filter(Empresa.id == company_id).first()
            if company:
                company.usuario_id = user_id
        
        db.commit()
        return {"message": "Empresas atribuídas com sucesso"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Erro ao atribuir empresas: {str(e)}")