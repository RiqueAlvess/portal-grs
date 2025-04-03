import sys
from pathlib import Path
import os

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

print(f"Path do ROOT_DIR: {ROOT_DIR}")
print(f"Diretório atual: {os.getcwd()}")

from database.Engine import engine
from database.Base import Base

# Importe todos os modelos
from models.all_models import Usuario, Empresa, Funcionario, Atestado, Exame

def create_tables():
    print("🔧 Criando tabelas no banco de dados...")
    print(f"Connection URL: {str(engine.url).replace(':senha@', ':***@')}")
    
    # Lista todas as classes de modelo para verificação
    models = [Usuario, Empresa, Funcionario, Atestado, Exame]
    print(f"Modelos carregados: {len(models)}")
    
    for model in models:
        print(f"  - {model.__name__}: {model.__tablename__}")
    
    # Cria todas as tabelas
    Base.metadata.create_all(bind=engine)
    
    # Verifica se as tabelas foram criadas
    print("\nVerificando tabelas criadas:")
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tabelas encontradas no banco: {tables}")
    
    print("✅ Tabelas criadas com sucesso!")

if __name__ == "__main__":
    create_tables()