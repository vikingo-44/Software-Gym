import os
import logging
import hashlib
from fastapi import APIRouter, FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy import func, extract, text
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# Librerías para Seguridad (JWT y Hashing de contraseñas)
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuración de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import models
import database
from database import Base

router = APIRouter()

# ==========================================
# CONFIGURACIÓN DE SEGURIDAD
# ==========================================
# Esta clave debe ser la misma en el generador de QR
SECRET_KEY = "Vikingo_Security_Strong_Key_2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 día

# FIX CRÍTICO: Usamos sha256_crypt para evitar el error de los 72 bytes de bcrypt.
pwd_context = CryptContext(schemes=["sha256_crypt", "bcrypt"], deprecated="auto")

# Definición para habilitar el botón "Authorize" en FastAPI Docs (/docs)
auth_scheme = HTTPBearer()

app = FastAPI(
    title="GymFit App",
    description="Sistema de gestión integral",
    version="2.5.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Funciones de Seguridad Auxiliares ---
def verify_password(plain_password, hashed_password):
    """Verifica si la contraseña coincide (soporta múltiples algoritmos y texto plano)"""
    try:
        if not hashed_password: return False
        # Limpiamos la entrada por seguridad
        safe_input = str(plain_password).strip()
        return pwd_context.verify(safe_input, hashed_password)
    except Exception as e:
        logger.warning(f"Error verificando hash, reintentando comparación simple: {e}")
        return str(plain_password).strip() == str(hashed_password).strip()

def get_password_hash(password):
    """Genera hash seguro para la contraseña usando sha256_crypt"""
    if not password: return None
    # Forzamos a string y limpiamos espacios
    safe_password = str(password).strip()
    return pwd_context.hash(safe_password)

def create_access_token(data: dict):
    """Genera el token JWT"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- Dependencia para proteger Endpoints ---
def get_current_user(db: Session = Depends(database.get_db), auth: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    """Valida el token y devuelve el usuario actual con su perfil cargado"""
    try:
        payload = jwt.decode(auth.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        dni: str = payload.get("sub")
        if dni is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Sesión expirada o token corrupto")
    
    # ⚔️ FIX CRÍTICO: Forzamos la carga del perfil asociado a perfil_id
    user = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).filter(models.Usuario.dni == dni).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

# ==========================================
# PARCHE DE BASE DE DATOS (AUTO-FIX)
# ==========================================
@app.on_event("startup")
def startup_event():
    """
    Parche automático: Corrige la tabla caja, agrega columnas faltantes y limpia restricciones.
    """
    db = database.SessionLocal()
    try:
        logger.info("--- INICIANDO MANTENIMIENTO DE BD ---")
        
        # 1. PARCHE DE UNIFICACIÓN: Si existe 'usuario', mover datos a 'alumno_id' o renombrar.
        # Esto soluciona el conflicto de nombres que te causó el Error 500.
        try:
            # Intentamos agregar la columna alumno_id primero por seguridad
            db.execute(text("ALTER TABLE caja ADD COLUMN IF NOT EXISTS alumno_id INTEGER"))
            db.commit()
            
            # Si existe la columna vieja 'usuario', pasamos los datos a 'alumno_id'
            db.execute(text("UPDATE caja SET alumno_id = usuario WHERE alumno_id IS NULL AND usuario IS NOT NULL"))
            db.commit()
            logger.info("Migración de datos de 'usuario' a 'alumno_id' completada.")
        except Exception:
            db.rollback()

        # 2. AGREGAR COLUMNAS FALTANTES (Crítico para ventas de productos)
        columnas_extras = [
            ("descripcion2", "VARCHAR"),
            ("producto_id", "INTEGER"),
            ("cantidad", "INTEGER"),
            ("cuotas", "INTEGER"),
            ("metodo_pago", "VARCHAR")
        ]
        
        for col, tipo in columnas_extras:
            try:
                db.execute(text(f"ALTER TABLE caja ADD COLUMN IF NOT EXISTS {col} {tipo}"))
                db.commit()
                logger.info(f"Columna verificada: {col}")
            except Exception as e:
                db.rollback()
                logger.warning(f"No se pudo crear columna {col}: {e}")

        # 3. Tu limpieza de restricciones de reservas original
        constraints_to_drop = [
            "reservas_usuario_id_clase_id_key",
            "reservas_usuario_id_clase_id_fecha_reserva_key",
            "_usuario_clase_uc"
        ]
        
        for constraint in constraints_to_drop:
            try:
                db.execute(text(f"ALTER TABLE reservas DROP CONSTRAINT IF EXISTS {constraint}"))
                db.commit()
                logger.info(f"Restricción eliminada: {constraint}")
            except Exception:
                db.rollback()
                
        logger.info("--- MANTENIMIENTO DE BD COMPLETADO ---")
    finally:
        db.close()

# ==========================================
# SCHEMAS (Modelos de Datos Pydantic)
# ==========================================

class UsuarioLogin(BaseModel):
    dni: str
    password: str

# --- NUEVO: Schema para Reset de Contraseña ---
class UsuarioResetPassword(BaseModel):
    dni: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    id: int
    nombre_completo: str
    dni: str
    email: Optional[str] = None
    rol_nombre: str
    plan: Optional[dict] = None
    plan_id: Optional[int] = None
    fecha_vencimiento: Optional[str] = None
    fecha_ultima_renovacion: Optional[str] = None
    # --- NUEVOS CAMPOS PARA BLOQUEO Y AVISO ---
    is_expired: bool = False
    dias_restantes: int = 0
    # ------------------------------------------
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    fecha_nacimiento: Optional[str] = None
    edad: Optional[int] = None
    certificado_entregado: bool = False
    fecha_certificado: Optional[str] = None
    sucursal_id: Optional[int] = None
    telefono: Optional[str] = None
    genero: Optional[str] = None

# --- SCHEMA PARA LA CARGA MASIVA ---
class BulkAlumnoSchema(BaseModel):
    nombre_completo: str
    dni: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    genero: Optional[str] = None
    password: str = "GymApp2026!"
    fecha_nacimiento: Optional[str] = "2000-01-01"
    peso: float = 0.0
    altura: float = 0.0
    imc: float = 0.0
    certificado_entregado: bool = False
    fecha_certificado: Optional[str] = None
    # CAMPOS CLAVE PARA EL MATCH
    plan_nombre: str  # Ejemplo: "Basic"
    fecha_inicio: str # Formato YYYY-MM-DD
    fecha_fin: str    # Formato YYYY-MM-DD
    sucursal_id: int = 1

# --- NUEVO: Schema para Validación de QR ---
class AccessCheck(BaseModel):
    qr_data: str # Recibirá el formato "DNI:HASH" contenido en el código QR

class TipoPlanSchema(BaseModel):
    id: int
    nombre: str
    duracion_dias: Optional[int] = 30
    model_config = ConfigDict(from_attributes=True)

class PlanSchema(BaseModel):
    id: int
    nombre: str
    efectivo: Optional[float] = 0.0
    transferencia: Optional[float] = 0.0
    debito_credito: Optional[float] = 0.0
    clases_mensuales: Optional[int] = 12
    tipo_plan_id: Optional[int] = None
    tipo: Optional[TipoPlanSchema] = None # Si el tipo no existe, no rompe
    model_config = ConfigDict(from_attributes=True)

class UsuarioResponse(BaseModel):
    id: int
    dni: str
    nombre_completo: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    genero: Optional[str] = None
    estado_cuenta: Optional[str] = "Activo"
    rol_nombre: Optional[str] = "Alumno"
    plan: Optional[PlanSchema] = None # Si el plan está huérfano, devuelve null
    plan_id: Optional[int] = None
    fecha_vencimiento: Optional[date] = None
    fecha_ultima_renovacion: Optional[date] = None
    peso: Optional[float] = 0.0
    altura: Optional[float] = 0.0
    imc: Optional[float] = 0.0
    certificado_entregado: Optional[bool] = False
    fecha_certificado: Optional[date] = None
    sucursal_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class AlumnoUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    dni: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    edad: Optional[int] = None
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    certificado_entregado: Optional[bool] = None
    fecha_certificado: Optional[date] = None
    sucursal_id: Optional[int] = None
    telefono: Optional[str] = None
    genero: Optional[str] = None

class StaffUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    dni: Optional[str] = None
    email: Optional[str] = None
    especialidad: Optional[str] = None
    perfil_nombre: Optional[str] = None
    password: Optional[str] = None
    sucursal_id: Optional[int] = None

class StockUpdate(BaseModel):
    nombre_producto: str
    stock_actual: int
    precio_venta: float
    url_imagen: Optional[str] = None
    sucursal_id: Optional[int] = None 

class PlanUpdate(BaseModel):
    nombre: str
    efectivo: float
    transferencia: float
    debito_credito: float
    tipo_plan_id: int
    clases_mensuales: Optional[int] = 12

# --- NUEVO SCHEMA PARA BOXES ---
class TipoBoxResponse(BaseModel):
    id: int
    nombre: str
    class Config: from_attributes = True

class ClaseUpdate(BaseModel):
    nombre: str
    coach: str
    box_id: Optional[int] = 1 # Por defecto al Principal
    color: Optional[str] = "#FF0000"
    capacidad_max: Optional[int] = 40
    horarios_detalle: Optional[List[dict]] = None
    sucursal_id: Optional[int] = None

class ClaseMove(BaseModel):
    old_dia: int
    old_horario: float
    new_dia: int
    new_horario: float

class MovimientoCajaCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: str
    descripcion2: Optional[str] = None
    metodo_pago: Optional[str] = "Efectivo"

class MovimientoCreate(BaseModel):
    descripcion: str
    monto: float
    tipo: str  
    metodo_pago: str = "Efectivo"
    cuotas: Optional[int] = 1
    descripcion2: Optional[str] = None
    # --- AGREGAR ESTOS DOS ---
    producto_id: Optional[int] = None
    cantidad: Optional[int] = 0
    sucursal_id: Optional[int] = None

class TransactionCreate(BaseModel):
    tipo: str  # 'Plan' o 'Mercaderia'
    monto: float
    descripcion: str
    metodo_pago: str  # 'Efectivo', 'Transferencia', 'Tarjeta'
    alumno_id: Optional[int] = None
    producto_id: Optional[int] = None
    cantidad: int = 1
    cuotas: Optional[int] = 1
    descripcion2: Optional[str] = None
    sucursal_id: Optional[int] = None

# --- FERIADOS ---
class DiaEspecialCreate(BaseModel):
    fecha: str
    motivo: str
    abierto: bool = True
    sucursal_id: int

class ClaseFeriadoCreate(BaseModel):
    fecha: str
    nombre: str
    horario: float
    capacidad_max: int = 40
    color: str = "#FF0000"
    sucursal_id: int

# --- SCHEMAS RUTINAS (SINCRONIZADOS CON DB_SCHEMA.SQL) ---
class SerieResponse(BaseModel):
    id: int
    numero_serie: int
    repeticiones: str
    peso: str
    descanso: str
    class Config: from_attributes = True

class EjercicioLibResponse(BaseModel):
    id: int
    nombre: str
    class Config: from_attributes = True

class EjercicioEnRutinaResponse(BaseModel):
    id: int
    ejercicio_id: int
    ejercicio_obj: Optional[EjercicioLibResponse] = None
    semana_id: Optional[int] = None
    series_detalle: List[SerieResponse] = []
    comentario: Optional[str] = None
    class Config: from_attributes = True

class DiaRutinaResponse(BaseModel):
    id: int
    nombre_dia: str
    ejercicios: List[EjercicioEnRutinaResponse] = []
    class Config: from_attributes = True

class PlanRutinaResponse(BaseModel):
    id: int
    usuario_id: int
    nombre_grupo: Optional[str] = None
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    tipo_id: Optional[int] = None
    profesor_nombre: Optional[str] = None
    fecha_creacion: date
    fecha_vencimiento: date
    activo: bool
    dias: List[DiaRutinaResponse] = []
    class Config: from_attributes = True

class SerieCreate(BaseModel):
    numero_serie: int
    repeticiones: str
    peso: str
    descanso: str
    
class EjercicioEnRutinaCreate(BaseModel):
    ejercicio_id: int
    semana_id: Optional[int] = None
    series: Optional[List[SerieCreate]] = []
    comentario: Optional[str] = ""
    progreso_json: Optional[Union[dict, str]] = None 

class DiaRutinaCreate(BaseModel):
    nombre_dia: str
    ejercicios: Optional[List[EjercicioEnRutinaCreate]] = None 
    
class PlanRutinaCreate(BaseModel):
    usuario_id: int
    nombre_grupo: Optional[str] = "Nueva Rutina"
    objetivo: Optional[str] = ""
    descripcion: Optional[str] = ""
    tipo: Optional[str] = "normal" 
    fecha_vencimiento: date
    dias: List[DiaRutinaCreate]

class EjercicioCreate(BaseModel):
    nombre: str
    grupo_muscular_id: int

class GrupoMuscularSchema(BaseModel):
    id: int
    nombre: str
    class Config: from_attributes = True

class ReservaCreate(BaseModel):
    usuario_id: int
    clase_id: int
    horario: float
    dia_semana: int
    fecha_clase: str

class SucursalCreate(BaseModel):
    sucursal: str
    direccion: str

class SucursalResponse(BaseModel):
    id: int
    sucursal: str
    direccion: str
    class Config: from_attributes = True

# --- SCHEMAS PARA COMPROBANTES ---
class ComprobanteCreate(BaseModel):
    pago_id: int
    usuario_id: int
    monto_total: float
    metodo_pago: str
    nro_ticket_postnet: Optional[str] = None
    plan_nombre_snapshot: str

class ComprobanteResponse(BaseModel):
    id: int
    nro_factura: str
    fecha_emision: datetime
    class Config: from_attributes = True

def calcular_meses(inicio_str, fin_str):
    """Calcula la diferencia en meses redondeada para matchear con TipoPlan"""
    try:
        # Corregido el formato de fecha a %Y-%m-%d
        inicio = datetime.strptime(inicio_str, "%Y-%m-%d")
        fin = datetime.strptime(fin_str, "%Y-%m-%d")
        diff = (fin.year - inicio.year) * 12 + (fin.month - inicio.month)
        return max(1, diff)
    except:
        return 1

# ==========================================
# LÓGICA DE ACTUALIZACIÓN GENÉRICA (FIX 500)
# ==========================================

def update_db_user(user_id: int, data: Union[AlumnoUpdate, StaffUpdate], db: Session):
    """
    Función robusta para actualizar usuarios sin causar errores 500.
    Usa model_dump(exclude_unset=True) para solo tocar lo que el frontend compartió.
    """
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Extraer solo campos enviados
    update_data = data.model_dump(exclude_unset=True)

    # Lógica especial para perfiles en Staff
    if 'perfil_nombre' in update_data:
        p_nombre = update_data.pop('perfil_nombre')
        perfil = db.query(models.Perfil).filter(func.lower(models.Perfil.nombre) == p_nombre.lower()).first()
        if perfil:
            user.perfil_id = perfil.id

    # Aplicar campos dinámicamente
    for key, value in update_data.items():
        if key == "password":
            if value: user.password_hash = get_password_hash(value)
            continue
        
        # Validar DNI único si se intenta cambiar
        if key == "dni" and value != user.dni:
            check = db.query(models.Usuario).filter(models.Usuario.dni == value).first()
            if check: raise HTTPException(status_code=400, detail="El DNI ya pertenece a otro usuario")

        if hasattr(user, key):
            setattr(user, key, value)

    try:
        db.commit()
        db.refresh(user)
        return {"status": "success", "message": "Actualizado correctamente"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error 500 al actualizar ID {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno al actualizar: {str(e)}")

# ==========================================
# ENDPOINTS
# ==========================================

@app.post("/api/alumnos/importar-masivo", tags=["Migración"])
async def importar_alumnos(alumnos_data: List[BulkAlumnoSchema], db: Session = Depends(database.get_db)):
    resumen = {"creados": 0, "errores": [], "detalles": []}
    hoy_str = date.today().isoformat()
    
    # Traemos todos los tipos para comparar duraciones (30, 90, 180, etc.)
    tipos_plan = db.query(models.TipoPlan).all()
    perfil_alumno = db.query(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").first()

    for data in alumnos_data:
        try:
            # 1. Evitar duplicados por DNI
            existe = db.query(models.Usuario).filter(models.Usuario.dni == data.dni).first()
            if existe:
                resumen["errores"].append(f"DNI {data.dni} ya existe")
                continue

            # 2. Convertir fechas y calcular días reales de diferencia
            f_inicio = datetime.strptime(data.fecha_inicio, "%Y-%m-%d").date()
            f_fin = datetime.strptime(data.fecha_fin, "%Y-%m-%d").date()
            dias_diferencia = (f_fin - f_inicio).days

            # 3. Encontrar el Tipo de Plan por duración
            # Ordenamos de mayor a menor para que el match sea exacto
            tipo_match = None
            for t in sorted(tipos_plan, key=lambda x: x.duracion_dias, reverse=True):
                # Usamos un margen de 5 días por si el mes tiene 28 o 31
                if dias_diferencia >= (t.duracion_dias - 5):
                    tipo_match = t
                    break
            
            if not tipo_match: tipo_match = tipos_plan[0]

            # 4. BUSQUEDA POR NOMBRE + TIPO (Aquí resolvemos lo de los nombres repetidos)
            plan_final = db.query(models.Plan).filter(
                func.lower(models.Plan.nombre) == data.plan_nombre.lower(),
                models.Plan.tipo_plan_id == tipo_match.id
            ).first()

            # Si no encuentra ese nombre específico en ese tipo, usamos el primero de ese tipo
            if not plan_final:
                plan_final = db.query(models.Plan).filter(models.Plan.tipo_plan_id == tipo_match.id).first()

            f_nac_dt = None
            if data.fecha_nacimiento:
                try:
                    f_nac_dt = datetime.strptime(data.fecha_nacimiento, "%Y-%m-%d").date()
                except:
                    f_nac_dt = None

            # 5. Crear el Usuario (Alumno)
            nuevo = models.Usuario(
                nombre_completo=data.nombre_completo.upper(),
                dni=data.dni,
                email=data.email,
                telefono=data.telefono,
                genero=data.genero,
                fecha_nacimiento=f_nac_dt,
                password_hash=get_password_hash(data.password),
                perfil_id=perfil_alumno.id if perfil_alumno else None,
                sucursal_id=data.sucursal_id,
                plan_id=plan_final.id if plan_final else None,
                fecha_ultima_renovacion=f_inicio,
                fecha_vencimiento=f_fin,
                estado_cuenta="Activo" if data.fecha_fin >= hoy_str else "Caducado",
                peso=data.peso,
                altura=data.altura,
                imc=data.imc,
                certificado_entregado=data.certificado_entregado,
                fecha_certificado=datetime.strptime(data.fecha_certificado, "%Y-%m-%d").date() if data.fecha_certificado else None
            )
            
            db.add(nuevo)
            resumen["creados"] += 1
            resumen["detalles"].append(f"{data.nombre_completo} -> {plan_final.nombre} ({tipo_match.nombre})")

        except Exception as e:
            resumen["errores"].append(f"Error en {data.nombre_completo}: {str(e)}")

    db.commit()
    return resumen

# 1. ROOT: Carga tu web directamente al entrar a la URL
@app.get("/")
async def read_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"message": "Sistema Online. No se encontró index.html"}

# 2. STATIC FILES: Sirve script.js, style.css e imágenes
@app.get("/{filename}")
async def serve_file(filename: str):
    # Lista blanca de seguridad: solo estos archivos se pueden descargar
    whitelist = [
        "script.js", 
        "style.css", 
        "icono2.png", 
        "manifest.json", 
        "robots.txt"
    ]
    
    if filename in whitelist:
        if os.path.exists(filename):
            return FileResponse(filename)
            
    # Si piden algo raro (como main.py o .env), damos error 404
    raise HTTPException(status_code=404)

# --- LOGIN (ACTUALIZADO CON METADATA DE VENCIMIENTO) ---
@app.post("/api/login", response_model=TokenResponse, tags=["Autenticacion"])
def login(data: UsuarioLogin, db: Session = Depends(database.get_db)):
    # Query completa con joinedload para traer el plan y el perfil
    user = db.query(models.Usuario).options(
        joinedload(models.Usuario.perfil),
        joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
    ).filter(models.Usuario.dni == data.dni).first()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Generar Token de Acceso
    token = create_access_token(data={"sub": user.dni})

    # --- CÁLCULO DE ESTADO DE VENCIMIENTO ---
    expired = False
    days_left = 0
    hoy = date.today()

    if user.fecha_vencimiento:
        expired = user.fecha_vencimiento < hoy
        days_left = (user.fecha_vencimiento - hoy).days
    # ----------------------------------------
    
    # Devolver el payload completo que el frontend necesita para el QR y el perfil
    return {
        "access_token": token,
        "token_type": "bearer",
        "id": user.id, 
        "nombre_completo": user.nombre_completo, 
        "dni": user.dni, 
        "email": user.email,
        "telefono": user.telefono,
        "genero": user.genero,
        "rol_nombre": user.perfil.nombre if user.perfil else "Usuario",
        "plan": {
            "id": user.plan.id,
            "nombre": user.plan.nombre,
            "efectivo": user.plan.efectivo,
            "transferencia": user.plan.transferencia,
            "debito_credito": user.plan.debito_credito,
            "clases_mensuales": user.plan.clases_mensuales 
        } if user.plan else None,
        "plan_id": user.plan_id,
        "fecha_vencimiento": user.fecha_vencimiento.isoformat() if user.fecha_vencimiento else None,
        "fecha_ultima_renovacion": user.fecha_ultima_renovacion.isoformat() if user.fecha_ultima_renovacion else None,
        "is_expired": expired,
        "dias_restantes": days_left,
        "peso": user.peso,
        "altura": user.altura,
        "imc": user.imc,
        "fecha_nacimiento": user.fecha_nacimiento.isoformat() if user.fecha_nacimiento else None,
        "edad": user.edad,
        "certificado_entregado": user.certificado_entregado,
        "fecha_certificado": user.fecha_certificado.isoformat() if user.fecha_certificado else None,
        "sucursal_id": user.sucursal_id
    }

# --- NUEVO: RESET DE CONTRASEÑA ---
@app.put("/api/usuarios/reset-password", tags=["Autenticacion"])
def reset_password(data: UsuarioResetPassword, db: Session = Depends(database.get_db)):
    """Permite cambiar la contraseña verificando el DNI."""
    user = db.query(models.Usuario).filter(models.Usuario.dni == data.dni).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="El DNI no existe en el sistema.")
    
    try:
        user.password_hash = get_password_hash(data.password)
        db.commit()
        return {"status": "success", "message": "Contraseña actualizada correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar: {str(e)}")

# --- NUEVO: VALIDACIÓN DE ACCESO (QR CON HASHING) ---
@app.post("/api/acceso/validar", tags=["Seguridad"])
def validar_acceso_qr(data: AccessCheck, db: Session = Depends(database.get_db)):
    """
    Control de Acceso mediante escaneo de código QR.
    Se espera que el QR contenga el formato "DNI:HASH" contenido en el código QR.
    """
    raw_data = data.qr_data
    
    # Preparar respuesta base
    final_response = {
        "status": "DENIED",
        "message": "Error desconocido",
        "nombre": "Desconocido",
        "rol": "N/A",
        "color": "red"
    }

    # 1. Verificar formato del QR
    if ":" not in raw_data:
        final_response["message"] = "Formato de QR no válido"
        return final_response

    dni_recibido, hash_recibido = raw_data.split(":")

    # 2. Validar Hash de seguridad
    esperado = hashlib.sha256(f"{dni_recibido}{SECRET_KEY}".encode()).hexdigest()
    
    if hash_recibido != esperado:
        final_response["message"] = "Código QR no autorizado o falsificado"
        final_response["nombre"] = "Error Seguridad"
        return final_response

    # 3. Buscar usuario por DNI
    user = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).filter(models.Usuario.dni == dni_recibido).first()
    
    if not user:
        final_response["message"] = "Usuario no registrado"
        return final_response

    # Datos básicos encontrados
    final_response["nombre"] = user.nombre_completo
    final_response["rol"] = user.perfil.nombre if user.perfil else "Usuario"
    rol_lower = final_response["rol"].lower()

    # Lógica de Roles Staff
    roles_staff = ["administracion", "administrativo", "profesor", "staff", "admin", "dueño", "supervisor"]
    
    if rol_lower in roles_staff:
        final_response["status"] = "AUTHORIZED"
        final_response["message"] = "Bienvenido Staff"
        final_response["color"] = "blue"
    
    # Validación para Alumnos
    elif user.fecha_vencimiento:
        if user.fecha_vencimiento >= date.today():
            dias_rest = (user.fecha_vencimiento - date.today()).days
            final_response["status"] = "AUTHORIZED"
            
            # --- CORRECCIÓN DE COLORES ---
            if dias_rest <= 3:
                final_response["message"] = "¡Atención: Próximo a vencer!"
                final_response["color"] = "yellow"
            else:
                final_response["message"] = f"Pase Válido ({dias_rest} días rest.)"
                final_response["color"] = "green"
        else:
            final_response["status"] = "DENIED"
            final_response["message"] = f"Plan Vencido el {user.fecha_vencimiento}"
            final_response["color"] = "red"

    # --- REGISTRO EN HISTORIAL (SQL) ---
    try:
        nuevo_acceso = models.Acceso(
            usuario_id=user.id,
            dni=dni_recibido,
            nombre=user.nombre_completo,
            rol=final_response["rol"],
            metodo="QR SCAN",
            accion=final_response["status"],
            exitoso=(final_response["status"] == "AUTHORIZED"),
            sucursal_id=user.sucursal_id, # <--- SE GUARDA LA SUCURSAL DEL USUARIO QUE ACCEDE
            fecha=datetime.now()
        )
        db.add(nuevo_acceso)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error al guardar log de acceso: {e}")

    return final_response

# --- SUCURSALES ---
@app.get("/api/sucursales", response_model=List[SucursalResponse], tags=["Sucursales"])
def get_sucursales(db: Session = Depends(database.get_db)):
    """Lista todas las sucursales del gimnasio."""
    return db.query(models.Sucursal).all()

@app.post("/api/sucursales", tags=["Sucursales"])
def create_sucursal(data: SucursalCreate, db: Session = Depends(database.get_db)):
    """Crea una nueva sucursal."""
    new_s = models.Sucursal(
        sucursal=data.sucursal,
        direccion=data.direccion
    )
    db.add(new_s)
    db.commit()
    return {"status": "success", "message": "Sucursal creada correctamente"}

@app.delete("/api/sucursales/{id}", tags=["Sucursales"])
def delete_sucursal(id: int, db: Session = Depends(database.get_db)):
    """Elimina una sucursal."""
    db.query(models.Sucursal).filter(models.Sucursal.id == id).delete()
    db.commit()
    return {"status": "success"}

# --- NUEVO: HISTORIAL DE ACCESOS ---
@app.get("/api/acceso/historial", tags=["Seguridad"])
def get_historial_accesos(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """
    Trae los últimos 50 registros de acceso FILTRADOS por sucursal. 
    """
    try:
        from datetime import timedelta
        # Agregamos el filtro por sucursal_id del usuario logueado
        accesos = db.query(models.Acceso).filter(
            models.Acceso.sucursal_id == current_user.sucursal_id
        ).order_by(models.Acceso.id.desc()).limit(50).all()
        
        # PRIORIDAD 0: CORRECCIÓN HORARIA (GMT-3 para Argentina)
        offset = timedelta(hours=-3) 

        return [{
            "id": a.id,
            "nombre": a.nombre,
            "dni": a.dni,
            "rol": a.rol or "Alumno",
            "fecha": (a.fecha + offset).strftime("%H:%M - %d/%m/%y") if a.fecha else "S/D",
            "metodo": a.metodo or "QR",
            "estado": a.accion 
        } for a in accesos]
    except Exception as e:
        logger.error(f"Error al obtener historial: {e}")
        return []

# --- ALUMNOS ---
@app.get("/api/alumnos", tags=["Alumnos"]) # ⚔️ Quitamos el response_model para que no filtre
def get_alumnos(db: Session = Depends(database.get_db)):
    try:
        alumnos_db = db.query(models.Usuario).options(
            joinedload(models.Usuario.perfil),
            joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
        ).join(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").order_by(models.Usuario.nombre_completo.asc()).all()
        
        hoy = date.today()
        resultado = []

        for al in alumnos_db:
            # Construimos el objeto a mano para asegurar que NADA falte
            alumno_dict = {
                "id": al.id,
                "dni": al.dni,
                "nombre_completo": al.nombre_completo,
                "email": al.email,
                "telefono": al.telefono,
                "genero": al.genero,
                "sucursal_id": al.sucursal_id,
                "peso": al.peso,
                "altura": al.altura,
                "imc": al.imc,
                "fecha_nacimiento": al.fecha_nacimiento.isoformat() if al.fecha_nacimiento else None, # ⚔️ FORZAMOS EL DATO
                "fecha_certificado": al.fecha_certificado.isoformat() if al.fecha_certificado else None,
                "certificado_entregado": al.certificado_entregado,
                "rol_nombre": al.perfil.nombre if al.perfil else "Alumno",
                "fecha_vencimiento": al.fecha_vencimiento.isoformat() if al.fecha_vencimiento else None
            }

            # Recálculo de estado
            if al.fecha_vencimiento:
                alumno_dict["estado_cuenta"] = "Activo" if al.fecha_vencimiento >= hoy else "Caducado"
            else:
                alumno_dict["estado_cuenta"] = "Inactivo"
            
            resultado.append(alumno_dict)

        return resultado
    except Exception as e:
        logger.error(f"Error Crítico Alumnos: {str(e)}")
        return []


@app.get("/api/alumnos/{id}/ficha", tags=["Alumnos"])
def get_ficha_tecnica(id: int, db: Session = Depends(database.get_db)):
    al = db.query(models.Usuario).options(joinedload(models.Usuario.plan)).filter(models.Usuario.id == id).first()
    if not al:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    estado = al.estado_cuenta
    if al.fecha_vencimiento and al.fecha_vencimiento < date.today():
        estado = "Caducado"

    return {
        "nombre_completo": al.nombre_completo,
        "dni": al.dni,
        "plan": al.plan.nombre if al.plan else "Sin plan",
        "peso": al.peso,
        "altura": al.altura,
        "imc": al.imc,
        "estado_cuenta": estado,
        "fecha_nacimiento": al.fecha_nacimiento,
        "edad": al.edad,
        "certificado_entregado": al.certificado_entregado,
        "fecha_certificado": al.fecha_certificado
    }

@app.post("/api/alumnos", tags=["Alumnos"])
def create_alumno(alumno: Union[AlumnoUpdate, List[AlumnoUpdate]], db: Session = Depends(database.get_db)):
    try:
        perfil = db.query(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").first()
        if not perfil:
            raise HTTPException(status_code=500, detail="Perfil Alumno no encontrado")
            
        # Normalizamos la entrada a una lista para procesar uniformemente
        alumnos_a_procesar = alumno if isinstance(alumno, list) else [alumno]
        
        for item in alumnos_a_procesar:
            # Determinamos password (password enviado o DNI por defecto)
            raw_password = str(item.password).strip() if item.password else str(item.dni).strip()
            hashed_pass = get_password_hash(raw_password)

            new_al = models.Usuario(
                nombre_completo=item.nombre_completo, 
                dni=item.dni, 
                email=item.email,
                perfil_id=perfil.id, 
                password_hash=hashed_pass,
                fecha_nacimiento=item.fecha_nacimiento,
                edad=item.edad or 0,
                peso=item.peso or 0,
                altura=item.altura or 0,
                imc=item.imc or 0,
                certificado_entregado=item.certificado_entregado or False,
                fecha_certificado=item.fecha_certificado,
                sucursal_id=item.sucursal_id,
                telefono=item.telefono,
                genero=item.genero
            )
            db.add(new_al)
        
        db.commit()
        return {
            "status": "success", 
            "message": f"Se procesaron {len(alumnos_a_procesar)} alumno(s) correctamente"
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Error de integridad: El DNI o Email ya se encuentra registrado en el sistema"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error crítico al crear alumno(s): {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

@app.put("/api/alumnos/{id}", tags=["Alumnos"])
def update_alumno(id: int, data: AlumnoUpdate, db: Session = Depends(database.get_db)):
    return update_db_user(id, data, db)

@app.delete("/api/alumnos/{id}", tags=["Alumnos"])
def delete_alumno(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.id == id).delete()
    db.commit()
    return {"status": "success"}

@app.get("/api/alumnos/{id}/historial-pagos", tags=["Alumnos"])
def get_alumno_pagos(id: int, db: Session = Depends(database.get_db)):
    """Trae todos los ingresos de caja vinculados a este alumno con manejo de errores."""
    try:
        pagos = db.query(models.MovimientoCaja).filter(
            models.MovimientoCaja.alumno_id == id,
            models.MovimientoCaja.tipo == "Ingreso"
        ).order_by(models.MovimientoCaja.fecha.desc()).all()
        
        return [{
            "id": p.id,
            "fecha": p.fecha.strftime("%d/%m/%Y") if p.fecha else "S/F",
            "descripcion": p.descripcion or "Cobro de Plan",
            "monto": float(p.monto) if p.monto else 0.0,
            "metodo": p.metodo_pago or "Efectivo",
            "nota": p.descripcion2 or ""
        } for p in pagos]
    except Exception as e:
        logger.error(f"Error al obtener historial del alumno {id}: {e}")
        # En lugar de 500, devolvemos lista vacía para que la app siga funcionando
        return []
    
@app.get("/api/alumnos/cumpleanios", tags=["Alumnos"])
def get_cumpleanios_hoy(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    try:
        # 1. Obtenemos el día y mes actual
        hoy = date.today()
        mes_hoy = hoy.month
        dia_hoy = hoy.day
        
        # 2. Traemos a los alumnos (usando el modelo Usuario que ya confirmamos que funciona)
        # Filtramos por perfil 'alumno' para no traer a todo el mundo
        alumnos = db.query(models.Usuario).join(models.Perfil).filter(
            func.lower(models.Perfil.nombre) == "alumno"
        ).all()
        
        cumpleanieros = []
        
        for al in alumnos:
            if al.fecha_nacimiento:
                # 3. Comparación manual de mes y día
                if al.fecha_nacimiento.month == mes_hoy and al.fecha_nacimiento.day == dia_hoy:
                    cumpleanieros.append({
                        "id": al.id,
                        "nombre_completo": al.nombre_completo,
                        "telefono": al.telefono or ""
                    })
        
        # 4. Log para que veas en Render qué está pasando
        print(f"DEBUG VIKINGO: Hoy es {dia_hoy}/{mes_hoy}. Se encontraron {len(cumpleanieros)} cumpleañeros.")
        
        return cumpleanieros

    except Exception as e:
        print(f"ERROR CRÍTICO CUMPLEANIOS: {str(e)}")
        return []

# --- RESERVAS ---
@app.get("/api/reservas", tags=["Reservas"])
def get_reservas(fecha: Optional[str] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Reserva).options(
        joinedload(models.Reserva.usuario),
        joinedload(models.Reserva.clase)
    )
    
    if fecha:
        try:
            target_date = datetime.strptime(fecha, "%Y-%m-%d").date()
            query = query.filter(models.Reserva.fecha_reserva == target_date)
        except ValueError:
            pass 

    res = query.all()
    
    return [{
        "id": r.id,
        "usuario_id": r.usuario_id,
        "clase_id": r.clase_id,
        "fecha_clase": r.fecha_reserva.isoformat() if r.fecha_reserva else None,
        "horario": r.horario,       
        "dia_semana": r.dia_semana, 
        "alumno_dni": r.usuario.dni if r.usuario else "N/A",
        "clase_nombre": r.clase.nombre if r.clase else "Eliminada"
    } for r in res]

@app.post("/api/reservas", tags=["Reservas"])
def book_clase(data: ReservaCreate, db: Session = Depends(database.get_db)):
    try:
        fecha_objeto = datetime.strptime(data.fecha_clase, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido.")

    # Buscamos al usuario con su plan
    user = db.query(models.Usuario).options(joinedload(models.Usuario.plan)).filter(models.Usuario.id == data.usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # 1. VALIDACIÓN DE PLAN VENCIDO
    if user.fecha_vencimiento and user.fecha_vencimiento < date.today():
        raise HTTPException(status_code=400, detail="Tu membresía ha vencido.")

    # 2. LÓGICA DE DOBLE BÚSQUEDA (NORMAL O FERIADO)
    clase = db.query(models.Clase).filter(models.Clase.id == data.clase_id).first()
    if not clase:
        clase = db.query(models.ClaseFeriado).filter(models.ClaseFeriado.id == data.clase_id).first()
    
    if not clase:
        raise HTTPException(status_code=404, detail="La clase no existe.")

    # 3. VALIDACIÓN DE CUPO POR BOLSA TOTAL (Ciclo completo: desde renovación hasta vencimiento)
    if user.plan:
        limite_total_plan = user.plan.clases_mensuales
        if limite_total_plan < 999:
            # Ventana de fechas del pase contratado por el alumno
            inicio_pase = user.fecha_ultima_renovacion if user.fecha_ultima_renovacion else date.today()
            fin_pase = user.fecha_vencimiento if user.fecha_vencimiento else date.today()

            # Contamos las reservas globales que ya consumió en cualquier sede durante este pase
            count_reservas = db.query(models.Reserva).filter(
                models.Reserva.usuario_id == user.id,
                models.Reserva.fecha_reserva >= inicio_pase,
                models.Reserva.fecha_reserva <= fin_pase
            ).count()
            
            if count_reservas >= limite_total_plan:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Límite alcanzado ({count_reservas}/{limite_total_plan} clases utilizadas en tu plan actual)."
                )

    # 4. VALIDACIÓN DE DUPLICADOS
    exists = db.query(models.Reserva).filter(
        models.Reserva.usuario_id == data.usuario_id,
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.horario == data.horario,
        models.Reserva.fecha_reserva == fecha_objeto
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Ya tienes este turno reservado.")

    # 5. VALIDACIÓN DE CUPO DE LA CLASE (Sede / Cupo del Box)
    cupo_actual = db.query(models.Reserva).filter(
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.horario == data.horario,
        models.Reserva.fecha_reserva == fecha_objeto
    ).count()
    
    if cupo_actual >= clase.capacidad_max:
        raise HTTPException(status_code=400, detail="Sin cupos disponibles.")

    # 6. GUARDADO CON SUCURSAL DE LA CLASE
    new_res = models.Reserva(
        usuario_id=data.usuario_id,
        clase_id=data.clase_id,
        fecha_reserva=fecha_objeto,
        horario=data.horario,      
        dia_semana=data.dia_semana,
        sucursal_id=clase.sucursal_id 
    )
    
    try:
        db.add(new_res)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al guardar.")

@app.delete("/api/reservas/{id}", tags=["Reservas"])
def cancel_reserva(id: int, db: Session = Depends(database.get_db)):
    reserva = db.query(models.Reserva).filter(models.Reserva.id == id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    db.delete(reserva)
    db.commit()
    return {"status": "success"}

# --- STAFF ---
@app.get("/api/profesores", response_model=List[UsuarioResponse], tags=["Staff"])
def list_profesores(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    query = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).join(models.Perfil).filter(
        func.lower(models.Perfil.nombre) == "profesor"
    )
    
    # 🛡️ SI NO ES ADMIN/SUPERVISOR, FILTRAR POR SU SEDE
    if current_user.perfil.nombre.lower() not in ["administrador", "supervisor"]:
        query = query.filter(models.Usuario.sucursal_id == current_user.sucursal_id)
    
    profs = query.all()
    for p in profs: p.rol_nombre = p.perfil.nombre
    return profs

@app.get("/api/administrativos", response_model=List[UsuarioResponse], tags=["Staff"])
def list_admins(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    query = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).join(models.Perfil).filter(
        func.lower(models.Perfil.nombre) == "administracion"
    )
    
    # 🛡️ SI NO ES ADMIN/SUPERVISOR, FILTRAR POR SU SEDE
    if current_user.perfil.nombre.lower() not in ["administrador", "supervisor"]:
        query = query.filter(models.Usuario.sucursal_id == current_user.sucursal_id)
    
    admins = query.all()
    for a in admins: a.rol_nombre = a.perfil.nombre
    return admins

@app.post("/api/staff", tags=["Staff"])
def create_staff(data: dict, db: Session = Depends(database.get_db)):
    """Crea personal asignándole la sucursal seleccionada en el modal."""
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == data['perfil_nombre']).first()
    if not perfil:
        raise HTTPException(status_code=400, detail="Perfil no válido")

    raw_password = str(data.get('password', data['dni'])).strip()
    
    new_staff = models.Usuario(
        nombre_completo=data['nombre_completo'].upper(), 
        dni=data['dni'], 
        email=data.get('email'),
        password_hash=get_password_hash(raw_password),
        perfil_id=perfil.id,
        especialidad=data.get('especialidad'),
        sucursal_id=data.get('sucursal_id') # <--- RECIBE EL ID DEL MODAL HTML
    )
    
    db.add(new_staff)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="DNI o Email ya registrado")
    return {"status": "success"}

@app.put("/api/staff/{id}", tags=["Staff"])
def update_staff(id: int, data: StaffUpdate, db: Session = Depends(database.get_db)):
    """
    Actualiza personal. 
    Nota: update_db_user ya maneja dinámicamente los campos de StaffUpdate (incluyendo sucursal_id).
    """
    return update_db_user(id, data, db)

@app.delete("/api/staff/{id}", tags=["Staff"])
def delete_staff(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Elimina personal asegurando que sea de la misma sucursal (por seguridad)."""
    resultado = db.query(models.Usuario).filter(
        models.Usuario.id == id,
        models.Usuario.sucursal_id == current_user.sucursal_id
    ).delete()
    
    db.commit()
    if resultado:
        return {"status": "success"}
    return {"status": "error", "message": "No se encontró el registro o pertenece a otra sede."}

# --- STOCK (MODIFICADO PARA MULTISUCURSAL) ---
@app.get("/api/stock", tags=["Inventario"])
def get_stock(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    rol = current_user.perfil.nombre.lower()
    
    # El Admin ve TODO el inventario de la cadena
    if rol in ["administrador", "dueño"]:
        return db.query(models.Stock).all()
    
    # El resto solo ve lo de SU sucursal
    return db.query(models.Stock).filter(models.Stock.sucursal_id == current_user.sucursal_id).all()

@app.post("/api/stock", tags=["Inventario"])
def create_stock(data: StockUpdate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """
    Crea un producto nuevo asignándolo automáticamente a la sucursal del usuario actual.
    """
    new_s = models.Stock(
        nombre_producto=data.nombre_producto, 
        stock_actual=data.stock_actual, 
        stock_inicial=data.stock_actual, # Guardamos la cantidad inicial para referencia
        precio_venta=data.precio_venta,
        url_imagen=data.url_imagen,
        sucursal_id=current_user.sucursal_id  # <--- VINCULACIÓN AUTOMÁTICA A LA SUCURSAL
    )
    db.add(new_s)
    db.commit()
    db.refresh(new_s) 
    
    return new_s

@app.put("/api/stock/{id}", tags=["Inventario"])
def update_stock(id: int, data: StockUpdate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """
    Actualiza un producto asegurando que pertenezca a la sucursal del usuario.
    """
    # Agregamos el filtro de sucursal_id por seguridad para que un admin no edite stock de otra sucursal por error
    s = db.query(models.Stock).filter(
        models.Stock.id == id, 
        models.Stock.sucursal_id == current_user.sucursal_id
    ).first()

    if s:
        s.nombre_producto = data.nombre_producto
        s.stock_actual = data.stock_actual
        s.precio_venta = data.precio_venta
        s.url_imagen = data.url_imagen 
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Producto no encontrado en esta sucursal"}

@app.delete("/api/stock/{id}", tags=["Inventario"])
def delete_stock(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """
    Elimina un producto validando la sucursal.
    """
    # Solo permite borrar si el ID existe Y pertenece a la sucursal del usuario
    resultado = db.query(models.Stock).filter(
        models.Stock.id == id, 
        models.Stock.sucursal_id == current_user.sucursal_id
    ).delete()
    
    db.commit()
    
    if resultado:
        return {"status": "success"}
    return {"status": "error", "message": "No se pudo eliminar: Producto no encontrado"}

# --- PLANES ---
@app.get("/api/planes", response_model=List[PlanSchema], tags=["Planes"])
def get_planes(db: Session = Depends(database.get_db)):
    try:
        # Traemos los planes y sus tipos
        planes = db.query(models.Plan).options(joinedload(models.Plan.tipo)).all()
        return planes
    except Exception as e:
        logger.error(f"Error Crítico Planes: {str(e)}")
        return []

@app.post("/api/planes", tags=["Planes"])
def create_plan(data: PlanUpdate, db: Session = Depends(database.get_db)):
    """Crea un nuevo plan maestro asociado a su tipo"""
    try:
        # Creamos el plan usando SOLAMENTE las columnas que existen en tu tabla 'planes'
        # Según tu imagen: nombre, efectivo, transferencia, debito_credito, tipo_plan_id, clases_mensuales
        new_p = models.Plan(
            nombre=data.nombre,
            efectivo=data.efectivo,
            transferencia=data.transferencia,
            debito_credito=data.debito_credito, # SQLAlchemy mapea esto a "Debito/Credito"
            tipo_plan_id=data.tipo_plan_id,
            clases_mensuales=data.clases_mensuales
            # BORRAMOS LA LINEA 'dias=data.dias' PORQUE ES LA QUE DA EL ERROR
        )
        
        db.add(new_p)
        db.commit()
        db.refresh(new_p)
        return {"status": "success"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error al guardar plan: {str(e)}")
        # Si algo falla, el Toast te va a decir el mensaje real de la DB
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")

@app.put("/api/planes/{id}", tags=["Planes"])
def update_plan(id: int, data: PlanUpdate, db: Session = Depends(database.get_db)):
    """Actualiza la configuración de un plan existente de forma segura"""
    p = db.query(models.Plan).filter(models.Plan.id == id).first()
    if p:
        p.nombre = data.nombre
        p.efectivo = data.efectivo
        p.transferencia = data.transferencia
        p.debito_credito = data.debito_credito  # Mapea directo a tu alias "Debito/Credito"
        p.tipo_plan_id = data.tipo_plan_id
        p.clases_mensuales = data.clases_mensuales
        
        try:
            db.commit()
            return {"status": "success"}
        except Exception as e:
            db.rollback()
            logger.error(f"Error actualizando plan ID {id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Falla en Base de Datos: {str(e)}")
            
    return {"status": "error", "message": "Plan no encontrado"}

@app.delete("/api/planes/{id}", tags=["Planes"])
def delete_plan(id: int, db: Session = Depends(database.get_db)):
    """Elimina un plan y limpia la referencia en los alumnos"""
    db.query(models.Usuario).filter(models.Usuario.plan_id == id).update({"plan_id": None}) 
    db.query(models.Plan).filter(models.Plan.id == id).delete()
    db.commit()
    return {"status": "success"}

@app.get("/api/tipos-planes", response_model=List[TipoPlanSchema], tags=["Planes"])
def get_tipos(db: Session = Depends(database.get_db)):
    """Obtiene la lista de tipos (Mensual, Trimestral, etc)"""
    return db.query(models.TipoPlan).all()

# --- CONFIGURACIONES ---
@app.get("/api/tipo_box", tags=["Configuracion"])
def get_tipo_box(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Retorna la lista de TODOS los boxes (Global para todas las sucursales)."""
    # ⚔️ ELIMINAMOS EL FILTRO: Ahora trae todos los registros de la tabla TipoBox
    # sin importar a qué sucursal pertenezca el usuario logueado.
    return db.query(models.TipoBox).all()

@app.get("/api/sucursales", tags=["Configuracion"])
def get_todas_sucursales(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Retorna todas las sucursales registradas para llenar selectores."""
    # Solo permitimos que los logueados vean la lista de sedes
    return db.query(models.Sucursal).all()

# --- CLASES ---
# Modificá este endpoint en tu MAIN.PY
@app.get("/api/clases", tags=["Clases"])
def get_clases(db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Retorna las clases FILTRADAS por la sede del usuario logueado."""
    query = db.query(models.Clase).options(joinedload(models.Clase.box_rel))
    
    # ⚔️ FILTRO ACTUALIZADO: Admin, Alumno y Staff (Administrativo) ven todo.
    # Los Profesores (Coach) siguen viendo solo su sede para no marearse.
    rol = current_user.perfil.nombre.lower()
    roles_que_ven_todo = ["administrador", "alumno", "staff", "administracion"]
    
    if rol not in roles_que_ven_todo:
        query = query.filter(models.Clase.sucursal_id == current_user.sucursal_id)
    
    clases = query.all()
    
    result = []
    for c in clases:
        result.append({
            "id": c.id,
            "nombre": c.nombre,
            "coach": c.coach,
            "color": c.color,
            "capacidad_max": c.capacidad_max,
            "horarios_detalle": c.horarios_detalle,
            "box_id": c.box_id,
            "box_nombre": c.box_rel.nombre if c.box_rel else "Principal",
            "sucursal_id": c.sucursal_id 
        })
    return result

@app.post("/api/clases", tags=["Clases"])
def create_clase(data: ClaseUpdate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Crea una nueva clase. El Admin puede elegir sede, el resto usa la propia."""
    
    # Determinamos la sucursal final
    final_sucursal_id = current_user.sucursal_id
    
    # 🛡️ Si el que crea es Admin y envió una sucursal en el JSON, usamos esa
    if current_user.perfil.nombre.lower() in ["administrador", "supervisor"] and hasattr(data, 'sucursal_id'):
        if data.sucursal_id:
            final_sucursal_id = data.sucursal_id

    new_c = models.Clase(
        nombre=data.nombre,
        coach=data.coach,
        box_id=data.box_id,
        color=data.color,
        capacidad_max=data.capacidad_max,
        horarios_detalle=data.horarios_detalle,
        sucursal_id=final_sucursal_id
    )
    db.add(new_c)
    db.commit()
    return {"status": "success"}

@app.put("/api/clases/{id}", tags=["Clases"])
def update_clase(id: int, data: ClaseUpdate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Actualiza una clase validando permisos de sucursal o admin."""
    query = db.query(models.Clase).filter(models.Clase.id == id)
    
    # 🛡️ Si NO es Admin/Supervisor, solo puede editar lo de su sucursal
    if current_user.perfil.nombre.lower() not in ["administrador", "supervisor"]:
        query = query.filter(models.Clase.sucursal_id == current_user.sucursal_id)
    
    c = query.first()
    
    if c:
        c.nombre = data.nombre
        c.coach = data.coach
        c.box_id = data.box_id
        c.color = data.color
        c.capacidad_max = data.capacidad_max
        c.horarios_detalle = data.horarios_detalle 
        flag_modified(c, "horarios_detalle")
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "No tenés permiso para editar esta clase"}

@app.put("/api/clases/{id}/move", tags=["Clases"])
def move_clase(id: int, data: ClaseMove, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Mueve el horario validando sucursal o permisos de admin."""
    query = db.query(models.Clase).filter(models.Clase.id == id)
    
    if current_user.perfil.nombre.lower() not in ["administrador", "supervisor"]:
        query = query.filter(models.Clase.sucursal_id == current_user.sucursal_id)
    
    c = query.first()
    
    if not c:
        raise HTTPException(status_code=404, detail="No tenés permiso para mover esta clase")
    
    # ... (el resto de tu lógica de horarios_detalle queda igual) ...
    horarios = list(c.horarios_detalle) if c.horarios_detalle else []
    encontrado = False
    for slot in horarios:
        if slot.get('dia') == data.old_dia and float(slot.get('horario')) == float(data.old_horario):
            slot['dia'] = data.new_dia
            slot['horario'] = data.new_horario
            encontrado = True
            break
    
    if encontrado:
        c.horarios_detalle = horarios
        flag_modified(c, "horarios_detalle")
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "No se encontró el horario original"}

@app.delete("/api/clases/{id}", tags=["Clases"])
def delete_clase(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Elimina una clase verificando sucursal o admin."""
    query = db.query(models.Clase).filter(models.Clase.id == id)
    
    if current_user.perfil.nombre.lower() not in ["administrador", "supervisor"]:
        query = query.filter(models.Clase.sucursal_id == current_user.sucursal_id)
    
    resultado = query.delete()
    db.commit()
    
    if resultado:
        return {"status": "success"}
    return {"status": "error", "message": "No tenés permiso para eliminar esta clase"}

# ==========================================
# MÓDULO DE FERIADOS (LIMPIO Y SIN DUPLICADOS)
# ==========================================

# 1. MARCAR EL DÍA EN EL CALENDARIO (TABLA: dias_especiales)
@app.get("/api/feriados", tags=["Feriados"])
def get_feriados(db: Session = Depends(database.get_db)):
    return db.query(models.DiaEspecial).all()

@app.post("/api/feriados", tags=["Feriados"])
def create_feriado(data: dict, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    try:
        # Extraemos los datos del JSON
        fecha_str = data.get("fecha")
        motivo = data.get("motivo")
        abierto = data.get("abierto", False)
        
        # PRIORIDAD DE SEDE: La que viene del front o, en su defecto, la del usuario
        sede_id = data.get("sucursal_id") or current_user.sucursal_id
        
        # Fix Zona Horaria: Tomamos solo la fecha pura
        fecha_dt = datetime.strptime(fecha_str, "%Y-%m-%d").date()
        
        # ⚔️ PASO 1: LIMPIEZA TOTAL (Lo que me pediste)
        # Borramos las clases especiales previas para esta fecha y sede antes de marcar el nuevo feriado
        db.query(models.ClaseFeriado).filter(
            models.ClaseFeriado.fecha == fecha_dt,
            models.ClaseFeriado.sucursal_id == sede_id
        ).delete()
        
        # ⚔️ PASO 2: FILTRO VIKINGO (Buscamos si ya existe el registro de día especial)
        existente = db.query(models.DiaEspecial).filter(
            models.DiaEspecial.fecha == fecha_dt,
            models.DiaEspecial.sucursal_id == sede_id
        ).first()

        if existente:
            existente.motivo = motivo
            existente.abierto = abierto
            db.commit()
            return {"status": "success", "message": "Día limpiado y feriado de sede actualizado"}

        # Si no existe para esa sede, lo creamos nuevo con su sucursal_id
        nuevo = models.DiaEspecial(
            fecha=fecha_dt, 
            motivo=motivo, 
            abierto=abierto,
            sucursal_id=sede_id
        )
        db.add(nuevo)
        db.commit()
        return {"status": "success", "message": "Día limpiado y feriado de sede creado"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")

# 2. LAS CLASES QUE SE DAN ESE DÍA (TABLA: clases_feriado)
@app.get("/api/clases-feriado", tags=["Feriados"])
def get_clases_feriado(fecha: Optional[str] = None, sucursal_id: Optional[int] = None, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    query = db.query(models.ClaseFeriado)
    
    # 🛡️ FILTRO DE SEDE: 
    # 1. Si viene un sucursal_id por parámetro (Admin viendo otra sede), filtramos por ese.
    # 2. Si no viene y no es Admin, filtramos por la sede del usuario.
    # 3. Si es Admin y no viene parámetro, traemos todas (o podés forzar una).
    
    target_sede = sucursal_id if sucursal_id else current_user.sucursal_id
    
    if current_user.perfil.nombre.lower() != "administrador" or target_sede:
        query = query.filter(models.ClaseFeriado.sucursal_id == target_sede)

    if fecha:
        try:
            fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
            query = query.filter(models.ClaseFeriado.fecha == fecha_dt)
        except:
            pass
            
    return query.all()

@app.post("/api/clases-feriado", tags=["Feriados"])
def create_clase_feriado(data: ClaseFeriadoCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    try:
        fecha_dt = datetime.strptime(data.fecha, "%Y-%m-%d").date()
        
        # ⚔️ CAPTURA DE SEDE: Si no viene en el data, usamos la del usuario
        sede_id = data.sucursal_id if data.sucursal_id else current_user.sucursal_id

        nueva = models.ClaseFeriado(
            fecha=fecha_dt, 
            nombre=data.nombre, 
            horario=data.horario, 
            capacidad_max=data.capacidad_max,
            color=data.color,
            sucursal_id=sede_id  # <--- ESTO ES LO QUE TE FALTA PARA QUE NO SEA NULL
        )
        db.add(nueva)
        db.commit()
        return {"status": "success", "message": "Clase especial creada en sede"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# 3. ELIMINAR FERIADO
@app.delete("/api/feriados/{id}", tags=["Feriados"])
def delete_feriado(id: int, db: Session = Depends(database.get_db)):
    db.query(models.DiaEspecial).filter(models.DiaEspecial.id == id).delete()
    db.commit()
    return {"status": "success"}

# MÓDULO DE COMPROBANTES (FACTURACIÓN A)
@app.post("/api/cobros/comprobante", response_model=ComprobanteResponse, tags=["Comprobantes"])
async def crear_comprobante(obj: ComprobanteCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    try:
        ultimo = db.query(models.Comprobante).order_by(models.Comprobante.id.desc()).first()
        nuevo_numero = 1
        if ultimo and ultimo.nro_factura:
            try:
                partes = ultimo.nro_factura.split("-")
                if len(partes) > 1:
                    nuevo_numero = int(partes[1]) + 1
            except:
                nuevo_numero = 1
        
        formateado = f"0001-{str(nuevo_numero).zfill(8)}"

        # Validamos el ID de movimiento para que no rompa la FK
        p_id = obj.pago_id if obj.pago_id > 0 else None

        nuevo_comprobante = models.Comprobante(
            movimiento_id=p_id,
            usuario_id=obj.usuario_id if obj.usuario_id > 0 else None,
            nro_factura=formateado,
            monto_total=float(obj.monto_total), # Forzamos float
            metodo_pago=obj.metodo_pago,
            nro_ticket_postnet=str(obj.nro_ticket_postnet),
            plan_nombre_snapshot=obj.plan_nombre_snapshot[:100], # Limitamos largo
            sucursal_id=current_user.sucursal_id
        )
        
        db.add(nuevo_comprobante)
        db.commit()
        db.refresh(nuevo_comprobante)
        return nuevo_comprobante
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/comprobantes/usuario/{usuario_id}", tags=["Comprobantes"])
def get_comprobantes_alumno(usuario_id: int, db: Session = Depends(database.get_db)):
    """Trae todas las facturas generadas para un alumno específico."""
    facturas = db.query(models.Comprobante).filter(models.Comprobante.usuario_id == usuario_id).order_by(models.Comprobante.id.desc()).all()
    return facturas

@router.get("/comprobantes/{comprobante_id}/pdf")
async def descargar_pdf_comprobante(comprobante_id: int):
    # Aquí la lógica que ya tienes para generar el PDF
    # pero en lugar de abrirlo en el navegador del admin, 
    # lo devuelve como un StreamingResponse o FileResponse.
    # Por ahora, usaremos esta URL como base.
    return {"url": f"https://tu-api.com/comprobantes/{comprobante_id}/pdf"}

from fastapi.responses import HTMLResponse

# ⚔️ ASEGURATE QUE LA RUTA EMPIECE CON /api PARA COINCIDIR CON EL FRONT
@app.get("/api/comprobantes/{comprobante_id}/view", response_class=HTMLResponse, tags=["Comprobantes"])
async def ver_comprobante_alumno(comprobante_id: int, db: Session = Depends(database.get_db)):
    # 1. Buscamos el comprobante por ID real de la tabla
    c = db.query(models.Comprobante).filter(models.Comprobante.id == comprobante_id).first()
    
    if not c:
        # Si no lo encuentra, tiramos error 404
        raise HTTPException(status_code=404, detail="Comprobante no encontrado en la base de datos")
    
    # 2. Buscamos al alumno para los datos del encabezado
    alumno = db.query(models.Usuario).filter(models.Usuario.id == c.usuario_id).first()
    nombre_al = alumno.nombre_completo if alumno else "Consumidor Final"
    dni_al = alumno.dni if alumno else "---"

    # 3. HTML Vikingo Optimizado para Celulares
    html_content = f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>Comprobante {c.nro_factura}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body class="bg-zinc-900 p-4 font-sans text-zinc-900">
            <div class="max-w-md mx-auto bg-white border-t-8 border-red-600 p-6 shadow-2xl rounded-b-xl">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <h1 class="text-xl font-black italic text-red-600">GYMFIT PRO</h1>
                        <p class="text-[9px] font-bold uppercase text-zinc-400">Comprobante de Pago</p>
                    </div>
                    <div class="text-right text-[10px]">
                        <p class="font-black uppercase">Factura A</p>
                        <p class="text-red-600 font-bold">{c.nro_factura}</p>
                        <p>{c.fecha_emision.strftime('%d/%m/%Y')}</p>
                    </div>
                </div>

                <div class="mb-8 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                    <p class="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Guerrero</p>
                    <p class="font-bold text-sm uppercase">{nombre_al}</p>
                    <p class="text-[10px] text-zinc-500">DNI: {dni_al}</p>
                </div>

                <div class="space-y-4 mb-8">
                    <div class="flex justify-between items-center text-sm border-b border-zinc-100 pb-2">
                        <span class="text-zinc-500">{c.plan_nombre_snapshot}</span>
                        <span class="font-bold">$ {c.monto_total:,.2f}</span>
                    </div>
                </div>

                <div class="text-center py-6 bg-zinc-50 rounded-2xl mb-6">
                    <p class="text-[10px] font-bold text-zinc-400 uppercase mb-1">Total Abonado</p>
                    <p class="text-4xl font-black italic tracking-tighter text-zinc-900">$ {c.monto_total:,.2f}</p>
                    <p class="text-[9px] font-bold text-red-600 uppercase mt-2 italic">{c.metodo_pago}</p>
                </div>

                <div class="text-[8px] text-zinc-400 text-center italic leading-tight">
                    <p>Av. Suarez 1581, CABA • CUIT: 20371620819</p>
                    <p class="mt-2 text-[7px] uppercase">Documento de control interno no válido como factura fiscal AFIP.</p>
                </div>
                
                <button onclick="window.print()" class="w-full mt-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase italic rounded-xl shadow-lg shadow-red-600/20 no-print">
                    Descargar Comprobante
                </button>
            </div>
            <style>@media print {{ .no-print {{ display: none; }} }}</style>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# --- CAJA ---
@app.get("/api/caja/resumen", tags=["Finanzas"])
def get_caja_resumen(sucursal_id: Optional[int] = None, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """
    Calcula el resumen financiero leyendo correctamente la tabla perfiles.
    """
    # Buscamos el nombre en la relación 'perfil' que apunta a la tabla perfiles
    rol = current_user.perfil.nombre if current_user.perfil else ""
    rol = str(rol).strip()
    
    query_ing = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Ingreso")
    query_egr = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Egreso")

    # Si es Administrador (mapeado de la DB), salta el cerrojo de sucursal
    if rol.lower() in ["administrador", "admin", "dueño", "supervisor"]:
        if sucursal_id and sucursal_id > 0:
            query_ing = query_ing.filter(models.MovimientoCaja.sucursal_id == sucursal_id)
            query_egr = query_egr.filter(models.MovimientoCaja.sucursal_id == sucursal_id)
    else:
        query_ing = query_ing.filter(models.MovimientoCaja.sucursal_id == current_user.sucursal_id)
        query_egr = query_egr.filter(models.MovimientoCaja.sucursal_id == current_user.sucursal_id)

    ing = query_ing.scalar() or 0
    egr = query_egr.scalar() or 0
    
    return {"ingresos": float(ing), "gastos": float(egr), "balance": float(ing - egr)}

@app.get("/api/caja/movimientos", tags=["Caja"])
def get_movimientos(
    sucursal_id: Optional[int] = None, 
    fecha_desde: Optional[str] = None, 
    fecha_hasta: Optional[str] = None, 
    db: Session = Depends(database.get_db), 
    current_user = Depends(get_current_user)
):
    """
    Lista movimientos interactuando con la tabla perfiles de models.py
    """
    try:
        # ⚔️ Mapeo real de la relación perfiles -> columna nombre
        rol = current_user.perfil.nombre if current_user.perfil else ""
        rol = str(rol).strip()
        
        print("\n" + "="*50)
        print("⚔️ DETECCIÓN DE CONTROL DE CAJA COMPLETO ⚔️")
        print(f"USUARIO LOGUEADO : {getattr(current_user, 'nombre_completo', 'S/N')}")
        print(f"PERFIL DB REAL   : '{rol}'")
        print(f"SUCURSAL USER DB : {getattr(current_user, 'sucursal_id', 'S/S')}")
        print(f"SUCURSAL FRONT   : {sucursal_id}")
        print("="*50)

        query = db.query(models.MovimientoCaja)

        if rol.lower() in ["administrador", "admin", "dueño", "supervisor"]:
            if sucursal_id is not None and sucursal_id > 0:
                query = query.filter(models.MovimientoCaja.sucursal_id == sucursal_id)
                print("💥 ACCIÓN: Es Admin -> Filtrando por la sucursal elegida")
            else:
                print("💥 ACCIÓN: Es Admin -> Viendo TODO global sin restricciones")
        else:
            query = query.filter(models.MovimientoCaja.sucursal_id == current_user.sucursal_id)
            print(f"💥 ACCIÓN: Es Personal -> Forzando bloqueo a sucursal {current_user.sucursal_id}")
        print("="*50 + "\n")

        # Filtro de fechas
        if fecha_desde:
            query = query.filter(models.MovimientoCaja.fecha >= f"{fecha_desde} 00:00:00")
        if fecha_hasta:
            query = query.filter(models.MovimientoCaja.fecha <= f"{fecha_hasta} 23:59:59")

        movs = query.order_by(models.MovimientoCaja.fecha.desc()).limit(500).all()
        return movs
    except Exception as e:
        logger.error(f"Error Crítico Caja: {str(e)}")
        return []

@app.post("/api/caja/movimiento", tags=["Finanzas"])
def create_movimiento(data: MovimientoCajaCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Crea un movimiento manual de caja asignado a la sucursal actual."""
    new_mov = models.MovimientoCaja(
        tipo=data.tipo,
        monto=abs(data.monto),
        descripcion=data.descripcion,
        descripcion2=data.descripcion2,
        metodo_pago=data.metodo_pago,
        sucursal_id=current_user.sucursal_id,  # VINCULACIÓN AUTOMÁTICA
        fecha=datetime.now()
    )
    db.add(new_mov)
    db.commit()
    return {"status": "success"}

@app.post("/api/caja/movimientos", tags=["Caja"])
def crear_movimiento_caja(mov: MovimientoCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Registra gastos o compras vinculados a la sucursal actual."""
    tipo_final = "Egreso" if mov.tipo in ["Gasto", "Compra", "Egreso"] else mov.tipo
    
    nuevo_movimiento = models.MovimientoCaja(
        descripcion=mov.descripcion,
        descripcion2=mov.descripcion2,
        monto=abs(mov.monto),
        tipo=tipo_final,
        metodo_pago=mov.metodo_pago,
        cuotas=mov.cuotas,
        producto_id=mov.producto_id,
        cantidad=mov.cantidad,
        sucursal_id=current_user.sucursal_id,  # VINCULACIÓN AUTOMÁTICA
        fecha=datetime.now()
    )
    
    db.add(nuevo_movimiento)
    db.commit()
    db.refresh(nuevo_movimiento)
    
    return {
        "status": "success", 
        "mensaje": "Movimiento registrado con éxito", 
        "id": nuevo_movimiento.id
    }

# --- PROCESAR COBROS ---
@app.post("/api/cobros/procesar", tags=["Finanzas"])
def procesar_cobro(data: TransactionCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """Lógica de cobros que respeta el inventario y caja por sucursal."""
    try:
        # 1. Registro automático en Caja de la sucursal actual
        nueva_transaccion = models.MovimientoCaja(
            tipo="Ingreso", 
            monto=abs(data.monto),
            descripcion=data.descripcion or f"Cobro: {data.tipo}",
            descripcion2=data.descripcion2,
            metodo_pago=data.metodo_pago,
            cuotas=data.cuotas,
            alumno_id=data.alumno_id,
            producto_id=data.producto_id,
            cantidad=data.cantidad,
            sucursal_id=current_user.sucursal_id,  # EL COBRO VA A LA CAJA DE ESTA SUCURSAL
            fecha=datetime.now()
        )
        db.add(nueva_transaccion)

        # 2. Lógica de Stock (Verificamos que el producto sea de ESTA sucursal)
        if (data.tipo == "Mercaderia" or "ercader" in data.tipo.lower()) and data.producto_id:
            producto = db.query(models.Stock).filter(
                models.Stock.id == data.producto_id,
                models.Stock.sucursal_id == current_user.sucursal_id
            ).first()
            
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado en esta sucursal")
            
            producto.stock_actual -= data.cantidad
            
        # 3. Lógica de Planes (Independiente de sucursal pero registrada en caja local)
        if (data.tipo == "Plan" or "plan" in data.tipo.lower()) and data.alumno_id:
            alumno = db.query(models.Usuario).filter(models.Usuario.id == data.alumno_id).first()
            plan = db.query(models.Plan).options(joinedload(models.Plan.tipo)).filter(models.Plan.id == data.producto_id).first()

            if alumno and plan:
                hoy = date.today()
                dias_duracion = plan.tipo.duracion_dias if (plan.tipo and plan.tipo.duracion_dias) else 30
                base_fecha = max(hoy, alumno.fecha_vencimiento) if alumno.fecha_vencimiento else hoy
                
                alumno.fecha_ultima_renovacion = hoy
                alumno.fecha_vencimiento = base_fecha + timedelta(days=dias_duracion)
                alumno.estado_cuenta = "Activo"
                alumno.plan_id = plan.id
                # Importante: opcionalmente podrías actualizar la sucursal_id del alumno 
                # a la sucursal donde está pagando ahora, si quisieras.

        db.commit()
        return {"status": "success", "message": "Cobro procesado correctamente"}

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando cobro: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# --- MUSCULACIÓN (MODULO ACTUALIZADO Y SINCRONIZADO) ---
@app.get("/api/rutinas/grupos-musculares", tags=["Musculación"])
def get_grupos(db: Session = Depends(database.get_db)):
    return db.query(models.GrupoMuscular).all()

@app.get("/api/rutinas/ejercicios", tags=["Musculación"])
def get_ejercicios(db: Session = Depends(database.get_db)):
    return db.query(models.Ejercicio).options(joinedload(models.Ejercicio.grupo_muscular)).all()

@app.post("/api/rutinas/grupos-musculares", tags=["Musculación"])
def create_grupo(data: dict, db: Session = Depends(database.get_db)):
    nuevo = models.GrupoMuscular(nombre=data['nombre'])
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@app.post("/api/rutinas/ejercicios", tags=["Musculación"])
def create_ejercicio_lib(data: EjercicioCreate, db: Session = Depends(database.get_db)):
    nuevo = models.Ejercicio(nombre=data.nombre, grupo_muscular_id=data.grupo_muscular_id)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@app.post("/api/rutinas/plan", tags=["Musculación"])
def create_plan_rutina(data: PlanRutinaCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_user)):
    """
    Crea un nuevo Plan Maestro de Rutina.
    Sincronizado con tablas: planes_rutina, rutina_dias, ejercicios_en_rutina, series_ejercicios.
    """
    try:
        # 1. Validar existencia del alumno
        user = db.query(models.Usuario).filter(models.Usuario.id == data.usuario_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # 2. Bloqueo de seguridad: No se crean rutinas si está vencido
        if user.fecha_vencimiento and user.fecha_vencimiento < date.today():
            raise HTTPException(
                status_code=400, 
                detail="Membresía vencida. No se puede asignar rutina."
            )

        # 3. Desactivar planes anteriores
        db.query(models.PlanRutina).filter(
            models.PlanRutina.usuario_id == data.usuario_id
        ).update({"activo": False}, synchronize_session=False)
        
        # 4. Crear planes_rutina
        nuevo_plan = models.PlanRutina(
            usuario_id=data.usuario_id,
            nombre_grupo=data.nombre_grupo,
            objetivo=data.objetivo,
            descripcion=data.descripcion,
            tipo=data.tipo,
            tipo_id=2 if data.tipo == 'progresiva' else 1,
            profesor_nombre=current_user.nombre_completo,
            fecha_vencimiento=data.fecha_vencimiento,
            activo=True,
            fecha_creacion=date.today()
        )
        db.add(nuevo_plan)
        db.flush() 
        
        # 5. Crear rutina_dias
        for d in data.dias:
            nuevo_dia = models.DiaRutina(
                rutina_id=nuevo_plan.id, 
                nombre_dia=d.nombre_dia
            )
            db.add(nuevo_dia)
            db.flush()
            
            lista_ejercicios = d.ejercicios if d.ejercicios else []
            
            for e in lista_ejercicios:
                # 6. Crear ejercicios_en_rutina
                ej_en_rut = models.EjercicioEnRutina(
                    dia_id=nuevo_dia.id,
                    ejercicio_id=e.ejercicio_id,
                    rutina_id=nuevo_plan.id,
                    semana_id=e.semana_id,
                    comentario=e.comentario,
                    comentarios=e.comentario,
                    progreso_json=e.progreso_json
                )
                db.add(ej_en_rut)
                db.flush()

                # 7. Crear series_ejercicios
                if e.series:
                    for s in e.series:
                        nueva_serie = models.SerieEjercicio(
                            ejercicio_en_rutina_id=ej_en_rut.id,
                            numero_serie=s.numero_serie,
                            repeticiones=s.repeticiones,
                            peso=s.peso,
                            descanso=s.descanso
                        )
                        db.add(nueva_serie)
        
        db.commit()
        return {"status": "success", "id": nuevo_plan.id, "message": "¡Rutina forjada!"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error en Rutinas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Falla en el servidor: {str(e)}")

@app.get("/api/rutinas/usuario/{id}", response_model=Optional[PlanRutinaResponse], tags=["Musculación"])
def get_rutina_activa(id: int, db: Session = Depends(database.get_db)):
    # --- VERIFICACIÓN DE PLAN VENCIDO PARA VER RUTINA ---
    user = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    if not user or (user.fecha_vencimiento and user.fecha_vencimiento < date.today()):
        return None 

    return db.query(models.PlanRutina).filter(
        models.PlanRutina.usuario_id == id, 
        models.PlanRutina.activo == True
    ).options(
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.ejercicio_obj),
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.series_detalle)
    ).first()

@app.get("/api/rutinas/historial/{id}", response_model=List[PlanRutinaResponse], tags=["Musculación"])
def get_historial_rutinas(id: int, db: Session = Depends(database.get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    if not user or (user.fecha_vencimiento and user.fecha_vencimiento < date.today()):
        return [] 

    return db.query(models.PlanRutina).filter(
        models.PlanRutina.usuario_id == id
    ).options(
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.ejercicio_obj),
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.series_detalle)
    ).order_by(models.PlanRutina.fecha_creacion.desc()).all()

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)