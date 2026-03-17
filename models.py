from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from database import Base
from pydantic import BaseModel
from typing import List, Optional
import datetime

# =========================================
# GESTIÓN DE USUARIOS Y PLANES DE MEMBRESÍA
# =========================================

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
    clases_mensuales = Column(Integer, default=12) 
    tipo = relationship("TipoPlan", back_populates="planes")
    usuarios = relationship("Usuario", back_populates="plan")

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True)
    dni = Column(String, unique=True, index=True)
    password_hash = Column(String)
    nombre_completo = Column(String)
    email = Column(String, nullable=True)
    perfil_id = Column(Integer, ForeignKey("perfiles.id"))
    plan_id = Column(Integer, ForeignKey("planes.id"), nullable=True)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=True)
    
    fecha_nacimiento = Column(Date, nullable=True)
    edad = Column(Integer, nullable=True)
    peso = Column(Float, nullable=True)
    altura = Column(Float, nullable=True)
    imc = Column(Float, nullable=True)
    certificado_entregado = Column(Boolean, default=False)
    fecha_certificado = Column(Date, nullable=True)
    especialidad = Column(String, nullable=True)
    
    fecha_ultima_renovacion = Column(Date, nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)
    estado_cuenta = Column(String, default="Al día")
    
    perfil = relationship("Perfil", back_populates="usuarios")
    plan = relationship("Plan", back_populates="usuarios")
    sucursal = relationship("Sucursal", back_populates="usuarios")
    reservas = relationship("Reserva", back_populates="usuario", cascade="all, delete-orphan")
    planes_rutina = relationship("PlanRutina", back_populates="usuario", cascade="all, delete-orphan")
    accesos = relationship("Acceso", back_populates="usuario")

class Sucursal(Base):
    __tablename__ = "sucursales"
    id = Column(Integer, primary_key=True)
    sucursal = Column(String, nullable=False)
    direccion = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.datetime.now)
    usuarios = relationship("Usuario", back_populates="sucursal")

# =========================================
# GESTIÓN DE CLASES Y RESERVAS
# =========================================

class Clase(Base):
    __tablename__ = "clases"
    id = Column(Integer, primary_key=True)
    nombre = Column(String)
    coach = Column(String) 
    capacidad_max = Column(Integer, default=20)
    horarios_detalle = Column(JSON, nullable=True) 
    color = Column(String, default="#FF0000")
    reservas = relationship("Reserva", back_populates="clase", cascade="all, delete-orphan")

class Reserva(Base):
    __tablename__ = "reservas"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    clase_id = Column(Integer, ForeignKey("clases.id"))
    fecha_reserva = Column(Date, default=datetime.date.today)
    horario = Column(Float)      
    dia_semana = Column(Integer) 
    usuario = relationship("Usuario", back_populates="reservas")
    clase = relationship("Clase", back_populates="reservas")

class Stock(Base):
    __tablename__ = "stock"
    id = Column(Integer, primary_key=True)
    nombre_producto = Column(String)
    precio_venta = Column(Float)
    stock_actual = Column(Integer)
    stock_inicial = Column(Integer)
    url_imagen = Column(String, nullable=True) 

class MovimientoCaja(Base):
    __tablename__ = "caja"
    id = Column(Integer, primary_key=True)
    tipo = Column(String) 
    monto = Column(Float)
    descripcion = Column(String)
    descripcion2 = Column(String, nullable=True) 
    metodo_pago = Column(String, default="Efectivo") 
    fecha = Column(DateTime, default=datetime.datetime.now)
    cuotas = Column(Integer, default=1)

class Acceso(Base):
    __tablename__ = "historial_accesos"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha = Column(DateTime, default=datetime.datetime.now)
    accion = Column(String(50), nullable=False) 
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    exitoso = Column(Boolean, default=True)
    nombre = Column(String, nullable=True)
    dni = Column(String, nullable=True)
    rol = Column(String, nullable=True)
    metodo = Column(String, default="QR")
    usuario = relationship("Usuario", back_populates="accesos")

# =========================================
# MÓDULO DE MUSCULACIÓN VIKINGA (PRO)
# =========================================

class TipoRutina(Base):
    __tablename__ = "tipos_rutina"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(50))

class GrupoMuscular(Base):
    __tablename__ = "grupos_musculares"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(100))
    ejercicios = relationship("EjercicioLibreria", back_populates="grupo_muscular")

class EjercicioLibreria(Base):
    __tablename__ = "ejercicios_libreria"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(255))
    grupo_muscular_id = Column(Integer, ForeignKey("grupos_musculares.id"))
    descripcion = Column(Text)
    video_url = Column(String(255))
    
    grupo_muscular = relationship("GrupoMuscular", back_populates="ejercicios")

# --- SISTEMA DE PLANIFICACIÓN ---

class PlanRutina(Base):
    __tablename__ = "planes_rutina"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    tipo_id = Column(Integer, ForeignKey("tipos_rutina.id"))
    nombre_plan = Column(String(255))
    objetivo = Column(String(255))
    descripcion = Column(Text)
    fecha_creacion = Column(Date, default=datetime.date.today)
    fecha_vencimiento = Column(Date)
    activo = Column(Boolean, default=True)
    profesor_nombre = Column(String(255))
    
    # Relaciones
    dias = relationship("DiaRutina", back_populates="plan", cascade="all, delete-orphan")
    tipo_rel = relationship("TipoRutina")

class DiaRutina(Base):
    __tablename__ = "rutina_dias"
    id = Column(Integer, primary_key=True)
    plan_rutina_id = Column(Integer, ForeignKey("planes_rutina.id"))
    nombre_dia = Column(String(100))
    
    plan = relationship("PlanRutina", back_populates="dias")
    ejercicios = relationship("EjercicioEnRutina", back_populates="dia", cascade="all, delete-orphan")

class EjercicioEnRutina(Base):
    __tablename__ = "ejercicios_en_rutina"
    id = Column(Integer, primary_key=True)
    dia_id = Column(Integer, ForeignKey("rutina_dias.id"))
    rutina_id = Column(Integer, ForeignKey("planes_rutina.id"))
    ejercicio_id = Column(Integer, ForeignKey("ejercicios_libreria.id"))
    semana_id = Column(Integer, nullable=True) # 1 a 5 para Progresivas
    comentario = Column(Text)
    
    dia = relationship("DiaRutina", back_populates="ejercicios")
    ejercicio_obj = relationship("EjercicioLibreria")
    series = relationship("SerieEjercicio", back_populates="ejercicio_rutina", cascade="all, delete-orphan")

class SerieEjercicio(Base):
    __tablename__ = "series_ejercicios"
    id = Column(Integer, primary_key=True)
    ejercicio_en_rutina_id = Column(Integer, ForeignKey("ejercicios_en_rutina.id"))
    numero_serie = Column(Integer)
    repeticiones = Column(String(50))
    peso = Column(String(50))
    descanso = Column(String(50))
    
    ejercicio_rutina = relationship("EjercicioEnRutina", back_populates="series")