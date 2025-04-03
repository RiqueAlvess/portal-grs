from sqlalchemy import (
    Column, String, Integer, Date, ForeignKey, BigInteger, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from database.Base import Base

class Exame(Base):
    __tablename__ = "exames"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relacionamento com Empresa (por código, não FK direta por enquanto)
    codigo_empresa = Column(BigInteger, index=True)
    nome_abreviado = Column(String(60))

    unidade = Column(String(130))
    cidade = Column(String(50))
    estado = Column(String(2))
    bairro = Column(String(80))
    endereco = Column(String(110))
    cep = Column(String(11))
    cnpj_unidade = Column(String(20))

    setor = Column(String(130))
    cargo = Column(String(130))

    # Relacionamento com funcionário (por código)
    codigo_funcionario = Column(BigInteger, index=True)  # FK lógica (via código)
    funcionario_id = Column(UUID(as_uuid=True), ForeignKey("funcionarios.id"))
    funcionario = relationship("Funcionario", back_populates="exames")

    cpf_funcionario = Column(String(19), index=True)
    matricula = Column(String(30), index=True)
    data_admissao = Column(Date)
    nome = Column(String(120))
    email_funcionario = Column(String(400))
    telefone_funcionario = Column(String(20))

    codigo_exame = Column(String(50), index=True)
    exame = Column(String(255))
    ultimo_pedido = Column(Date, index=True)
    data_resultado = Column(Date, index=True)
    periodicidade = Column(String(50))
    refazer = Column(String(10))

    __table_args__ = (
        Index("idx_exame_funcionario_data", "codigo_funcionario", "data_resultado"),
        Index("idx_exame_empresa_data", "codigo_empresa", "data_resultado"),
        Index("idx_exame_codigo_exame", "codigo_exame"),
    )

    def __repr__(self):
        return f"<Exame(nome={self.nome}, exame={self.exame}, resultado={self.data_resultado})>"
