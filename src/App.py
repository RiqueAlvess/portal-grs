import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Importação dos routers
from autenticacao.Login import router as login_router
from autenticacao.Registro import router as register_router

load_dotenv()

app = FastAPI(
    title="Portal GRS API",
    version="1.0.0"
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_router)
app.include_router(register_router)

@app.get("/")
def root():
    return {"msg": "🚀 API do Portal GRS está online!"}