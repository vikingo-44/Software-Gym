from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional

Base = declarative_base()

# --- MODELOS DE SQLALCHEMY ---

class Admin(Base):
    __tablename__ = "admins"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    dni = Column(String(20))
    telefono = Column(String(50))
    especialidad = Column(String(100))
    bio = Column(Text)
    rol = Column(String(50), default="Master Admin")
    last_login = Column(DateTime)

class Plan(Base):
    __tablename__ = "planes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    tag = Column(String(50))
    descripcion = Column(Text)
    periodo = Column(String(20))
    precio = Column(Float, default=0.0)
    alumnos = relationship("Alumno", back_populates="plan")

class Alumno(Base):
    __tablename__ = "alumnos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(150))
    dni = Column(String(20), unique=True, nullable=False)
    estado = Column(String(20), default="Activo")
    plan_id = Column(Integer, ForeignKey("planes.id"))
    origen = Column(String(50))
    fecha_ultima_renovacion = Column(Date)
    fecha_vencimiento = Column(Date)
    
    plan = relationship("Plan", back_populates="alumnos")

class CajaMovement(Base):
    __tablename__ = "caja_movements"
    id = Column(Integer, primary_key=True, index=True)
    fecha_hora = Column(DateTime, default=datetime.utcnow)
    descripcion = Column(Text, nullable=False)
    categoria = Column(String(50))
    monto = Column(Float, nullable=False)
    tipo = Column(String(5)) # 'in' o 'out'
    metodo_pago = Column(String(50), default="Efectivo")

class Producto(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    categoria = Column(String(50))
    stock_actual = Column(Integer, default=0)
    precio_venta = Column(Float, nullable=False)

class Clase(Base):
    __tablename__ = "clases"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    coach = Column(String(100))
    duracion_minutos = Column(Integer, default=60)
    capacidad_max = Column(Integer, default=10)
    horarios = relationship("Calendario", back_populates="clase")

class Calendario(Base):
    __tablename__ = "calendario"
    id = Column(Integer, primary_key=True, index=True)
    clase_id = Column(Integer, ForeignKey("clases.id"))
    fecha = Column(Date, nullable=False)
    hora_inicio = Column(Integer)
    
    clase = relationship("Clase", back_populates="horarios")

# --- ESQUEMAS DE PYDANTIC (V2) ---

class AlumnoBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    nombre: str
    email: EmailStr
    dni: str
    estado: str
    plan_id: Optional[int] = None
    origen: str
    fecha_vencimiento: str

class PlanSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    precio: float

class DashboardMetrics(BaseModel):
    checkins_recientes: List[dict]
    top_clases: List[dict]
    metrica_asistencia: List[dict]