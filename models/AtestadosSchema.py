from sqlalchemy import (
    Column, String, Integer, Date, ForeignKey, BigInteger, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from database.Base import Base

class Atestado(Base):
    __tablename__ = "atestados"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relacionamentos
    funcionario_id = Column(UUID(as_uuid=True), ForeignKey("funcionarios.id"), nullable=False)
    funcionario = relationship("Funcionario", back_populates="atestados")

    codigo_empresa = Column(BigInteger, index=True)  # Relaciona com Empresa.codigo
    unidade = Column(String(130))
    setor = Column(String(130))
    matricula_func = Column(String(30), index=True)  # Matricula do funcionário (duplicada para consulta rápida)

    dt_nascimento = Column(Date)
    sexo = Column(Integer)

    tipo_atestado = Column(Integer)
    dt_inicio_atestado = Column(Date, index=True)
    dt_fim_atestado = Column(Date)
    hora_inicio_atestado = Column(String(5))
    hora_fim_atestado = Column(String(5))
    dias_afastados = Column(Integer)
    horas_afastado = Column(String(5))

    cid_principal = Column(String(10), index=True)
    descricao_cid = Column(String(264))
    grupo_patologico = Column(String(80))
    tipo_licenca = Column(String(100))

    __table_args__ = (
        Index("idx_atestado_matricula_data", "matricula_func", "dt_inicio_atestado"),
        Index("idx_atestado_cid_empresa", "cid_principal", "codigo_empresa"),
    )

    def __repr__(self):
        return f"<Atestado(matricula={self.matricula_func}, cid={self.cid_principal}, dias={self.dias_afastados})>"
