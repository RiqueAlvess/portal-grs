import sys
from pathlib import Path

# Configurar o caminho correto para importação
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv

# Agora com o caminho adicionado, podemos importar corretamente
from models.UsuariosSchema import Usuario
from autenticacao.Login import router as login_router
from autenticacao.Registro import router as register_router
from autenticacao.UserSetting import router as user_settings_router
from src.admin.AdminRoutes import router as admin_router
from src.configuracoes.ConfiguracoeRoutes import router as configuracoes_router
from src.funcionarios.FuncionariosRoutes import router as funcionarios_router
from src.empresas.EmpresasRoutes import router as empresas_router

load_dotenv()

app = FastAPI(
    title="Portal GRS API",
    version="1.0.0"
)

# Configurações
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8000")
SESSION_SECRET = os.getenv("SESSION_SECRET", "portal-grs-secure-session-key")

# Adicionando o SessionMiddleware que estava faltando
app.add_middleware(
    SessionMiddleware, 
    secret_key=SESSION_SECRET,
    max_age=60 * 60 * 24 * 7  # 7 dias
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar todos os routers
app.include_router(login_router)
app.include_router(register_router)
app.include_router(user_settings_router)
app.include_router(admin_router)
app.include_router(configuracoes_router)
app.include_router(funcionarios_router)  # Novo router de funcionários
app.include_router(empresas_router)      # Novo router de empresas

@app.get("/")
def root():
    return {"msg": "🚀 API do Portal GRS está online!"}