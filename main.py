import os
import logging
import hashlib
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy import func, extract, text
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional, Union
from pydantic import BaseModel
from datetime import datetime, timedelta, date

# Librerías para Seguridad (JWT y Hashing de contraseñas)
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuración de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import models
import database
from database import Base

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
    """Valida el token y devuelve el usuario actual"""
    try:
        payload = jwt.decode(auth.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        dni: str = payload.get("sub")
        if dni is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Sesión expirada o token corrupto")
    
    user = db.query(models.Usuario).filter(models.Usuario.dni == dni).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

# ==========================================
# PARCHE DE BASE DE DATOS (AUTO-FIX)
# ==========================================
@app.on_event("startup")
def startup_event():
    """
    Este script se ejecuta al iniciar el servidor.
    Intenta eliminar las restricciones UNIQUE antiguas de la tabla reservas
    que impiden reservar la misma clase en diferentes días.
    """
    db = database.SessionLocal()
    try:
        constraints_to_drop = [
            "reservas_usuario_id_clase_id_key",             # Nombre default común
            "reservas_usuario_id_clase_id_fecha_reserva_key", # Variante con fecha
            "_usuario_clase_uc"                             # Nombre custom si se usó models
        ]
        
        logger.info("--- INICIANDO CORRECCIÓN DE RESTRICCIONES DE BD ---")
        for constraint in constraints_to_drop:
            try:
                db.execute(text(f"ALTER TABLE reservas DROP CONSTRAINT IF EXISTS {constraint}"))
                db.commit()
                logger.info(f"Restricción eliminada (si existía): {constraint}")
            except (ProgrammingError, IntegrityError) as e:
                db.rollback()
                logger.info(f"No se pudo eliminar {constraint} (probablemente no existe o nombre incorrecto).")
            except Exception as e:
                db.rollback()
                logger.warning(f"Error genérico al intentar limpiar constraint {constraint}: {e}")
                
        logger.info("--- CORRECCIÓN DE BD COMPLETADA ---")
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
    # --- NUEVOS CAMPOS EN RESPUESTA ---
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    fecha_nacimiento: Optional[str] = None
    edad: Optional[int] = None
    certificado_entregado: bool = False
    fecha_certificado: Optional[str] = None

# --- NUEVO: Schema para Validación de QR ---
class AccessCheck(BaseModel):
    qr_data: str # Recibirá el formato "DNI:HASH" contenido en el código QR

class TipoPlanSchema(BaseModel):
    id: int
    nombre: str
    duracion_dias: int
    class Config: from_attributes = True

class PlanSchema(BaseModel):
    id: int
    nombre: str
    precio: float
    clases_mensuales: int  
    tipo_plan_id: Optional[int]
    tipo: Optional[TipoPlanSchema] = None
    class Config: from_attributes = True

class UsuarioResponse(BaseModel):
    id: int
    nombre_completo: str
    dni: str
    email: Optional[str]
    rol_nombre: Optional[str] = None
    plan: Optional[PlanSchema] = None
    plan_id: Optional[int] = None
    estado_cuenta: Optional[str] = "Al día"
    fecha_vencimiento: Optional[date] = None
    fecha_ultima_renovacion: Optional[date] = None
    especialidad: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    edad: Optional[int] = None
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    certificado_entregado: bool = False
    fecha_certificado: Optional[date] = None
    
    class Config: from_attributes = True

class AlumnoUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    dni: Optional[str] = None
    email: Optional[str] = None
    plan_id: Optional[int] = None
    password: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    edad: Optional[int] = None
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    certificado_entregado: Optional[bool] = None
    fecha_certificado: Optional[date] = None
    fecha_ultima_renovacion: Optional[date] = None
    fecha_vencimiento: Optional[date] = None

class StaffUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    dni: Optional[str] = None
    email: Optional[str] = None
    especialidad: Optional[str] = None
    perfil_nombre: Optional[str] = None
    password: Optional[str] = None

class StockUpdate(BaseModel):
    nombre_producto: str
    stock_actual: int
    precio_venta: float
    url_imagen: Optional[str] = None 

class PlanUpdate(BaseModel):
    nombre: str
    precio: float
    tipo_plan_id: int
    clases_mensuales: Optional[int] = 12 

class ClaseUpdate(BaseModel):
    nombre: str
    coach: str
    color: Optional[str] = "#FF0000"
    capacidad_max: Optional[int] = 40
    horarios_detalle: Optional[List[dict]] = None

class ClaseMove(BaseModel):
    old_dia: int
    old_horario: float
    new_dia: int
    new_horario: float

class MovimientoCajaCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: str
    metodo_pago: Optional[str] = "Efectivo"

class MovimientoCreate(BaseModel):
    descripcion: str
    monto: float
    tipo: str  
    metodo_pago: str = "Efectivo"

class TransactionCreate(BaseModel):
    tipo: str  # 'Plan' o 'Mercaderia'
    monto: float
    descripcion: str
    metodo_pago: str  # 'Efectivo', 'Transferencia', 'Tarjeta'
    alumno_id: Optional[int] = None
    producto_id: Optional[int] = None
    cantidad: int = 1

# --- SCHEMAS RUTINAS ---
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
    descripcion: Optional[str] = None
    objetivo: str
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
    series: List[SerieCreate]
    comentario: Optional[str] = ""

class DiaRutinaCreate(BaseModel):
    nombre_dia: str
    ejercicios: Optional[List[EjercicioEnRutinaCreate]] = None 
    
class PlanRutinaCreate(BaseModel):
    usuario_id: int
    nombre_grupo: Optional[str] = "Nueva Rutina"
    descripcion: Optional[str] = ""
    objetivo: str
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

@app.get("/", tags=["Sistema"])
def api_root():
    return {"status": "Vikingo Strength Hub API is running", "version": "2.5.0"}

@app.get("/app", tags=["Sistema"])
async def serve_app():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"message": "Frontend file not found"}

