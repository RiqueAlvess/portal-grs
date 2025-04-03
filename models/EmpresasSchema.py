from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from database.Base import Base

class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    codigo = Column(BigInteger, nullable=False, unique=True) 
    nome_abreviado = Column(String(60), nullable=False)
    razao_social_inicial = Column(String(200), nullable=True)
    razao_social = Column(String(200), nullable=False)
    endereco = Column(String(110), nullable=True)
    numero_endereco = Column(String(20), nullable=True)
    complemento_endereco = Column(String(300), nullable=True)
    bairro = Column(String(80), nullable=True)
    cidade = Column(String(50), nullable=True)
    cep = Column(String(11), nullable=True)
    uf = Column(String(2), nullable=True)
    cnpj = Column(String(20), nullable=True)
    inscricao_estadual = Column(String(20), nullable=True)
    inscricao_municipal = Column(String(20), nullable=True)
    ativo = Column(Boolean, default=True)

    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    # Definindo a relação com string - usando "late binding"
    usuario = relationship("Usuario", back_populates="empresas")

    # Definindo a relação com string - usando "late binding"
    funcionarios = relationship("Funcionario", back_populates="empresa", cascade="all, delete")

    def __repr__(self):
        return f"<Empresa(codigo={self.codigo}, razao_social={self.razao_social}, ativo={self.ativo})>"