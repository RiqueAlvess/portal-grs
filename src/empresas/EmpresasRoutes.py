from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
import uuid

from models.EmpresasSchema import Empresa
from models.UsuariosSchema import Usuario
from database.Dependencias import get_db
from src.autenticacao.Login import get_current_user
from src.utils.acesso_empresas import filtrar_empresas_usuario

# Configuração de logging
logger = logging.getLogger("empresas")

router = APIRouter(prefix="/api/empresas")

@router.get("", response_model=Dict[str, Any])
async def list_empresas(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista empresas com paginação.
    Apenas mostra empresas que o usuário tem acesso.
    """
    try:
        # Iniciar a consulta básica
        query = db.query(Empresa)
        
        # Filtrar por busca, se fornecida
        if search:
            search = f"%{search}%"
            query = query.filter(
                (Empresa.nome_abreviado.ilike(search)) |
                (Empresa.razao_social.ilike(search)) |
                (Empresa.cnpj.ilike(search))
            )
        
        # Aplicar filtro para usuários comuns (somente empresas associadas)
        # Para admin/superadmin, sem filtros adicionais
        if current_user.type_user not in ["admin", "superadmin"]:
            user_company_ids = [c.id for c in current_user.empresas]
            query = query.filter(Empresa.id.in_(user_company_ids))
        
        # Ordenar por nome_abreviado para garantir ordem alfabética
        query = query.order_by(Empresa.nome_abreviado)
        
        # Contar total antes de paginação
        total = query.count()
        
        # Aplicar paginação
        empresas = query.offset(skip).limit(limit).all()
        
        # Converter para dicionários para garantir que UUIDs sejam strings
        items = []
        for empresa in empresas:
            items.append({
                "id": str(empresa.id),
                "codigo": empresa.codigo,
                "nome_abreviado": empresa.nome_abreviado,
                "razao_social": empresa.razao_social,
                "cnpj": empresa.cnpj,
                "endereco": empresa.endereco,
                "numero_endereco": empresa.numero_endereco,
                "bairro": empresa.bairro,
                "cidade": empresa.cidade,
                "uf": empresa.uf,
                "cep": empresa.cep,
                "ativo": empresa.ativo
            })
        
        return {
            "items": items,
            "total": total
        }
        
    except Exception as e:
        logger.error(f"Erro ao listar empresas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar empresas: {str(e)}"
        )

@router.get("/{empresa_id}", response_model=Dict[str, Any])
async def get_empresa(
    empresa_id: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtém os detalhes de uma empresa específica.
    Verifica se o usuário tem acesso a esta empresa.
    """
    try:
        # Buscar a empresa
        empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
        
        if not empresa:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Empresa não encontrada"
            )
        
        # Verificar permissão
        if current_user.type_user not in ["admin", "superadmin"]:
            user_company_ids = [str(c.id) for c in current_user.empresas]
            if str(empresa.id) not in user_company_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Você não tem acesso a esta empresa"
                )
        
        # Converter para dicionário, garantindo UUIDs como strings
        result = {
            "id": str(empresa.id),
            "codigo": empresa.codigo,
            "nome_abreviado": empresa.nome_abreviado,
            "razao_social": empresa.razao_social,
            "razao_social_inicial": empresa.razao_social_inicial,
            "cnpj": empresa.cnpj,
            "endereco": empresa.endereco,
            "numero_endereco": empresa.numero_endereco,
            "complemento_endereco": empresa.complemento_endereco,
            "bairro": empresa.bairro,
            "cidade": empresa.cidade,
            "uf": empresa.uf,
            "cep": empresa.cep,
            "inscricao_estadual": empresa.inscricao_estadual,
            "inscricao_municipal": empresa.inscricao_municipal,
            "ativo": empresa.ativo
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter empresa: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter empresa: {str(e)}"
        )