# --- LOGIN (RESTAURADO COMPLETO) ---
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
    
    # Devolver el payload completo que el frontend necesita para el QR y el perfil
    return {
        "access_token": token,
        "token_type": "bearer",
        "id": user.id, 
        "nombre_completo": user.nombre_completo, 
        "dni": user.dni, 
        "email": user.email,
        "rol_nombre": user.perfil.nombre if user.perfil else "Usuario",
        "plan": {
            "id": user.plan.id,
            "nombre": user.plan.nombre,
            "precio": user.plan.precio,
            "clases_mensuales": user.plan.clases_mensuales 
        } if user.plan else None,
        "plan_id": user.plan_id,
        "fecha_vencimiento": user.fecha_vencimiento.isoformat() if user.fecha_vencimiento else None,
        "fecha_ultima_renovacion": user.fecha_ultima_renovacion.isoformat() if user.fecha_ultima_renovacion else None,
        "peso": user.peso,
        "altura": user.altura,
        "imc": user.imc,
        "fecha_nacimiento": user.fecha_nacimiento.isoformat() if user.fecha_nacimiento else None,
        "edad": user.edad,
        "certificado_entregado": user.certificado_entregado,
        "fecha_certificado": user.fecha_certificado.isoformat() if user.fecha_certificado else None
    }

# --- NUEVO: RESET DE CONTRASEÑA (PUNTO 2) ---
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
                final_response["color"] = "yellow"  # <--- Ahora sí avisamos que es amarillo
            else:
                final_response["message"] = f"Pase Válido ({dias_rest} días rest.)"
                final_response["color"] = "green"
        else:
            final_response["status"] = "DENIED"
            final_response["message"] = f"Plan Vencido el {user.fecha_vencimiento}"
            final_response["color"] = "red"

    # --- REGISTRO EN HISTORIAL (SQL) ---
    # FIX: Se cambia 'estado' por 'accion' para coincidir con el modelo historial_accesos
    try:
        nuevo_acceso = models.Acceso(
            usuario_id=user.id,
            dni=dni_recibido,
            nombre=user.nombre_completo,
            rol=final_response["rol"],
            metodo="QR SCAN",
            accion=final_response["status"],  # Campo 'accion' del modelo
            exitoso=(final_response["status"] == "AUTHORIZED"), # Campo 'exitoso'
            fecha=datetime.now()
        )
        db.add(nuevo_acceso)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error al guardar log de acceso: {e}")

    return final_response

