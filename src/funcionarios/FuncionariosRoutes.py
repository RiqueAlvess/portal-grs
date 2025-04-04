from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging

from models.FuncionariosSchema import Funcionario
from models.UsuariosSchema import Usuario
from database.Dependencias import get_db
from src.autenticacao.Login import get_current_user
from src.utils.acesso_empresas import obter_empresa_ativa, verificar_acesso_empresa

# Configuração de logging
logger = logging.getLogger("funcionarios")

router = APIRouter(prefix="/api/funcionarios")

@router.get("", response_model=Dict[str, Any])
async def list_funcionarios(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista funcionários com paginação e filtro por empresa selecionada.
    Apenas mostra funcionários da empresa que o usuário tem acesso.
    """
    try:
        # Obter empresa ativa
        empresa_ativa = obter_empresa_ativa(request, db, current_user)
        
        if not empresa_ativa:
            # Se não há empresa selecionada, retornar lista vazia
            return {
                "items": [],
                "total": 0,
                "empresa_selecionada": None
            }

        # Verificar acesso à empresa (só para garantir)
        empresa_id = str(empresa_ativa.id)
        verificar_acesso_empresa(current_user, empresa_id, db)
        
        # Filtrar funcionários pela empresa
        query = db.query(Funcionario).filter(
            Funcionario.codigo_empresa == empresa_ativa.codigo
        )
        
        # Adicionar filtro de busca, se fornecido
        if search:
            search = f"%{search}%"
            query = query.filter(
                (Funcionario.nome.ilike(search)) |
                (Funcionario.cpf.ilike(search)) |
                (Funcionario.matricula_funcionario.ilike(search))
            )
        
        # Contar total antes de aplicar paginação
        total = query.count()
        
        # Aplicar paginação
        funcionarios = query.order_by(Funcionario.nome).offset(skip).limit(limit).all()
        
        # Converter os resultados para JSON, convertendo UUIDs para strings
        items = []
        for funcionario in funcionarios:
            items.append({
                "id": str(funcionario.id),
                "nome": funcionario.nome,
                "codigo": funcionario.codigo,
                "cpf": funcionario.cpf,
                "matricula_funcionario": funcionario.matricula_funcionario,
                "codigo_empresa": funcionario.codigo_empresa,
                "nome_empresa": funcionario.nome_empresa,
                "codigo_unidade": funcionario.codigo_unidade,
                "nome_unidade": funcionario.nome_unidade,
                "codigo_setor": funcionario.codigo_setor,
                "nome_setor": funcionario.nome_setor,
                "codigo_cargo": funcionario.codigo_cargo,
                "nome_cargo": funcionario.nome_cargo,
                "situacao": funcionario.situacao,
                "data_admissao": funcionario.data_admissao.isoformat() if funcionario.data_admissao else None,
                "data_demissao": funcionario.data_demissao.isoformat() if funcionario.data_demissao else None
            })
        
        return {
            "items": items,
            "total": total,
            "empresa_selecionada": {
                "id": str(empresa_ativa.id),
                "codigo": empresa_ativa.codigo,
                "nome_abreviado": empresa_ativa.nome_abreviado
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar funcionários: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar funcionários: {str(e)}"
        )

@router.get("/{funcionario_id}", response_model=Dict[str, Any])
async def get_funcionario(
    funcionario_id: str,
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtém os detalhes de um funcionário específico.
    Verifica se o funcionário pertence à empresa que o usuário tem acesso.
    """
    try:
        # Obter empresa ativa
        empresa_ativa = obter_empresa_ativa(request, db, current_user)
        
        if not empresa_ativa:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhuma empresa selecionada"
            )
        
        # Buscar o funcionário
        funcionario = db.query(Funcionario).filter(Funcionario.id == funcionario_id).first()
        
        if not funcionario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Funcionário não encontrado"
            )
        
        # Verificar se o funcionário pertence à empresa ativa
        if funcionario.codigo_empresa != empresa_ativa.codigo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Este funcionário não pertence à empresa selecionada"
            )
        
        # Converter para dicionário, transformando UUIDs em strings
        result = {
            "id": str(funcionario.id),
            "nome": funcionario.nome,
            "codigo": funcionario.codigo,
            "cpf": funcionario.cpf,
            "matricula_funcionario": funcionario.matricula_funcionario,
            "codigo_empresa": funcionario.codigo_empresa,
            "nome_empresa": funcionario.nome_empresa,
            "codigo_unidade": funcionario.codigo_unidade,
            "nome_unidade": funcionario.nome_unidade,
            "codigo_setor": funcionario.codigo_setor,
            "nome_setor": funcionario.nome_setor,
            "codigo_cargo": funcionario.codigo_cargo,
            "nome_cargo": funcionario.nome_cargo,
            "situacao": funcionario.situacao,
            "data_admissao": funcionario.data_admissao.isoformat() if funcionario.data_admissao else None,
            "data_demissao": funcionario.data_demissao.isoformat() if funcionario.data_demissao else None,
            "endereco": funcionario.endereco,
            "numero_endereco": funcionario.numero_endereco,
            "bairro": funcionario.bairro,
            "cidade": funcionario.cidade,
            "uf": funcionario.uf,
            "cep": funcionario.cep,
            "telefone_residencial": funcionario.telefone_residencial,
            "telefone_celular": funcionario.telefone_celular,
            "email": funcionario.email
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter funcionário: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter funcionário: {str(e)}"
        )