from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid

from models.UsuariosSchema import Usuario
from models.EmpresasSchema import Empresa
from database.Dependencias import get_db
from src.autenticacao.Login import get_current_user

# Configuração de logging
logger = logging.getLogger("user_settings")

router = APIRouter(prefix="/api/user")

# Models para validação dos dados
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class CompanySelection(BaseModel):
    company_id: str

class CompanyResponse(BaseModel):
    id: str
    codigo: int
    nome_abreviado: str
    razao_social: str
    cnpj: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    
    class Config:
        from_attributes = True  # Versão moderna de orm_mode

# Endpoint para alterar senha
@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: PasswordChange,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verificar se a senha atual está correta
    if not bcrypt.verify(password_data.current_password, current_user.senha):
        logger.warning(f"Tentativa de alteração de senha com senha atual incorreta: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta"
        )
    
    # Verificar se a nova senha é diferente da atual
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ser diferente da atual"
        )
    
    try:
        # Hash da nova senha
        hashed_password = bcrypt.hash(password_data.new_password)
        
        # Atualizar senha do usuário
        current_user.senha = hashed_password
        current_user.dt_last_updt = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Senha alterada com sucesso para o usuário: {current_user.email}")
        return {"message": "Senha alterada com sucesso"}
    
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao alterar senha para {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao alterar senha. Tente novamente mais tarde."
        )

# Endpoint para obter empresas do usuário
@router.get("/companies", response_model=List[Dict[str, Any]])
async def get_user_companies(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Se for admin ou superadmin, pode acessar todas as empresas
        if current_user.type_user in ["admin", "superadmin"]:
            companies = db.query(Empresa).filter(Empresa.ativo == True).all()
        else:
            # Para usuários comuns, apenas as empresas associadas
            companies = current_user.empresas
        
        # Converter explicitamente UUIDs para strings para evitar erros de validação
        result = []
        for company in companies:
            result.append({
                "id": str(company.id),
                "codigo": company.codigo,
                "nome_abreviado": company.nome_abreviado,
                "razao_social": company.razao_social,
                "cnpj": company.cnpj,
                "cidade": company.cidade,
                "uf": company.uf
            })
        
        return result
    
    except Exception as e:
        logger.error(f"Erro ao obter empresas para {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao obter empresas. Tente novamente mais tarde."
        )

# Função para obter a empresa ativa do cookie
def get_empresa_ativa(request: Request, db: Session) -> Optional[Empresa]:
    """
    Obtém a empresa ativa a partir do cookie 'selected_company'
    """
    # Utilizando o cookie 'selected_company'
    cookie_name = "selected_company"
    empresa_id = None
    
    # Obter o ID da empresa do cookie
    if cookie_name in request.cookies:
        empresa_id = request.cookies[cookie_name]
    
    if not empresa_id:
        return None
    
    # Buscar a empresa no banco de dados
    try:
        empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
        return empresa
    except Exception as e:
        logger.error(f"Erro ao buscar empresa ativa: {str(e)}")
        return None

# Endpoint para obter a empresa atual selecionada
@router.get("/current-company", response_model=Dict[str, Any])
async def get_current_company(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    empresa = get_empresa_ativa(request, db)
    
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma empresa selecionada"
        )
    
    # Verificar se o usuário tem acesso à empresa (exceto para admin/superadmin)
    if current_user.type_user not in ["admin", "superadmin"]:
        user_company_ids = [str(c.id) for c in current_user.empresas]
        if str(empresa.id) not in user_company_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem acesso a esta empresa"
            )
    
    # Converter explicitamente UUID para string
    return {
        "id": str(empresa.id),
        "codigo": empresa.codigo,
        "nome_abreviado": empresa.nome_abreviado,
        "razao_social": empresa.razao_social,
        "cnpj": empresa.cnpj,
        "cidade": empresa.cidade,
        "uf": empresa.uf
    }

# Endpoint para selecionar uma empresa
@router.post("/select-company", status_code=status.HTTP_200_OK)
async def select_company(
    company_data: CompanySelection,
    response: Response,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Verificar se a empresa existe
        empresa = db.query(Empresa).filter(Empresa.id == company_data.company_id).first()
        
        if not empresa:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Empresa não encontrada"
            )
        
        # Verificar se o usuário tem acesso a esta empresa
        if current_user.type_user not in ["admin", "superadmin"]:
            user_company_ids = [str(c.id) for c in current_user.empresas]
            if str(empresa.id) not in user_company_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Você não tem acesso a esta empresa"
                )
        
        # Armazenar a seleção em um cookie
        response.set_cookie(
            key="selected_company",
            value=str(empresa.id),
            max_age=30 * 24 * 60 * 60,  # 30 dias
            path="/",
            httponly=True,
            samesite="lax"
        )
        
        return {
            "message": "Empresa selecionada com sucesso",
            "empresa": {
                "id": str(empresa.id),
                "codigo": empresa.codigo,
                "nome_abreviado": empresa.nome_abreviado,
                "razao_social": empresa.razao_social
            }
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Erro ao selecionar empresa para {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao selecionar empresa. Tente novamente mais tarde."
        )

# Endpoint para remover a seleção de empresa
@router.delete("/select-company", status_code=status.HTTP_200_OK)
async def remove_company_selection(
    response: Response,
    current_user: Usuario = Depends(get_current_user)
):
    # Remover o cookie
    response.delete_cookie(
        key="selected_company",
        path="/"
    )
    
    return {"message": "Seleção de empresa removida com sucesso"}