# --- NUEVO: HISTORIAL DE ACCESOS ---
@app.get("/api/acceso/historial", tags=["Seguridad"])
def get_historial_accesos(db: Session = Depends(database.get_db)):
    """
    Trae los últimos 50 registros de acceso. 
    Enviamos la fecha ya formateada como texto para evitar desfases en el navegador.
    """
    try:
        from datetime import timedelta
        accesos = db.query(models.Acceso).order_by(models.Acceso.id.desc()).limit(50).all()
        
        # PRIORIDAD 0: CORRECCIÓN HORARIA.
        # Restamos 3 horas al envío para corregir el adelanto del servidor y sincronizar con Argentina.
        offset = timedelta(hours=-3) 

        return [{
            "id": a.id,
            "nombre": a.nombre,
            "dni": a.dni,
            "rol": a.rol or "Alumno",
            # Formateamos aquí a string: "HH:MM - DD/MM/YY"
            "fecha": (a.fecha + offset).strftime("%H:%M - %d/%m/%y") if a.fecha else "S/D",
            "metodo": a.metodo or "QR",
            "estado": a.accion 
        } for a in accesos]
    except Exception as e:
        logger.error(f"Error al obtener historial: {e}")
        return []

# --- ALUMNOS ---
@app.get("/api/alumnos", response_model=List[UsuarioResponse], tags=["Alumnos"])
def get_alumnos(db: Session = Depends(database.get_db)):
    alumnos = db.query(models.Usuario).options(
        joinedload(models.Usuario.perfil),
        joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
    ).join(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").all()
    
    for al in alumnos:
        al.rol_nombre = al.perfil.nombre if al.perfil else "Alumno"
        if al.fecha_vencimiento and al.fecha_vencimiento < date.today():
            al.estado_cuenta = "Vencido"
        
    return alumnos

@app.get("/api/alumnos/{id}/ficha", tags=["Alumnos"])
def get_ficha_tecnica(id: int, db: Session = Depends(database.get_db)):
    al = db.query(models.Usuario).options(joinedload(models.Usuario.plan)).filter(models.Usuario.id == id).first()
    if not al:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    estado = al.estado_cuenta
    if al.fecha_vencimiento and al.fecha_vencimiento < date.today():
        estado = "Vencido"

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
def create_alumno(alumno: AlumnoUpdate, db: Session = Depends(database.get_db)):
    try:
        perfil = db.query(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").first()
        if not perfil:
            raise HTTPException(status_code=500, detail="Perfil Alumno no encontrado")
            
        raw_password = str(alumno.password).strip() if alumno.password else str(alumno.dni).strip()
        hashed_pass = get_password_hash(raw_password)

        new_al = models.Usuario(
            nombre_completo=alumno.nombre_completo, 
            dni=alumno.dni, 
            email=alumno.email,
            plan_id=alumno.plan_id, 
            perfil_id=perfil.id, 
            password_hash=hashed_pass,
            fecha_ultima_renovacion=alumno.fecha_ultima_renovacion or date.today(), 
            fecha_vencimiento=alumno.fecha_vencimiento,
            fecha_nacimiento=alumno.fecha_nacimiento,
            edad=alumno.edad,
            peso=alumno.peso,
            altura=alumno.altura,
            imc=alumno.imc,
            certificado_entregado=alumno.certificado_entregado or False,
            fecha_certificado=alumno.fecha_certificado
        )
        
        db.add(new_al)
        db.commit()
        return {"status": "success", "message": "Alumno creado correctamente"}

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="El DNI o Email ya se encuentra registrado")
    except Exception as e:
        db.rollback()
        logger.error(f"Error crítico al crear alumno: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.put("/api/alumnos/{id}", tags=["Alumnos"])
def update_alumno(id: int, data: AlumnoUpdate, db: Session = Depends(database.get_db)):
    return update_db_user(id, data, db)

@app.delete("/api/alumnos/{id}", tags=["Alumnos"])
def delete_alumno(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.id == id).delete()
    db.commit()
    return {"status": "success"}

# --- RESERVAS ---
@app.get("/api/reservas", tags=["Reservas"])
def get_reservas(db: Session = Depends(database.get_db)):
    res = db.query(models.Reserva).options(
        joinedload(models.Reserva.usuario),
        joinedload(models.Reserva.clase)
    ).all()
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
    user = db.query(models.Usuario).options(joinedload(models.Usuario.plan)).filter(models.Usuario.id == data.usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.plan:
        limite_mensual = user.plan.clases_mensuales
        if limite_mensual < 999:
            mes_actual = date.today().month
            an_actual = date.today().year
            
            count_reservas = db.query(models.Reserva).filter(
                models.Reserva.usuario_id == user.id,
                extract('month', models.Reserva.fecha_reserva) == mes_actual,
                extract('year', models.Reserva.fecha_reserva) == an_actual
            ).count()
            
            if count_reservas >= limite_mensual:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Has alcanzado tu límite de {limite_mensual} clases mensuales."
                )

    exists = db.query(models.Reserva).filter(
        models.Reserva.usuario_id == data.usuario_id,
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.horario == data.horario,
        models.Reserva.dia_semana == data.dia_semana
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail="Ya tienes reservado este turno específico.")
    
    clase = db.query(models.Clase).filter(models.Clase.id == data.clase_id).first()
    if not clase:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
        
    cupo_actual = db.query(models.Reserva).filter(
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.horario == data.horario,
        models.Reserva.dia_semana == data.dia_semana
    ).count()
    
    if cupo_actual >= clase.capacidad_max:
        raise HTTPException(status_code=400, detail="Este horario no tiene cupos disponibles")

    new_res = models.Reserva(
        usuario_id=data.usuario_id,
        clase_id=data.clase_id,
        fecha_reserva=date.today(),
        horario=data.horario,       
        dia_semana=data.dia_semana 
    )
    
    try:
        db.add(new_res)
        db.commit()
        return {"status": "success"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error de base de datos.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error general al reservar: {e}")
        raise HTTPException(status_code=500, detail="Error interno al guardar la reserva.")

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
def list_profesores(db: Session = Depends(database.get_db)):
    profs = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).join(models.Perfil).filter(func.lower(models.Perfil.nombre) == "profesor").all()
    for p in profs: p.rol_nombre = p.perfil.nombre
    return profs

@app.get("/api/administrativos", response_model=List[UsuarioResponse], tags=["Staff"])
def list_admins(db: Session = Depends(database.get_db)):
    admins = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).join(models.Perfil).filter(func.lower(models.Perfil.nombre) == "administracion").all()
    for a in admins: a.rol_nombre = a.perfil.nombre
    return admins

@app.post("/api/staff", tags=["Staff"])
def create_staff(data: dict, db: Session = Depends(database.get_db)):
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == data['perfil_nombre']).first()
    if not perfil:
        raise HTTPException(status_code=400, detail="Perfil no válido")

    raw_password = str(data.get('password', data['dni'])).strip()
    new_staff = models.Usuario(
        nombre_completo=data['nombre_completo'], 
        dni=data['dni'], 
        email=data.get('email'),
        password_hash=get_password_hash(raw_password),
        perfil_id=perfil.id,
        especialidad=data.get('especialidad')
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
    return update_db_user(id, data, db)

@app.delete("/api/staff/{id}", tags=["Staff"])
def delete_staff(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.id == id).delete()
    db.commit()
    return {"status": "success"}

# --- STOCK ---
@app.get("/api/stock", tags=["Inventario"])
def get_stock(db: Session = Depends(database.get_db)):
    return db.query(models.Stock).all()

@app.post("/api/stock", tags=["Inventario"])
def create_stock(data: StockUpdate, db: Session = Depends(database.get_db)):
    new_s = models.Stock(
        nombre_producto=data.nombre_producto, 
        stock_actual=data.stock_actual, 
        stock_inicial=data.stock_actual, 
        precio_venta=data.precio_venta,
        url_imagen=data.url_imagen 
    )
    db.add(new_s)
    db.commit()
    return {"status": "success"}

@app.put("/api/stock/{id}", tags=["Inventario"])
def update_stock(id: int, data: StockUpdate, db: Session = Depends(database.get_db)):
    s = db.query(models.Stock).filter(models.Stock.id == id).first()
    if s:
        s.nombre_producto = data.nombre_producto
        s.stock_actual = data.stock_actual
        s.precio_venta = data.precio_venta
        s.url_imagen = data.url_imagen 
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Producto no encontrado"}

@app.delete("/api/stock/{id}", tags=["Inventario"])
def delete_stock(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Stock).filter(models.Stock.id == id).delete()
    db.commit()
    return {"status": "success"}

# --- PLANES ---
@app.get("/api/planes", tags=["Planes"])
def get_planes(db: Session = Depends(database.get_db)):
    return db.query(models.Plan).options(joinedload(models.Plan.tipo)).all()

@app.post("/api/planes", tags=["Planes"])
def create_plan(data: PlanUpdate, db: Session = Depends(database.get_db)):
    new_p = models.Plan(
        nombre=data.nombre,
        precio=data.precio,
        tipo_plan_id=data.tipo_plan_id,
        clases_mensuales=data.clases_mensuales 
    )
    db.add(new_p)
    db.commit()
    return {"status": "success"}

@app.put("/api/planes/{id}", tags=["Planes"])
def update_plan(id: int, data: PlanUpdate, db: Session = Depends(database.get_db)):
    p = db.query(models.Plan).filter(models.Plan.id == id).first()
    if p:
        p.nombre = data.nombre
        p.precio = data.precio
        p.tipo_plan_id = data.tipo_plan_id
        p.clases_mensuales = data.clases_mensuales # <--- Actualizamos el valor
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Plan no encontrado"}

@app.delete("/api/planes/{id}", tags=["Planes"])
def delete_plan(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.plan_id == id).update({"plan_id": None}) 
    db.query(models.Plan).filter(models.Plan.id == id).delete()
    db.commit()
    return {"status": "success"}

@app.get("/api/tipos-planes", tags=["Planes"])
def get_tipos(db: Session = Depends(database.get_db)):
    return db.query(models.TipoPlan).all()

# --- CLASES ---
@app.get("/api/clases", tags=["Clases"])
def get_clases(db: Session = Depends(database.get_db)):
    return db.query(models.Clase).all()

@app.post("/api/clases", tags=["Clases"])
def create_clase(data: ClaseUpdate, db: Session = Depends(database.get_db)):
    new_c = models.Clase(
        nombre=data.nombre,
        coach=data.coach, # <--- Usamos tu columna original 'coach'
        color=data.color,
        capacidad_max=data.capacidad_max,
        horarios_detalle=data.horarios_detalle 
    )
    db.add(new_c)
    db.commit()
    return {"status": "success"}

@app.put("/api/clases/{id}", tags=["Clases"])
def update_clase(id: int, data: ClaseUpdate, db: Session = Depends(database.get_db)):
    c = db.query(models.Clase).filter(models.Clase.id == id).first()
    if c:
        c.nombre = data.nombre
        c.profesor_id = data.coach # <--- Cambiado de c.coach a c.profesor_id
        c.color = data.color
        c.capacidad_max = data.capacidad_max
        c.horarios_detalle = data.horarios_detalle 
        flag_modified(c, "horarios_detalle")
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Clase no encontrada"}

@app.put("/api/clases/{id}/move", tags=["Clases"])
def move_clase(id: int, data: ClaseMove, db: Session = Depends(database.get_db)):
    c = db.query(models.Clase).filter(models.Clase.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    
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
def delete_clase(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Clase).filter(models.Clase.id == id).delete()
    db.commit()
    return {"status": "success"}

# --- CAJA ---
@app.get("/api/caja/resumen", tags=["Finanzas"])
def get_caja_resumen(db: Session = Depends(database.get_db)):
    ing = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Ingreso").scalar() or 0
    egr = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Egreso").scalar() or 0
    return {"ingresos": float(ing), "gastos": float(egr), "balance": float(ing - egr)}

@app.get("/api/caja/movimientos", tags=["Finanzas"])
def get_movimientos(db: Session = Depends(database.get_db)):
    return db.query(models.MovimientoCaja).order_by(models.MovimientoCaja.fecha.desc()).limit(20).all()

@app.post("/api/caja/movimiento", tags=["Finanzas"])
def create_movimiento(data: MovimientoCajaCreate, db: Session = Depends(database.get_db)):
    new_mov = models.MovimientoCaja(
        tipo=data.tipo,
        monto=abs(data.monto), # Forzar positivo
        descripcion=data.descripcion,
        metodo_pago=data.metodo_pago,
        fecha=datetime.now()
    )
    db.add(new_mov)
    db.commit()
    return {"status": "success"}

@app.post("/api/caja/movimientos", tags=["Caja"])
def crear_movimiento_caja(mov: MovimientoCreate, db: Session = Depends(database.get_db)):
    # LÓGICA VIKINGA: Si el tipo es Gasto o Compra, se asegura de que sea Egreso
    tipo_final = mov.tipo
    if mov.tipo in ["Gasto", "Compra", "Egreso"]:
        tipo_final = "Egreso"
    
    # Esta es la línea que consultabas: es la creación del objeto para la DB
    nuevo_movimiento = models.MovimientoCaja(
        descripcion=mov.descripcion,
        monto=abs(mov.monto),   # Siempre guardamos el monto positivo
        tipo=tipo_final,        # Aquí definimos si entró o salió plata
        metodo_pago=mov.metodo_pago,
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
def procesar_cobro(data: TransactionCreate, db: Session = Depends(database.get_db)):
    """
    PRIORIDAD 3: Lógica de cobros con actualización de vencimiento automática.
    Actualiza la membresía sumando días del plan a la fecha de vencimiento actual (si existe) o desde hoy.
    """
    try:
        # 1. Registro automático en Caja
        monto_positivo = abs(data.monto)
        
        # Generar descripción más detallada si es posible
        detalle = data.descripcion
        if not detalle:
            detalle = f"Cobro: {data.tipo}"

        nueva_transaccion = models.MovimientoCaja(
            tipo="Ingreso",  # Siempre es ingreso
            monto=monto_positivo,
            descripcion=detalle,
            metodo_pago=data.metodo_pago,
            fecha=datetime.now()
        )
        
        db.add(nueva_transaccion)

        # 2. Lógica de Stock (Si es mercadería)
        if (data.tipo == "Mercaderia" or "ercader" in data.tipo) and data.producto_id:
            producto = db.query(models.Stock).filter(models.Stock.id == data.producto_id).first()
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            
            producto.stock_actual -= data.cantidad
            
        # 3. Lógica de Planes (Actualización de Vencimiento Automatizada)
        if (data.tipo == "Plan" or "plan" in data.tipo.lower()) and data.alumno_id:
            alumno = db.query(models.Usuario).filter(models.Usuario.id == data.alumno_id).first()
            
            # Buscamos el plan para saber la duración de días. 
            # El producto_id en el cobro de planes se refiere al ID del Plan.
            plan = db.query(models.Plan).options(joinedload(models.Plan.tipo)).filter(models.Plan.id == data.producto_id).first()

            if alumno and plan:
                hoy = date.today()
                
                # Definir días de duración (por defecto 30 si el tipo de plan no lo tiene)
                dias_duracion = 30
                if plan.tipo and plan.tipo.duracion_dias:
                    dias_duracion = plan.tipo.duracion_dias
                
                # LÓGICA DE RENOVACIÓN INTELIGENTE:
                # Si el alumno ya venció (o vence hoy), empezamos a contar desde HOY.
                # Si aún NO venció, sumamos los días a su fecha de vencimiento actual.
                base_fecha = hoy
                if alumno.fecha_vencimiento and alumno.fecha_vencimiento > hoy:
                    base_fecha = alumno.fecha_vencimiento
                
                alumno.fecha_ultima_renovacion = hoy
                alumno.fecha_vencimiento = base_fecha + timedelta(days=dias_duracion)
                alumno.estado_cuenta = "Al día"
                alumno.plan_id = plan.id
                
                # Actualizar cupos de clases si el plan los define
                if plan.clases_mensuales:
                    alumno.clases_restantes = plan.clases_mensuales

        db.commit()
        return {"status": "success", "message": "Cobro procesado correctamente"}

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# --- MUSCULACIÓN ---
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
def create_plan_rutina(data: PlanRutinaCreate, db: Session = Depends(database.get_db)):
    try:
        user = db.query(models.Usuario).filter(models.Usuario.id == data.usuario_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        db.query(models.PlanRutina).filter(
            models.PlanRutina.usuario_id == data.usuario_id
        ).update({"activo": False}, synchronize_session=False)
        
        nuevo_plan = models.PlanRutina(
            usuario_id=data.usuario_id,
            nombre_grupo=data.nombre_grupo,
            descripcion=data.descripcion,
            objetivo=data.objetivo,
            fecha_vencimiento=data.fecha_vencimiento,
            activo=True,
            fecha_creacion=date.today()
        )
        db.add(nuevo_plan)
        db.flush() 
        
        for d in data.dias:
            nuevo_dia = models.DiaRutina(plan_rutina_id=nuevo_plan.id, nombre_dia=d.nombre_dia)
            db.add(nuevo_dia)
            db.flush()
            
            lista_ejercicios = d.ejercicios if d.ejercicios else []
            
            for e in lista_ejercicios:
                ej_en_rut = models.EjercicioEnRutina(
                    dia_id=nuevo_dia.id,
                    ejercicio_id=e.ejercicio_id,
                    comentario=e.comentario
                )
                db.add(ej_en_rut)
                db.flush()

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
        return {"status": "success", "id": nuevo_plan.id}

    except Exception as e:
        db.rollback()
        logger.error(f"Error Grave en Rutinas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rutinas/usuario/{id}", response_model=Optional[PlanRutinaResponse], tags=["Musculación"])
def get_rutina_activa(id: int, db: Session = Depends(database.get_db)):
    return db.query(models.PlanRutina).filter(
        models.PlanRutina.usuario_id == id, 
        models.PlanRutina.activo == True
    ).options(
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.ejercicio_obj),
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.series_detalle)
    ).first()

@app.get("/api/rutinas/historial/{id}", response_model=List[PlanRutinaResponse], tags=["Musculación"])
def get_historial_rutinas(id: int, db: Session = Depends(database.get_db)):
    return db.query(models.PlanRutina).filter(
        models.PlanRutina.usuario_id == id
    ).options(
        joinedload(models.PlanRutina.dias).joinedload(models.DiaRutina.ejercicios).joinedload(models.EjercicioEnRutina.series_detalle)
    ).order_by(models.PlanRutina.fecha_creacion.desc()).all()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)