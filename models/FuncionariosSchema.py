from sqlalchemy import (
    Column, String, Integer, Boolean, Date, ForeignKey, BigInteger, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from database.Base import Base

class Funcionario(Base):
    __tablename__ = "funcionarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relacionamentos
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id"), nullable=False)
    empresa = relationship("Empresa", back_populates="funcionarios")

    exames = relationship("Exame", back_populates="funcionario", cascade="all, delete-orphan")
    atestados = relationship("Atestado", back_populates="funcionario", cascade="all, delete-orphan")

    # Campos principais
    codigo_empresa = Column(BigInteger, index=True)
    nome_empresa = Column(String(200))
    codigo = Column(BigInteger, index=True)
    nome = Column(String(120), index=True)
    codigo_unidade = Column(String(20), index=True)
    nome_unidade = Column(String(130))
    codigo_setor = Column(String(12))
    nome_setor = Column(String(130))
    codigo_cargo = Column(String(10))
    nome_cargo = Column(String(130))
    cbo_cargo = Column(String(10))
    ccusto = Column(String(50))
    nome_centro_custo = Column(String(130))
    matricula_funcionario = Column(String(30), index=True)
    cpf = Column(String(19), index=True, unique=True)
    rg = Column(String(19))
    uf_rg = Column(String(10))
    orgao_emissor_rg = Column(String(20))
    situacao = Column(String(12))
    sexo = Column(Integer)  # 1-M, 2-F
    pis = Column(String(20))
    ctps = Column(String(30))
    serie_ctps = Column(String(25))
    estado_civil = Column(Integer)  
    tipo_contratacao = Column(Integer)
    data_nascimento = Column(Date)
    data_admissao = Column(Date)
    data_demissao = Column(Date)
    endereco = Column(String(110))
    numero_endereco = Column(String(20))
    bairro = Column(String(80))
    cidade = Column(String(50))
    uf = Column(String(20))
    cep = Column(String(10))
    telefone_residencial = Column(String(20))
    telefone_celular = Column(String(20))
    email = Column(String(400))
    deficiente = Column(Boolean, default=False)
    deficiencia = Column(String(861))
    nm_mae_funcionario = Column(String(120))
    data_ult_alteracao = Column(Date)
    matricula_rh = Column(String(30))
    cor = Column(Integer)
    escolaridade = Column(Integer)
    naturalidade = Column(String(50))
    ramal = Column(String(10))
    regime_revezamento = Column(Integer)
    regime_trabalho = Column(String(500))
    tel_comercial = Column(String(20))
    turno_trabalho = Column(Integer)
    rh_unidade = Column(String(80))
    rh_setor = Column(String(80))
    rh_cargo = Column(String(80))
    rh_centro_custo_unidade = Column(String(80))

    __table_args__ = (
        Index("idx_funcionario_nome", "nome"),
        Index("idx_funcionario_codigo_empresa", "codigo_empresa"),
        Index("idx_funcionario_cpf", "cpf"),
        Index("idx_funcionario_matricula", "matricula_funcionario"),
        Index("idx_funcionario_codigo", "codigo"),
        Index("idx_funcionario_data_admissao", "data_admissao"),
    )

    def __repr__(self):
        return f"<Funcionario(nome={self.nome}, cpf={self.cpf}, empresa={self.nome_empresa})>"
