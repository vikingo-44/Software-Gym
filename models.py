from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Perfil(Base):
    __tablename__ = "perfiles"
    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True)
    usuarios = relationship("Usuario", back_populates="perfil")

class TipoPlan(Base):
    __tablename__ = "tipos_planes"
    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True)
    duracion_dias = Column(Integer)
    planes = relationship("Plan", back_populates="tipo")

class Plan(Base):
    __tablename__ = "planes"
    id = Column(Integer, primary_key=True)
    nombre = Column(String)
    precio = Column(Float)
    tipo_plan_id = Column(Integer, ForeignKey("tipos_planes.id"))
    tipo = relationship("TipoPlan", back_populates="planes")
    usuarios = relationship("Usuario", back_populates="plan")

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True)
    dni = Column(String, unique=True, index=True)
    password_hash = Column(String)
    nombre_completo = Column(String)
    email = Column(String)
    perfil_id = Column(Integer, ForeignKey("perfiles.id"))
    plan_id = Column(Integer, ForeignKey("planes.id"), nullable=True)
    estado_cuenta = Column(String, default="Al día")
    fecha_ultima_renovacion = Column(Date)
    fecha_vencimiento = Column(Date)
    especialidad = Column(String)
    
    # Columnas sincronizadas con tu ALTER TABLE real
    fecha_nacimiento = Column(Date, nullable=True)
    peso = Column(Float, nullable=True)
    altura = Column(Float, nullable=True)
    imc = Column(Float, nullable=True) # Agregado para consistencia con main.py
    edad = Column(Integer, nullable=True) # Agregado para consistencia con main.py
    certificado_entregado = Column(Boolean, default=False)
    fecha_certificado = Column(Date, nullable=True)
    
    fecha_creacion = Column(DateTime, default=datetime.datetime.utcnow)
    perfil = relationship("Perfil", back_populates="usuarios")
    plan = relationship("Plan", back_populates="usuarios")

class Clase(Base):
    __tablename__ = "clases"
    id = Column(Integer, primary_key=True)
    nombre = Column(String)
    coach = Column(String)
    capacidad_max = Column(Integer, default=20)
    dia = Column(Integer)
    horario = Column(Integer)
    color = Column(String, default="#FF0000")

class Stock(Base):
    __tablename__ = "stock"
    id = Column(Integer, primary_key=True)
    nombre_producto = Column(String)
    precio_venta = Column(Float)
    stock_actual = Column(Integer)
    stock_inicial = Column(Integer)

class MovimientoCaja(Base):
    __tablename__ = "caja"
    id = Column(Integer, primary_key=True)
    tipo = Column(String) 
    monto = Column(Float)
    descripcion = Column(Text)
    fecha = Column(DateTime, default=datetime.datetime.utcnow)