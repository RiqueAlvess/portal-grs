#!/usr/bin/env python3
"""
Company Data Import Job

This script fetches company data from an external API and imports it into the database.
It's designed to run independently of the main application.

Usage:
    python ImportarEmpresas.py

Environment variables:
    SOC_API_URL - Base URL for the SOC API (default: https://ws1.soc.com.br/WebSoc)
    SOC_EMPRESA - Enterprise code for API calls
    SOC_CODIGO - Code for API authentication
    SOC_CHAVE - API key for authentication
    DATABASE_URL or EXTERNAL_URL_DB - PostgreSQL connection string
"""

import os
import sys
import json
import uuid
import logging
import requests
from urllib.parse import quote
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

# Get the script's directory path
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = Path(SCRIPT_DIR).resolve().parent
LOG_DIR = BASE_DIR / "log"

# Ensure logs directory exists (IMPORTANT: create this BEFORE setting up logging)
LOG_DIR.mkdir(exist_ok=True)

LOG_FILE = LOG_DIR / "company_import.log"

# Now configure logging AFTER the directory exists
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables from the .env file at the project root
env_path = BASE_DIR / ".env"
if env_path.exists():
    logger.info(f"Loading environment from {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    logger.warning(f".env file not found at {env_path}")
    load_dotenv()  # Try to load from default locations

# API Configuration
SOC_API_URL = os.getenv('SOC_API_URL', 'https://ws1.soc.com.br/WebSoc')
SOC_EMPRESA = os.getenv('SOC_EMPRESA', '423')
SOC_CODIGO = os.getenv('SOC_CODIGO', '26625')
SOC_CHAVE = os.getenv('SOC_CHAVE', '7e9da216f3bfda8c024b')

# Database configuration - handle multiple possible env var names
DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('EXTERNAL_URL_DB')
if not DATABASE_URL:
    logger.warning("DATABASE_URL and EXTERNAL_URL_DB not found in environment variables.")
    # We'll attempt to import from the project's database config as a fallback
    try:
        sys.path.append(str(BASE_DIR))
        logger.info(f"Trying to import database config from project...")
        from database.Engine import DATABASE_URL as PROJECT_DB_URL
        DATABASE_URL = PROJECT_DB_URL
        logger.info("Successfully imported database URL from project config")
    except ImportError as e:
        logger.warning(f"Could not import database config: {str(e)}")
        # Let the program continue, it will fail later if DATABASE_URL is still None

# Log database connection info (with password masked)
if DATABASE_URL:
    masked_url = DATABASE_URL.replace('://', '://***:***@') if '://' in DATABASE_URL else DATABASE_URL
    logger.info(f"Using database URL: {masked_url}")
else:
    logger.warning("No database URL configured")

def get_company_data(tipo_saida='json'):
    """
    Fetch company data from the SOC API.
    
    Args:
        tipo_saida (str): Output format (json, html, txt, csv, xml)
    
    Returns:
        dict or list: API response data
    """
    if not all([SOC_EMPRESA, SOC_CODIGO, SOC_CHAVE]):
        logger.error("Missing API configuration. Check .env file.")
        raise ValueError("Missing API configuration")
    
    try:
        # Create parameter string
        params = {
            'empresa': SOC_EMPRESA,
            'codigo': SOC_CODIGO,
            'chave': SOC_CHAVE,
            'tipoSaida': tipo_saida
        }
        param_json = json.dumps(params, separators=(',', ':'))
        quoted_param = quote(param_json)
        
        # Build URL
        url = f"{SOC_API_URL}/exportadados?parametro={quoted_param}"
        
        logger.info(f"Fetching company data from API: {url}")
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"API request failed with status code {response.status_code}")
            logger.error(f"Response: {response.text}")
            raise Exception(f"API request failed: {response.status_code}")
        
        if tipo_saida == 'json':
            data = response.json()
            # Log structure information to help debugging
            logger.info(f"API response type: {type(data)}")
            if isinstance(data, dict):
                logger.info(f"API response keys: {list(data.keys())}")
            elif isinstance(data, list):
                logger.info(f"API response is a list with {len(data)} items")
                if data and isinstance(data[0], dict):
                    logger.info(f"First item sample keys: {list(data[0].keys())[:5] if data[0] else []}")
            return data
        return response.text
    
    except Exception as e:
        logger.error(f"Error fetching company data: {str(e)}")
        raise

