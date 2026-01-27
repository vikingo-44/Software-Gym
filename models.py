from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean, JSON
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
    # --- NUEVO CAMPO PARA CUPO ---
    clases_mensuales = Column(Integer, default=12) 
    # -----------------------------
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
    
    # Datos físicos y de salud
    fecha_nacimiento = Column(Date, nullable=True)
    edad = Column(Integer, nullable=True)
    peso = Column(Float, nullable=True)
    altura = Column(Float, nullable=True)
    imc = Column(Float, nullable=True)
    certificado_entregado = Column(Boolean, default=False)
    fecha_certificado = Column(Date, nullable=True)
    especialidad = Column(String, nullable=True) # Para Staff/Profesores
    
    # Gestión de membresía
    fecha_ultima_renovacion = Column(Date, nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)
    estado_cuenta = Column(String, default="Al día")
    
    perfil = relationship("Perfil", back_populates="usuarios")
    plan = relationship("Plan", back_populates="usuarios")
    reservas = relationship("Reserva", back_populates="usuario", cascade="all, delete-orphan")
    planes_rutina = relationship("PlanRutina", back_populates="usuario", cascade="all, delete-orphan")
    accesos = relationship("Acceso", back_populates="usuario")

class Clase(Base):
    __tablename__ = "clases"
    id = Column(Integer, primary_key=True)
    nombre = Column(String)
    coach = Column(String) # <--- Volvemos a tu columna original
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
    
    # --- CAMPOS NUEVOS PARA DIFERENCIAR TURNOS ---
    horario = Column(Float)      # Ejemplo: 18.5 para 18:30
    dia_semana = Column(Integer) # 1 para Lunes, 2 Martes, etc.
    # ---------------------------------------------

    usuario = relationship("Usuario", back_populates="reservas")
    clase = relationship("Clase", back_populates="reservas")

class Stock(Base):
    __tablename__ = "stock"
    id = Column(Integer, primary_key=True)
    nombre_producto = Column(String)
    precio_venta = Column(Float)
    stock_actual = Column(Integer)
    stock_inicial = Column(Integer)
    url_imagen = Column(String, nullable=True) # <-- Agregado para el catálogo

class MovimientoCaja(Base):
    __tablename__ = "caja"
    id = Column(Integer, primary_key=True)
    tipo = Column(String) # Ingreso / Egreso
    monto = Column(Float)
    descripcion = Column(String)
    metodo_pago = Column(String, default="Efectivo") # <-- Agregado para reportes
    fecha = Column(DateTime, default=datetime.datetime.now)

# =========================================
# NUEVA TABLA: ACCESO (HISTORIAL)
# =========================================

class Acceso(Base):
    __tablename__ = "historial_accesos"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha = Column(DateTime, default=datetime.datetime.now)
    accion = Column(String(50), nullable=False) # 'AUTHORIZED', 'DENIED'
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    exitoso = Column(Boolean, default=True)
    
    # Campos redundantes para que el Dashboard no tenga que hacer JOINs pesados
    nombre = Column(String, nullable=True)
    dni = Column(String, nullable=True)
    rol = Column(String, nullable=True)
    metodo = Column(String, default="QR")
    
    usuario = relationship("Usuario", back_populates="accesos")

# =========================================
# TABLAS MUSCULACIÓN
# =========================================

class GrupoMuscular(Base):
    __tablename__ = "grupos_musculares"
    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True)
    ejercicios = relationship("Ejercicio", back_populates="grupo_muscular")

class Ejercicio(Base):
    __tablename__ = "ejercicios_libreria"
    id = Column(Integer, primary_key=True)
    nombre = Column(String)
    grupo_muscular_id = Column(Integer, ForeignKey("grupos_musculares.id"))
    grupo_muscular = relationship("GrupoMuscular", back_populates="ejercicios")
    ejercicios_en_rutina = relationship("EjercicioEnRutina", back_populates="ejercicio_obj")

class PlanRutina(Base):
    __tablename__ = "planes_rutina"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    nombre_grupo = Column(String, nullable=True) 
    descripcion = Column(Text, nullable=True) 
    fecha_creacion = Column(Date, default=datetime.date.today)
    fecha_vencimiento = Column(Date)
    objetivo = Column(String)
    activo = Column(Boolean, default=True)
    
    usuario = relationship("Usuario", back_populates="planes_rutina")
    dias = relationship("DiaRutina", back_populates="plan_rutina", cascade="all, delete-orphan")

class DiaRutina(Base):
    __tablename__ = "rutina_dias"
    id = Column(Integer, primary_key=True)
    plan_rutina_id = Column(Integer, ForeignKey("planes_rutina.id"))
    nombre_dia = Column(String)
    
    plan_rutina = relationship("PlanRutina", back_populates="dias")
    ejercicios = relationship("EjercicioEnRutina", back_populates="dia", cascade="all, delete-orphan")

class EjercicioEnRutina(Base):
    __tablename__ = "ejercicios_en_rutina"
    id = Column(Integer, primary_key=True)
    dia_id = Column(Integer, ForeignKey("rutina_dias.id"))
    ejercicio_id = Column(Integer, ForeignKey("ejercicios_libreria.id"))
    rutina_id = Column(Integer, ForeignKey("planes_rutina.id"), nullable=True)
    
    # Sincronización total con tu JSON (soporta 'comentario' y 'comentarios')
    comentario = Column(Text, nullable=True)
    comentarios = Column(Text, nullable=True) 

    dia = relationship("DiaRutina", back_populates="ejercicios")
    ejercicio_obj = relationship("Ejercicio", back_populates="ejercicios_en_rutina")
    # Esta es la clave:
    series_detalle = relationship("SerieEjercicio", back_populates="ejercicio_en_rutina", cascade="all, delete-orphan")

class SerieEjercicio(Base):
    __tablename__ = "series_ejercicio"
    id = Column(Integer, primary_key=True)
    ejercicio_en_rutina_id = Column(Integer, ForeignKey("ejercicios_en_rutina.id"))
    numero_serie = Column(Integer) # 1, 2, 3...
    repeticiones = Column(String)
    peso = Column(String)
    descanso = Column(String)
    ejercicio_en_rutina = relationship("EjercicioEnRutina", back_populates="series_detalle")