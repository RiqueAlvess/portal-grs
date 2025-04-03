from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pathlib import Path
from typing import Callable, Dict, Any, Optional, Union, List
from functools import wraps
import httpx
import os
import logging
from dotenv import load_dotenv

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

load_dotenv()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8001")
SESSION_SECRET = os.getenv("SESSION_SECRET", "portal-grs-session-key")

app = FastAPI(title="Portal GRS")

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[BACKEND_API_URL, "*"],  # Em produção, remover "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware de sessão
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

# Caminhos base
BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"

# Garantir que o diretório de templates existe
TEMPLATES_DIR.mkdir(exist_ok=True)

# Montagem dos arquivos estáticos - abordagem robusta
# 1. Monta cada módulo separadamente
# 2. Usa glob para descobrir todos os módulos automaticamente
for module_dir in BASE_DIR.glob("*"):
    if module_dir.is_dir() and not module_dir.name.startswith((".", "_", "templates")):
        module_name = module_dir.name
        static_route = f"/static/{module_name}"
        logger.info(f"Mounting static directory: {module_dir} -> {static_route}")
        app.mount(static_route, StaticFiles(directory=module_dir), name=f"static_{module_name}")

# Configuração do Jinja2
templates = Jinja2Templates(directory=TEMPLATES_DIR)
templates.env.globals["BASE_DIR"] = str(BASE_DIR)

# Função para verificar existência e permissão de arquivos
def check_file_access(file_path: Path) -> bool:
    if not file_path.exists():
        logger.warning(f"File does not exist: {file_path}")
        return False
    if not os.access(file_path, os.R_OK):
        logger.warning(f"No read permission for file: {file_path}")
        return False
    return True

async def verify_auth(request: Request) -> bool:
    try:
        async with httpx.AsyncClient(cookies=request.cookies) as client:
            response = await client.get(f"{BACKEND_API_URL}/api/verify-auth")
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Auth verification error: {e}")
        return False

async def get_user_profile(request: Request) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(cookies=request.cookies) as client:
            response = await client.get(f"{BACKEND_API_URL}/api/user-profile")
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error(f"Failed to get user profile: {e}")
    return {}

def auth_required(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        is_authenticated = await verify_auth(request)
        if not is_authenticated:
            return RedirectResponse(url="/login", status_code=302)
        return await func(request, *args, **kwargs)
    return wrapper

async def proxy_backend(request: Request, path: str) -> httpx.Response:
    client = httpx.AsyncClient(base_url=BACKEND_API_URL, cookies=request.cookies)
    
    url = f"{path}"
    method = request.method
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "connection"]}
    
    body = await request.body()
    
    try:
        response = await client.request(
            method=method,
            url=url,
            headers=headers,
            content=body,
        )
        return response
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=502, detail="Error communicating with backend")

def get_page_content(page_path: str) -> str:
    try:
        file_path = BASE_DIR / page_path / "index.html"
        if not check_file_access(file_path):
            error_msg = f"Unable to access file: {file_path}"
            logger.error(error_msg)
            return f"<div class='error-message'><h2>Error</h2><p>{error_msg}</p></div>"
        
        return file_path.read_text(encoding="utf-8")
    except Exception as e:
        error_msg = f"Error loading page content for {page_path}: {e}"
        logger.error(error_msg)
        return f"<div class='error-message'><h2>Error</h2><p>{error_msg}</p></div>"

