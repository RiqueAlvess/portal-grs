#!/usr/bin/env python3

import os
import sys
import json
import uuid
import logging
import argparse
import requests
import time
import concurrent.futures
from urllib.parse import quote
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

parser = argparse.ArgumentParser(description="Import employee data from SOC API")
parser.add_argument("--all", action="store_true", help="Import all employees, including inactive ones")
parser.add_argument("--empresa", type=str, help="Import employees for specific company code")
args = parser.parse_args()

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = Path(SCRIPT_DIR).resolve().parent
LOG_DIR = BASE_DIR / "log"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "employee_import.log"

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

env_path = BASE_DIR / ".env"
if env_path.exists():
    logger.info(f"Loading environment from {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

SOC_API_URL = os.getenv('SOC_API_URL', 'https://ws1.soc.com.br/WebSoc')
SOC_CODIGO = os.getenv('SOC_CODIGO', '25722')
SOC_CHAVE = os.getenv('SOC_CHAVE', 'b4c740208036d64c467b')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('EXTERNAL_URL_DB')
if not DATABASE_URL:
    try:
        sys.path.append(str(BASE_DIR))
        from database.Engine import DATABASE_URL as PROJECT_DB_URL
        DATABASE_URL = PROJECT_DB_URL
        logger.info("Successfully imported database URL from project config")
    except ImportError as e:
        logger.warning(f"Could not import database config: {str(e)}")

if DATABASE_URL:
    masked_url = DATABASE_URL.replace('://', '://***:***@') if '://' in DATABASE_URL else DATABASE_URL
    logger.info(f"Using database URL: {masked_url}")
else:
    logger.warning("No database URL configured")

class RateLimiter:
    def __init__(self, max_calls_per_second=3):
        self.min_interval = 1.0 / max_calls_per_second
        self.last_call_time = 0
    
    def wait(self):
        current_time = time.time()
        elapsed = current_time - self.last_call_time
        
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            time.sleep(sleep_time)
        
        self.last_call_time = time.time()

api_rate_limiter = RateLimiter(max_calls_per_second=3)

def get_database_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured")
    return psycopg2.connect(DATABASE_URL)

def get_companies_from_db(company_code=None):
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured")
    
    try:
        connection = get_database_connection()
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        if company_code:
            cursor.execute(
                "SELECT id, codigo FROM empresas WHERE codigo = %s", 
                (company_code,)
            )
            company = cursor.fetchone()
            if not company:
                raise ValueError(f"Company not found: {company_code}")
            companies = [company]
        else:
            cursor.execute("SELECT id, codigo FROM empresas WHERE ativo = true")
            companies = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return companies
    
    except Exception as e:
        logger.error(f"Error fetching companies from database: {str(e)}")
        raise

def get_employee_data(company_code, tipo_saida='json', include_inactive=False):
    if not all([SOC_CODIGO, SOC_CHAVE]):
        raise ValueError("Missing API configuration")
    
    try:
        api_rate_limiter.wait()
        
        params = {
            'empresa': str(company_code),
            'codigo': SOC_CODIGO,
            'chave': SOC_CHAVE,
            'tipoSaida': tipo_saida,
            "ativo": "Sim",
            "inativo": "",
            "afastado": "Sim",
            "pendente": "Sim",
            "ferias": "Sim"
        }

        param_json = json.dumps(params, separators=(',', ':'))
        quoted_param = quote(param_json)
        
        url = f"{SOC_API_URL}/exportadados?parametro={quoted_param}"
        logger.info(f"Fetching employee data from API for company {company_code}")
        
        response = requests.get(url, timeout=60)
        
        if response.status_code != 200:
            raise Exception(f"API request failed: {response.status_code}")
        
        if tipo_saida == 'json':
            data = response.json()
            if isinstance(data, list):
                logger.info(f"API response: list with {len(data)} items for company {company_code}")
            return data
        return response.text
    
    except Exception as e:
        logger.error(f"Error fetching employee data for company {company_code}: {str(e)}")
        raise

def parse_date(date_str):
    if not date_str or date_str == "None" or date_str == "null":
        return None
    
    try:
        if '/' in date_str:
            return datetime.strptime(date_str, '%d/%m/%Y').date()
        elif '-' in date_str:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        return None
    except (ValueError, TypeError):
        return None

def parse_int(value):
    if value in (None, "", "None", "null"):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

def map_employee_to_db_schema(employee_data, company_id, company_code):
    try:
        return {
            'id': str(uuid.uuid4()),
            'empresa_id': company_id,
            'codigo_empresa': int(company_code),
            'nome_empresa': employee_data.get('NOMEEMPRESA', ''),
            'codigo': parse_int(employee_data.get('CODIGO', 0)),
            'nome': employee_data.get('NOME', ''),
            'codigo_unidade': employee_data.get('CODIGOUNIDADE', ''),
            'nome_unidade': employee_data.get('NOMEUNIDADE', ''),
            'codigo_setor': employee_data.get('CODIGOSETOR', ''),
            'nome_setor': employee_data.get('NOMESETOR', ''),
            'codigo_cargo': employee_data.get('CODIGOCARGO', ''),
            'nome_cargo': employee_data.get('NOMECARGO', ''),
            'cbo_cargo': employee_data.get('CBOCARGO', ''),
            'ccusto': employee_data.get('CCUSTO', ''),
            'nome_centro_custo': employee_data.get('NOMECENTROCUSTO', ''),
            'matricula_funcionario': employee_data.get('MATRICULAFUNCIONARIO', ''),
            'cpf': employee_data.get('CPF', ''),
            'rg': employee_data.get('RG', ''),
            'uf_rg': employee_data.get('UFRG', ''),
            'orgao_emissor_rg': employee_data.get('ORGAOEMISSORRG', ''),
            'situacao': employee_data.get('SITUACAO', ''),
            'sexo': parse_int(employee_data.get('SEXO')),
            'pis': employee_data.get('PIS', ''),
            'ctps': employee_data.get('CTPS', ''),
            'serie_ctps': employee_data.get('SERIECTPS', ''),
            'estado_civil': parse_int(employee_data.get('ESTADOCIVIL')),
            'tipo_contratacao': parse_int(employee_data.get('TIPOCONTATACAO')),
            'data_nascimento': parse_date(employee_data.get('DATA_NASCIMENTO')),
            'data_admissao': parse_date(employee_data.get('DATA_ADMISSAO')),
            'data_demissao': parse_date(employee_data.get('DATA_DEMISSAO')),
            'endereco': employee_data.get('ENDERECO', ''),
            'numero_endereco': employee_data.get('NUMERO_ENDERECO', ''),
            'bairro': employee_data.get('BAIRRO', ''),
            'cidade': employee_data.get('CIDADE', ''),
            'uf': employee_data.get('UF', ''),
            'cep': employee_data.get('CEP', ''),
            'telefone_residencial': employee_data.get('TELEFONERESIDENCIAL', ''),
            'telefone_celular': employee_data.get('TELEFONECELULAR', ''),
            'email': employee_data.get('EMAIL', ''),
            'deficiente': employee_data.get('DEFICIENTE', 'N').upper() == 'S',
            'deficiencia': employee_data.get('DEFICIENCIA', ''),
            'nm_mae_funcionario': employee_data.get('NM_MAE_FUNCIONARIO', ''),
            'data_ult_alteracao': parse_date(employee_data.get('DATAULTALTERACAO')),
            'matricula_rh': employee_data.get('MATRICULARH', ''),
            'cor': parse_int(employee_data.get('COR')),
            'escolaridade': parse_int(employee_data.get('ESCOLARIDADE')),
            'naturalidade': employee_data.get('NATURALIDADE', ''),
            'ramal': employee_data.get('RAMAL', ''),
            'regime_revezamento': parse_int(employee_data.get('REGIMEREVEZAMENTO')),
            'regime_trabalho': employee_data.get('REGIMETRABALHO', ''),
            'tel_comercial': employee_data.get('TELCOMERCIAL', ''),
            'turno_trabalho': parse_int(employee_data.get('TURNOTRABALHO')),
            'rh_unidade': employee_data.get('RHUNIDADE', ''),
            'rh_setor': employee_data.get('RHSETOR', ''),
            'rh_cargo': employee_data.get('RHCARGO', ''),
            'rh_centro_custo_unidade': employee_data.get('RHCENTROCUSTOUNIDADE', ''),
        }
    except Exception as e:
        logger.error(f"Error mapping employee data: {str(e)}")
        raise

def map_api_to_db_schema(api_data, company_id, company_code):
    employees = []
    
    try:
        data_list = []
        if isinstance(api_data, list):
            data_list = api_data
        elif isinstance(api_data, dict) and 'data' in api_data:
            data_list = api_data.get('data', [])
        elif isinstance(api_data, dict):
            for key, value in api_data.items():
                if isinstance(value, list):
                    data_list = value
                    break
            if not data_list:
                data_list = [api_data]
        
        for item in data_list:
            if not isinstance(item, dict):
                continue
            
            try:
                employee = map_employee_to_db_schema(item, company_id, company_code)
                employees.append(employee)
            except Exception as e:
                logger.error(f"Error processing employee {item.get('NOME', 'Unknown')}: {str(e)}")
        
        logger.info(f"Processed {len(employees)} employees for company {company_code}")
        return employees
    
    except Exception as e:
        logger.error(f"Error mapping API data to DB schema for company {company_code}: {str(e)}")
        raise

def batch_save_employees(employees_batch, company_code, db_conn, db_cursor):
    inserted = 0
    updated = 0
    errors = 0
    
    for employee in employees_batch:
        try:
            db_conn.rollback()
            
            # Use named parameters consistently - this solves the "argument formats can't be mixed" error
            db_cursor.execute(
                """
                SELECT id FROM funcionarios 
                WHERE (cpf = %(cpf)s AND cpf != '') 
                OR (codigo = %(codigo)s AND codigo_empresa = %(codigo_empresa)s)
                """,
                {
                    'cpf': employee['cpf'],
                    'codigo': employee['codigo'],
                    'codigo_empresa': employee['codigo_empresa']
                }
            )
            existing = db_cursor.fetchone()
            
            if existing:
                update_fields = []
                update_values = {}
                
                for key, value in employee.items():
                    if key not in ['id']:
                        update_fields.append(f"{key} = %({key})s")
                        update_values[key] = value
                
                # Add the id parameter for the WHERE clause using same named parameter style
                update_values['existing_id'] = existing['id']
                
                update_query = f"""
                UPDATE funcionarios SET 
                    {", ".join(update_fields)}
                WHERE id = %(existing_id)s
                """
                db_cursor.execute(update_query, update_values)
                updated += 1
            else:
                fields = ', '.join(employee.keys())
                placeholders = ', '.join([f"%({key})s" for key in employee.keys()])
                
                insert_query = f"""
                INSERT INTO funcionarios ({fields})
                VALUES ({placeholders})
                """
                db_cursor.execute(insert_query, employee)
                inserted += 1
            
            db_conn.commit()
            
        except Exception as e:
            db_conn.rollback()
            errors += 1
            logger.error(f"Error processing employee {employee.get('nome', 'Unknown')} (CPF: {employee.get('cpf', 'Unknown')}): {str(e)}")
    
    return inserted, updated, errors
def cleanup_connection(future, conn, cursor):
    try:
        cursor.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error during connection cleanup: {str(e)}")

def save_employees_to_database(employees, company_code):
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured")
    
    if not employees:
        return (0, 0, 0)
    
    batch_size = min(max(1, len(employees) // 10), 100)
    batches = [employees[i:i + batch_size] for i in range(0, len(employees), batch_size)]
    
    total_inserted = 0
    total_updated = 0
    total_errors = 0
    
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            
            for batch in batches:
                batch_conn = get_database_connection()
                batch_cursor = batch_conn.cursor(cursor_factory=RealDictCursor)
                
                future = executor.submit(
                    batch_save_employees, 
                    batch, 
                    company_code,
                    batch_conn,
                    batch_cursor
                )
                future.add_done_callback(
                    lambda f, conn=batch_conn, cursor=batch_cursor: cleanup_connection(f, conn, cursor)
                )
                futures.append(future)
            
            for future in concurrent.futures.as_completed(futures):
                try:
                    inserted, updated, errors = future.result()
                    total_inserted += inserted
                    total_updated += updated
                    total_errors += errors
                except Exception as e:
                    logger.error(f"Error in batch processing: {str(e)}")
        
        logger.info(f"Database update completed for company {company_code}: {total_inserted} inserted, {total_updated} updated, {total_errors} errors")
        return (total_inserted, total_updated, total_errors)
    
    except Exception as e:
        logger.error(f"Database error for company {company_code}: {str(e)}")
        raise

def process_company(company, include_inactive=False):
    company_id = company['id']
    company_code = company['codigo']
    
    try:
        api_data = get_employee_data(
            company_code=company_code,
            tipo_saida='json',
            include_inactive=include_inactive
        )
        
        employees = map_api_to_db_schema(api_data, company_id, company_code)
        
        if employees:
            inserted, updated, errors = save_employees_to_database(employees, company_code)
            return company_code, inserted, updated, errors
        else:
            return company_code, 0, 0, 0
    
    except Exception as e:
        logger.error(f"Failed to process company {company_code}: {str(e)}")
        return company_code, 0, 0, 0

def main():
    start_time = datetime.now()
    logger.info(f"Employee import job started at {start_time}")
    
    try:
        companies = get_companies_from_db(args.empresa) if args.empresa else get_companies_from_db()
        
        total_inserted = 0
        total_updated = 0
        total_errors = 0
        processed_companies = 0
        
        for company in companies:
            if not company:
                continue
                
            company_code, inserted, updated, errors = process_company(
                company, include_inactive=args.all
            )
            
            total_inserted += inserted
            total_updated += updated
            total_errors += errors
            processed_companies += 1
            
            logger.info(f"Progress: {processed_companies}/{len(companies)} companies processed")
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"Import completed in {duration:.2f} seconds")
        logger.info(f"Total employees: {total_inserted} inserted, {total_updated} updated, {total_errors} errors")
        
    except Exception as e:
        logger.error(f"Import failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()