def map_api_to_db_schema(api_data):
    """
    Map API response data to database schema.
    Only include companies where ATIVO = "1"
    
    Args:
        api_data (dict or list): API response data
        
    Returns:
        list: List of company records ready for database insertion
    """
    companies = []
    
    try:
        # Determine the format of the API response
        if isinstance(api_data, list):
            # API returned a list directly
            data_list = api_data
        elif isinstance(api_data, dict) and 'data' in api_data:
            # API returned a dict with 'data' field
            data_list = api_data.get('data', [])
        else:
            # Unknown format, try to handle it gracefully
            logger.warning(f"Unexpected API response format: {type(api_data)}")
            if isinstance(api_data, dict):
                # Try to find data in any available key
                for key in api_data:
                    if isinstance(api_data[key], list):
                        data_list = api_data[key]
                        logger.info(f"Found data list in key: {key}")
                        break
                else:
                    # No suitable list found, use the dict itself
                    data_list = [api_data]
            else:
                # Can't process this format
                logger.error(f"Cannot process API data format: {type(api_data)}")
                return []
        
        for item in data_list:
            if not isinstance(item, dict):
                logger.warning(f"Skipping non-dict item in data: {type(item)}")
                continue
                
            # Only include active companies
            if item.get('ATIVO') == "1":
                company = {
                    'id': str(uuid.uuid4()),
                    'codigo': int(item.get('CODIGO', 0)),
                    'nome_abreviado': item.get('NOMEABREVIADO', ''),
                    'razao_social_inicial': item.get('RAZAOSOCIALINICIAL', ''),
                    'razao_social': item.get('RAZAOSOCIAL', ''),
                    'endereco': item.get('ENDERECO', ''),
                    'numero_endereco': item.get('NUMEROENDERECO', ''),
                    'complemento_endereco': item.get('COMPLEMENTOENDERECO', ''),
                    'bairro': item.get('BAIRRO', ''),
                    'cidade': item.get('CIDADE', ''),
                    'cep': item.get('CEP', ''),
                    'uf': item.get('UF', ''),
                    'cnpj': item.get('CNPJ', ''),
                    'inscricao_estadual': item.get('INSCRICAOESTADUAL', ''),
                    'inscricao_municipal': item.get('INSCRICAOMUNICIPAL', ''),
                    'ativo': True,  # Convert string "1" to boolean True
                    'usuario_id': None  # To be filled by application logic later
                }
                companies.append(company)
        
        logger.info(f"Processed {len(companies)} active companies from {len(data_list)} total")
        return companies
    
    except Exception as e:
        logger.error(f"Error mapping API data to DB schema: {str(e)}")
        # Log more details about the structure
        if isinstance(api_data, dict):
            logger.error(f"API data keys: {list(api_data.keys())}")
        elif isinstance(api_data, list) and api_data:
            logger.error(f"API data is a list with {len(api_data)} items")
            if api_data and isinstance(api_data[0], dict):
                logger.error(f"First item keys: {list(api_data[0].keys())}")
        raise

def save_to_database(companies):
    """
    Save company data to database.
    Handles both inserts and updates.
    
    Args:
        companies (list): List of company records
    """
    if not DATABASE_URL:
        logger.error("Missing DATABASE_URL in environment variables")
        logger.error("Set the DATABASE_URL or EXTERNAL_URL_DB environment variable in your .env file")
        raise ValueError("DATABASE_URL not configured")
    
    if not companies:
        logger.info("No companies to save")
        return
    
    try:
        logger.info(f"Connecting to database...")
        connection = psycopg2.connect(DATABASE_URL)
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        inserted = 0
        updated = 0
        errors = 0
        
        for company in companies:
            try:
                # Check if company already exists
                cursor.execute(
                    "SELECT id FROM empresas WHERE codigo = %s",
                    (company['codigo'],)
                )
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing company
                    update_query = """
                    UPDATE empresas SET
                        nome_abreviado = %(nome_abreviado)s,
                        razao_social_inicial = %(razao_social_inicial)s,
                        razao_social = %(razao_social)s,
                        endereco = %(endereco)s,
                        numero_endereco = %(numero_endereco)s,
                        complemento_endereco = %(complemento_endereco)s,
                        bairro = %(bairro)s,
                        cidade = %(cidade)s,
                        cep = %(cep)s,
                        uf = %(uf)s,
                        cnpj = %(cnpj)s,
                        inscricao_estadual = %(inscricao_estadual)s,
                        inscricao_municipal = %(inscricao_municipal)s,
                        ativo = %(ativo)s
                    WHERE codigo = %(codigo)s
                    """
                    cursor.execute(update_query, company)
                    updated += 1
                else:
                    # Insert new company
                    insert_query = """
                    INSERT INTO empresas (
                        id, codigo, nome_abreviado, razao_social_inicial, razao_social,
                        endereco, numero_endereco, complemento_endereco, bairro, cidade,
                        cep, uf, cnpj, inscricao_estadual, inscricao_municipal, ativo
                    ) VALUES (
                        %(id)s, %(codigo)s, %(nome_abreviado)s, %(razao_social_inicial)s, %(razao_social)s,
                        %(endereco)s, %(numero_endereco)s, %(complemento_endereco)s, %(bairro)s, %(cidade)s,
                        %(cep)s, %(uf)s, %(cnpj)s, %(inscricao_estadual)s, %(inscricao_municipal)s, %(ativo)s
                    )
                    """
                    cursor.execute(insert_query, company)
                    inserted += 1
            
            except Exception as e:
                errors += 1
                logger.error(f"Error processing company {company['codigo']}: {str(e)}")
                continue
        
        connection.commit()
        logger.info(f"Database update completed: {inserted} inserted, {updated} updated, {errors} errors")
    
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        if 'connection' in locals() and connection:
            connection.rollback()
        raise
    
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'connection' in locals() and connection:
            connection.close()

def main():
    """Main job execution function"""
    start_time = datetime.now()
    logger.info(f"Company import job started at {start_time}")
    
    try:
        # Fetch data from API
        api_data = get_company_data(tipo_saida='json')
        
        # Process and filter data
        companies = map_api_to_db_schema(api_data)
        
        # Save to database
        save_to_database(companies)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"Import completed successfully in {duration:.2f} seconds")
        
    except Exception as e:
        logger.error(f"Import failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()