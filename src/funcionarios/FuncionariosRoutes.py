from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Dict, Any, Optional
import logging
import math

from models.FuncionariosSchema import Funcionario
from models.UsuariosSchema import Usuario
from database.Dependencias import get_db
from src.autenticacao.Login import get_current_user
from src.utils.acesso_empresas import obter_empresa_ativa, verificar_acesso_empresa

# Configuração de logging
logger = logging.getLogger("funcionarios")

router = APIRouter(prefix="/api")

@router.get("/funcionarios", response_model=Dict[str, Any])
async def list_funcionarios(
    request: Request,
    page: int = Query(1, ge=1, description="Número da página"),
    limit: int = Query(10, ge=1, le=100, description="Itens por página"),
    search: Optional[str] = None,
    situacao: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista funcionários com paginação simplificada.
    """
    try:
        # Log de diagnóstico
        logger.info(f"Requisição recebida: page={page}, limit={limit}, situacao={situacao}, search={search}")
        
        # Obter empresa ativa
        empresa_ativa = obter_empresa_ativa(request, db, current_user)
        
        if not empresa_ativa:
            logger.warning("Nenhuma empresa selecionada")
            return {
                "items": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0
            }

        # Verificar acesso à empresa
        empresa_id = str(empresa_ativa.id)
        verificar_acesso_empresa(current_user, empresa_id, db)
        
        # Calcular offset baseado na página
        offset = (page - 1) * limit
        
        # Construir a consulta base
        query = db.query(Funcionario).filter(
            Funcionario.codigo_empresa == empresa_ativa.codigo
        )
        
        # Aplicar filtro de situação, se fornecido
        if situacao:
            query = query.filter(Funcionario.situacao.ilike(f"%{situacao}%"))
        
        # Aplicar filtro de busca, se fornecido
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Funcionario.nome.ilike(search_term)) |
                (Funcionario.cpf.ilike(search_term)) |
                (Funcionario.matricula_funcionario.ilike(search_term))
            )
        
        # Contar total de registros
        total = query.count()
        
        # Ordenação e paginação
        query = query.order_by(Funcionario.nome)
        funcionarios = query.offset(offset).limit(limit).all()
        
        # Log dos registros recuperados
        logger.info(f"Recuperados {len(funcionarios)} registros de {total} total")
        
        # Calcular número total de páginas
        total_pages = math.ceil(total / limit) if total > 0 else 0
        
        # Converter os resultados para dicionários
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
        
        # Construir resposta com metadados de paginação
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "empresa_selecionada": {
                "id": str(empresa_ativa.id),
                "codigo": empresa_ativa.codigo,
                "nome_abreviado": empresa_ativa.nome_abreviado
            }
        }
        
    except Exception as e:
        logger.error(f"Erro ao listar funcionários: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar funcionários: {str(e)}"
        )

@router.get("/funcionarios/{funcionario_id}", response_model=Dict[str, Any])
async def get_funcionario(
    funcionario_id: str,
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtém os detalhes de um funcionário específico.
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
        
        # Converter para dicionário
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
            "cbo_cargo": funcionario.cbo_cargo,
            "situacao": funcionario.situacao,
            "sexo": funcionario.sexo,
            "estado_civil": funcionario.estado_civil,
            "tipo_contratacao": funcionario.tipo_contratacao,
            "escolaridade": funcionario.escolaridade,
            "data_nascimento": funcionario.data_nascimento.isoformat() if funcionario.data_nascimento else None,
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
            "tel_comercial": funcionario.tel_comercial,
            "email": funcionario.email,
            "rg": funcionario.rg,
            "orgao_emissor_rg": funcionario.orgao_emissor_rg,
            "uf_rg": funcionario.uf_rg,
            "pis": funcionario.pis,
            "ctps": funcionario.ctps,
            "serie_ctps": funcionario.serie_ctps,
            "nm_mae_funcionario": funcionario.nm_mae_funcionario,
            "naturalidade": funcionario.naturalidade,
            "deficiente": funcionario.deficiente,
            "deficiencia": funcionario.deficiencia,
            "ramal": funcionario.ramal,
            "regime_revezamento": funcionario.regime_revezamento,
            "regime_trabalho": funcionario.regime_trabalho,
            "turno_trabalho": funcionario.turno_trabalho,
            "nome_centro_custo": funcionario.nome_centro_custo
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