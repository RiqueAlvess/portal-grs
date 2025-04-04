from fastapi import Request, HTTPException, status
from sqlalchemy.orm import Session
import logging
from typing import Optional, List, Any

from models.UsuariosSchema import Usuario
from models.EmpresasSchema import Empresa

logger = logging.getLogger("acesso_empresas")

def verificar_acesso_empresa(
    usuario: Usuario, 
    empresa_id: str, 
    db: Session,
    throw_exception: bool = True
) -> bool:
    """
    Verifica se um usuário tem acesso a uma empresa específica.
    
    Args:
        usuario: Objeto do usuário
        empresa_id: ID da empresa em formato string
        db: Sessão do banco de dados
        throw_exception: Se True, lança uma exceção se o acesso for negado
    
    Returns:
        bool: True se tem acesso, False caso contrário
    """
    # Admins e superadmins têm acesso a todas as empresas
    if usuario.type_user in ["admin", "superadmin"]:
        return True
    
    # Para outros usuários, verificar se a empresa está na lista de empresas do usuário
    user_company_ids = [str(empresa.id) for empresa in usuario.empresas]
    
    if empresa_id in user_company_ids:
        return True
    
    # Se chegou aqui, não tem acesso
    if throw_exception:
        logger.warning(f"Usuário {usuario.email} tentou acessar empresa {empresa_id} sem permissão")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem acesso a esta empresa"
        )
    
    return False

def obter_empresa_ativa(request: Request, db: Session, usuario: Usuario) -> Optional[Empresa]:
    """
    Obtém a empresa ativa do cookie e verifica permissões.
    
    Args:
        request: Objeto de requisição
        db: Sessão do banco de dados
        usuario: Objeto do usuário
    
    Returns:
        Empresa ou None se não houver empresa selecionada
    """
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
        
        if not empresa:
            return None
        
        # Verificar permissão (não lança exceção, apenas retorna None se não tiver acesso)
        if verificar_acesso_empresa(usuario, str(empresa.id), db, throw_exception=False):
            return empresa
        else:
            return None
    except Exception as e:
        logger.error(f"Erro ao buscar empresa ativa: {str(e)}")
        return None

def filtrar_empresas_usuario(usuario: Usuario, empresas: List[Empresa]) -> List[Empresa]:
    """
    Filtra uma lista de empresas com base nas permissões do usuário.
    
    Args:
        usuario: Objeto do usuário
        empresas: Lista de empresas a ser filtrada
    
    Returns:
        Lista filtrada de empresas
    """
    # Admins e superadmins podem ver todas as empresas
    if usuario.type_user in ["admin", "superadmin"]:
        return empresas
    
    # Para outros usuários, filtrar apenas empresas a que têm acesso
    user_company_ids = [str(empresa.id) for empresa in usuario.empresas]
    return [empresa for empresa in empresas if str(empresa.id) in user_company_ids]

def filtrar_dados_por_empresa(usuario: Usuario, empresa_id: str, dados: List[Any], campo_empresa: str = "codigo_empresa") -> List[Any]:
    """
    Filtra uma lista de dados com base na empresa e nas permissões do usuário.
    
    Args:
        usuario: Objeto do usuário
        empresa_id: ID da empresa selecionada
        dados: Lista de dados a ser filtrada
        campo_empresa: Nome do campo que contém o código da empresa nos dados
    
    Returns:
        Lista filtrada de dados
    """
    # Se não há empresa selecionada, retorna lista vazia
    if not empresa_id:
        return []
    
    # Admins e superadmins podem ver todos os dados da empresa selecionada
    if usuario.type_user in ["admin", "superadmin"]:
        return dados
    
    # Para outros usuários, verificar se tem acesso à empresa antes de filtrar
    user_company_ids = [str(empresa.id) for empresa in usuario.empresas]
    
    if empresa_id not in user_company_ids:
        # Não tem acesso a esta empresa
        return []
    
    # Tem acesso, então retorna os dados da empresa selecionada
    return dados