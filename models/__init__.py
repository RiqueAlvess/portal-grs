from database.Base import Base
from models.UsuariosSchema import Usuario 
from models.EmpresasSchema import Empresa
from models.FuncionariosSchema import Funcionario
from models.AtestadosSchema import Atestado
from models.ExamesSchema import Exame

from sqlalchemy import event
from sqlalchemy.orm import configure_mappers

@event.listens_for(Base.metadata, 'before_create')
def receive_before_create(target, connection, **kw):
    configure_mappers()

__all__ = ["Base", "Usuario", "Empresa", "Funcionario", "Atestado", "Exame"]