def list_available_css_js(module_name: str) -> Dict[str, Optional[str]]:
    result = {"css": None, "js": None}
    
    module_dir = BASE_DIR / module_name
    if not module_dir.is_dir():
        return result
    
    # Check for CSS
    css_dir = module_dir / "css"
    if css_dir.is_dir():
        css_files = list(css_dir.glob("*.css"))
        if css_files:
            result["css"] = f"/static/{module_name}/css/{css_files[0].name}"
    
    # Check for JS
    js_dir = module_dir / "js"
    if js_dir.is_dir():
        js_files = list(js_dir.glob("*.js"))
        if js_files:
            result["js"] = f"/static/{module_name}/js/{js_files[0].name}"
    
    return result

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def api_proxy(request: Request, path: str):
    try:
        response = await proxy_backend(request, f"/api/{path}")
        
        from starlette.responses import Response
        resp = Response(
            content=response.content,
            status_code=response.status_code,
            headers={k: v for k, v in response.headers.items()}
        )
        
        for name, value in response.cookies.items():
            resp.set_cookie(
                key=name,
                value=value,
                path="/",
                httponly=True,
                samesite="lax"
            )
        
        return resp
    except Exception as e:
        logger.error(f"API proxy error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    is_authenticated = await verify_auth(request)
    if is_authenticated:
        return RedirectResponse(url="/dashboard", status_code=302)
    return RedirectResponse(url="/login", status_code=302)

@app.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    is_authenticated = await verify_auth(request)
    if is_authenticated:
        return RedirectResponse(url="/dashboard", status_code=302)
    
    login_html_path = BASE_DIR / "login" / "index.html"
    if not check_file_access(login_html_path):
        raise HTTPException(status_code=500, detail="Login page not found")
    
    return HTMLResponse(content=login_html_path.read_text(encoding="utf-8"))

@app.get("/static/{module}/{file_type}/{file_name}")
async def serve_static_files(module: str, file_type: str, file_name: str):
    file_path = BASE_DIR / module / file_type / file_name
    if not file_path.exists():
        logger.warning(f"Static file not found: {file_path}")
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

@app.get("/dashboard", response_class=HTMLResponse)
@auth_required
async def dashboard(request: Request):
    user_profile = await get_user_profile(request)
    dashboard_content = get_page_content("dashboard")
    
    # Encontra automaticamente os arquivos CSS e JS
    resources = list_available_css_js("dashboard")
    
    return templates.TemplateResponse(
        "base.html", 
        {
            "request": request, 
            "page": "dashboard",
            "title": "Dashboard",
            "page_content": dashboard_content,
            "css_path": resources["css"],
            "js_path": resources["js"],
            "user": user_profile
        }
    )

@app.get("/{path:path}", response_class=HTMLResponse)
@auth_required
async def generic_page(request: Request, path: str):
    if path.startswith(("static/", "api/")):
        raise HTTPException(status_code=404, detail="Not found")
    
    user_profile = await get_user_profile(request)
    
    page_dir = BASE_DIR / path
    if not page_dir.is_dir() or not (page_dir / "index.html").exists():
        logger.warning(f"Page directory not found: {page_dir}")
        return RedirectResponse(url="/dashboard", status_code=302)
    
    page_content = get_page_content(path)
    resources = list_available_css_js(path)
    
    return templates.TemplateResponse(
        "base.html", 
        {
            "request": request, 
            "page": path,
            "title": path.capitalize(),
            "page_content": page_content,
            "css_path": resources["css"],
            "js_path": resources["js"],
            "user": user_profile
        }
    )

# Ensure base.html template exists
base_html_path = TEMPLATES_DIR / "base.html"
if not base_html_path.exists():
    logger.warning(f"Creating default base.html template at {base_html_path}")
    base_html_content = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }} - Portal GRS</title>
  
  <!-- Base CSS para layout comum -->
  <style>
    :root {
      --primary-color: #5A8F7B;
      --primary-light: #A8D5BA;
      --primary-dark: #497463;
      --background-color: #f5f5f5;
      --card-bg: #ffffff;
      --text-color: #333333;
      --border-color: #e0e0e0;
      --sidebar-width: 250px;
      --header-height: 60px;
    }
    
    body {
      margin: 0;
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: var(--background-color);
      color: var(--text-color);
    }
    
    .dashboard-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    .dashboard-header {
      height: var(--header-height);
      background-color: var(--primary-color);
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
    }
    
    .logo h1 {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .logout-btn {
      background-color: var(--primary-dark);
      color: white;
      padding: 5px 15px;
      border-radius: 4px;
      text-decoration: none;
      transition: background-color 0.2s;
    }
    
    .logout-btn:hover {
      background-color: #3a5c4f;
    }
    
    .dashboard-content {
      display: flex;
      margin-top: var(--header-height);
      min-height: calc(100vh - var(--header-height));
    }
    
    .sidebar {
      width: var(--sidebar-width);
      background-color: var(--card-bg);
      border-right: 1px solid var(--border-color);
      padding: 20px 0;
      position: fixed;
      top: var(--header-height);
      bottom: 0;
      overflow-y: auto;
    }
    
    .sidebar nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .sidebar nav ul li {
      margin-bottom: 5px;
    }
    
    .sidebar nav ul li a {
      display: flex;
      padding: 12px 20px;
      color: var(--text-color);
      text-decoration: none;
      transition: all 0.2s;
      border-left: 3px solid transparent;
    }
    
    .sidebar nav ul li a:hover {
      background-color: rgba(90, 143, 123, 0.1);
      border-left-color: var(--primary-light);
    }
    
    .sidebar nav ul li.active a {
      background-color: rgba(90, 143, 123, 0.2);
      border-left-color: var(--primary-color);
      font-weight: 500;
    }
    
    .main-content {
      flex: 1;
      margin-left: var(--sidebar-width);
      padding: 20px;
    }
    
    .error-message {
      background-color: #ffebee;
      border-left: 4px solid #f44336;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    
    @media screen and (max-width: 768px) {
      .sidebar {
        width: 0;
        transform: translateX(-100%);
        transition: all 0.3s;
      }
      
      .main-content {
        margin-left: 0;
      }
    }
  </style>
  
  <!-- CSS específico da página -->
  {% if css_path %}
  <link rel="stylesheet" href="{{ css_path }}">
  {% endif %}
</head>
<body>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="logo">
        <h1>Portal GRS</h1>
      </div>
      <div class="user-info">
        <span id="user-name">{% if user and user.nome %}{{ user.nome }}{% endif %}</span>
        <a href="/logout" class="logout-btn">Sair</a>
      </div>
    </header>
    
    <div class="dashboard-content">
      <aside class="sidebar">
        <nav>
          <ul>
            <li class="{{ 'active' if page == 'dashboard' else '' }}">
              <a href="/dashboard">Dashboard</a>
            </li>
            <li class="{{ 'active' if page == 'empresas' else '' }}">
              <a href="/empresas">Empresas</a>
            </li>
            <li class="{{ 'active' if page == 'funcionarios' else '' }}">
              <a href="/funcionarios">Funcionários</a>
            </li>
            <li class="{{ 'active' if page == 'atestados' else '' }}">
              <a href="/atestados">Atestados</a>
            </li>
            <li class="{{ 'active' if page == 'exames' else '' }}">
              <a href="/exames">Exames</a>
            </li>
            <li class="{{ 'active' if page == 'relatorios' else '' }}">
              <a href="/relatorios">Relatórios</a>
            </li>
            <li class="{{ 'active' if page == 'configuracoes' else '' }}">
              <a href="/configuracoes">Configurações</a>
            </li>
          </ul>
        </nav>
      </aside>
      
      <main class="main-content">
        {% if page_content %}
          {{ page_content|safe }}
        {% else %}
          <div class="error-message">
            <h2>Conteúdo não encontrado</h2>
            <p>Não foi possível carregar o conteúdo desta página.</p>
          </div>
        {% endif %}
      </main>
    </div>
  </div>
  
  <!-- JavaScript específico da página -->
  {% if js_path %}
  <script src="{{ js_path }}"></script>
  {% endif %}
</body>
</html>
"""
    with open(base_html_path, "w", encoding="utf-8") as f:
        f.write(base_html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)