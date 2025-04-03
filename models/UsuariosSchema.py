from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from database.Base import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    senha = Column(String(255), nullable=False)

    dt_criacao = Column(DateTime, default=datetime.utcnow)
    dt_last_acess = Column(DateTime, nullable=True)
    dt_last_updt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user_updt = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    type_user = Column(String(50), default="user")
    active = Column(Boolean, default=True)

    empresas = relationship(
        "Empresa", 
        back_populates="usuario",
        lazy="select",  
        overlaps="usuario"  
    )

    def __repr__(self):
        return f"<Usuario(nome={self.nome}, email={self.email}, ativo={self.active})>"