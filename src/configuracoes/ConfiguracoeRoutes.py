from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
import uuid

from models.UsuariosSchema import Usuario
from models.EmpresasSchema import Empresa
from database.Dependencias import get_db
from src.autenticacao.Login import get_current_user

# Configurar o logger
logger = logging.getLogger("configuracoes")

router = APIRouter(prefix="/api/configuracoes")

# Modelo para validação de dados
class EmpresaSelection(BaseModel):
    empresa_id: str

# Função utilitária para obter a empresa ativa do cookie
def get_empresa_ativa(request: Request, db: Session) -> Optional[Empresa]:
    """
    Obtém a empresa ativa a partir do cookie 'selected_company'
    """
    # Utilizando o cookie 'selected_company' em vez de session
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

# Endpoint para obter a empresa ativa
@router.get("/empresa-ativa")
async def obter_empresa_ativa(
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
@router.post("/selecionar-empresa")
async def selecionar_empresa(
    selection: EmpresaSelection,
    response: Response,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verificar se a empresa existe
    empresa = db.query(Empresa).filter(Empresa.id == selection.empresa_id).first()
    
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa não encontrada"
        )
    
    # Verificar se o usuário tem acesso à empresa (exceto para admin/superadmin)
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

# Endpoint para limpar a seleção de empresa
@router.delete("/selecionar-empresa")
async def limpar_selecao_empresa(
    response: Response,
    current_user: Usuario = Depends(get_current_user)
):
    # Remover o cookie
    response.delete_cookie(
        key="selected_company",
        path="/"
    )
    
    return {"message": "Seleção de empresa removida com sucesso"}