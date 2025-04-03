# Este arquivo importa todos os modelos para garantir que todos sejam carregados
# antes de qualquer mapeamento ORM ser inicializado

from models.UsuariosSchema import Usuario
from models.EmpresasSchema import Empresa
from models.FuncionariosSchema import Funcionario
from models.AtestadosSchema import Atestado
from models.ExamesSchema import Exame

# Use este módulo para importar todos os modelos juntos
# Em vez de import individual, você pode fazer:
# from models.all_models import Usuario, Empresa, etc.