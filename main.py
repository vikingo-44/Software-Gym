import os
import logging
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, extract
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional, Union
from pydantic import BaseModel
from datetime import datetime, timedelta, date

# Configuración de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import models
import database
from database import Base

app = FastAPI(title="Vikingo Strength Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS ---

class UsuarioLogin(BaseModel):
    dni: str
    password: str

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
    nombre_completo: str
    dni: str
    email: Optional[str] = None
    plan_id: Optional[int] = None
    password: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    edad: Optional[int] = None
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    certificado_entregado: bool = False
    fecha_certificado: Optional[date] = None
    fecha_ultima_renovacion: Optional[date] = None
    fecha_vencimiento: Optional[date] = None

class StaffUpdate(BaseModel):
    nombre_completo: str
    dni: str
    email: Optional[str] = None
    especialidad: Optional[str] = None
    perfil_nombre: str
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

class TransactionCreate(BaseModel):
    tipo: str  # 'Plan' o 'Mercaderia'
    monto: float
    descripcion: str
    metodo_pago: str  # 'Efectivo', 'Transferencia', 'Tarjeta'
    alumno_id: Optional[int] = None
    producto_id: Optional[int] = None
    cantidad: int = 1

class ReservaCreate(BaseModel):
    usuario_id: int
    clase_id: int
    horario: float
    dia_semana: int

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

# ==========================================
# ENDPOINTS
# ==========================================

@app.get("/", tags=["Sistema"])
def api_root():
    return {"status": "Vikingo Strength Hub API is running"}

@app.get("/app", tags=["Sistema"])
async def serve_app():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"message": "Frontend file not found"}

# --- LOGIN ---
@app.post("/api/login", tags=["Autenticacion"])
def login(data: UsuarioLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.Usuario).options(
        joinedload(models.Usuario.perfil),
        joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
    ).filter(models.Usuario.dni == data.dni).first()
    
    if not user or user.password_hash != data.password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    return {
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
        "imc": user.imc
    }

# --- ALUMNOS ---
@app.get("/api/alumnos", response_model=List[UsuarioResponse], tags=["Alumnos"])
def get_alumnos(db: Session = Depends(database.get_db)):
    alumnos = db.query(models.Usuario).options(
        joinedload(models.Usuario.perfil),
        joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
    ).join(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").all()
    
    for al in alumnos:
        al.rol_nombre = al.perfil.nombre if al.perfil else "Alumno"
        # Actualizar estado dinámicamente si está vencido hoy
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
        "estado_cuenta": estado
    }

@app.post("/api/alumnos", tags=["Alumnos"])
def create_alumno(alumno: AlumnoUpdate, db: Session = Depends(database.get_db)):
    perfil = db.query(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").first()
    if not perfil:
        raise HTTPException(status_code=500, detail="Perfil Alumno no encontrado")
        
    new_al = models.Usuario(
        nombre_completo=alumno.nombre_completo, 
        dni=alumno.dni, 
        email=alumno.email,
        plan_id=alumno.plan_id, 
        perfil_id=perfil.id, 
        password_hash=alumno.password or alumno.dni,
        fecha_ultima_renovacion=alumno.fecha_ultima_renovacion or date.today(), 
        fecha_vencimiento=alumno.fecha_vencimiento,
        fecha_nacimiento=alumno.fecha_nacimiento,
        edad=alumno.edad,
        peso=alumno.peso,
        altura=alumno.altura,
        imc=alumno.imc,
        certificado_entregado=alumno.certificado_entregado,
        fecha_certificado=alumno.fecha_certificado
    )
    db.add(new_al)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="El DNI o Email ya se encuentra registrado")
    return {"status": "success"}

@app.put("/api/alumnos/{id}", tags=["Alumnos"])
def update_alumno(id: int, data: AlumnoUpdate, db: Session = Depends(database.get_db)):
    al = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    if not al:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    al.nombre_completo = data.nombre_completo
    al.dni = data.dni
    al.email = data.email
    al.plan_id = data.plan_id
    al.fecha_nacimiento = data.fecha_nacimiento
    al.edad = data.edad
    al.peso = data.peso
    al.altura = data.altura
    al.imc = data.imc
    al.certificado_entregado = data.certificado_entregado
    al.fecha_certificado = data.fecha_certificado
    if data.fecha_ultima_renovacion: al.fecha_ultima_renovacion = data.fecha_ultima_renovacion
    if data.fecha_vencimiento: al.fecha_vencimiento = data.fecha_vencimiento

    if data.password:
        al.password_hash = data.password
    db.commit()
    return {"status": "success"}

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
            anio_actual = date.today().year
            
            count_reservas = db.query(models.Reserva).filter(
                models.Reserva.usuario_id == user.id,
                extract('month', models.Reserva.fecha_reserva) == mes_actual,
                extract('year', models.Reserva.fecha_reserva) == anio_actual
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
        models.Reserva.dia_semana == data.dia_semana,
        models.Reserva.fecha_reserva == date.today()
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail="Ya tienes una reserva para este turno hoy")
    
    clase = db.query(models.Clase).filter(models.Clase.id == data.clase_id).first()
    if not clase:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
        
    cupo_actual = db.query(models.Reserva).filter(
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.horario == data.horario,
        models.Reserva.dia_semana == data.dia_semana,
        models.Reserva.fecha_reserva == date.today()
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
    db.add(new_res)
    db.commit()
    return {"status": "success"}

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

    new_staff = models.Usuario(
        nombre_completo=data['nombre_completo'], 
        dni=data['dni'], 
        email=data.get('email'),
        password_hash=data.get('password', data['dni']), 
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
    st = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == data.perfil_nombre).first()
    
    st.nombre_completo = data.nombre_completo
    st.dni = data.dni
    st.email = data.email
    st.especialidad = data.especialidad
    if perfil:
        st.perfil_id = perfil.id
    if data.password:
        st.password_hash = data.password
        
    db.commit()
    return {"status": "success"}

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
        clases_mensuales=data.clases_mensuales or 12 
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
        if data.clases_mensuales is not None:
             p.clases_mensuales = data.clases_mensuales
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
        coach=data.coach,
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
        c.coach = data.coach
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
        monto=data.monto,
        descripcion=data.descripcion,
        metodo_pago=data.metodo_pago,
        fecha=datetime.now()
    )
    db.add(new_mov)
    db.commit()
    return {"status": "success"}

# --- PROCESAR COBROS (CORREGIDO) ---
@app.post("/api/cobros/procesar", tags=["Finanzas"])
def procesar_cobro(data: TransactionCreate, db: Session = Depends(database.get_db)):
    try:
        # 1. Registro automático en Caja
        # Usamos tu modelo MovimientoCaja. Asegúrate que tenga estos campos.
        nueva_transaccion = models.MovimientoCaja(
            tipo=data.tipo,  # Guardamos 'Plan' o 'Mercaderia' para saber qué fue
            monto=data.monto,
            descripcion=data.descripcion,
            metodo_pago=data.metodo_pago,
            fecha=datetime.now()
        )
        # Opcional: Si tu modelo MovimientoCaja tiene alumno_id/producto_id, asígnalos aquí también.
        
        db.add(nueva_transaccion)

        # 2. Lógica de Stock (Si es mercadería)
        if data.tipo == "Mercaderia" and data.producto_id:
            producto = db.query(models.Stock).filter(models.Stock.id == data.producto_id).first()
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            
            if producto.stock_actual < data.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente de {producto.nombre_producto}")
            
            producto.stock_actual -= data.cantidad
            
        # 3. Actualización de Alumno (Si es un Plan)
        if data.tipo == "Plan" and data.alumno_id:
            alumno = db.query(models.Usuario).filter(models.Usuario.id == data.alumno_id).first()
            
            # BUSCAMOS EL PLAN EN LA TABLA 'tipos_planes' (Modelo TipoPlan)
            # Usamos data.producto_id que viene del front con el ID del plan seleccionado
            plan = db.query(models.TipoPlan).filter(models.TipoPlan.id == data.producto_id).first()
            
            if alumno and plan:
                hoy = datetime.now()
                
                # A. Actualizamos fechas de pago
                alumno.fecha_ultimo_pago = hoy 
                alumno.fecha_ultima_renovacion = hoy 
                
                # B. Calculamos Vencimiento Dinámico usando la columna 'duracion_dias'
                # Si por error duracion_dias es null o 0, usamos 30 días por seguridad
                dias_duracion = plan.duracion_dias if plan.duracion_dias and plan.duracion_dias > 0 else 30
                alumno.fecha_vencimiento = hoy + timedelta(days=dias_duracion)
                
                # C. Actualizamos Estado y Plan
                alumno.estado = "Activo"       # Cambiamos estado para quitar el "Vencido"
                alumno.estado_cuenta = "Al día"
                alumno.plan_id = plan.id       # Asignamos el nuevo plan al usuario
                
                # D. Reseteamos Clases (Solo si tu tabla tipos_planes tuviera cupo de clases, sino lo ignora)
                if hasattr(plan, 'clases_mensuales') and plan.clases_mensuales:
                    alumno.clases_restantes = plan.clases_mensuales

        db.commit()
        return {"status": "success", "message": "Cobro procesado y sistema actualizado correctamente"}

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        # logger.error(f"Error procesando cobro: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Error interno al procesar el pago: {str(e)}")

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

        # Desactivar rutinas anteriores
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
    rutina = db.query(models.PlanRutina).filter(
        models.PlanRutina.usuario_id == id, 
        models.PlanRutina.activo == True
    ).options(
        joinedload(models.PlanRutina.dias)
            .joinedload(models.DiaRutina.ejercicios)
            .joinedload(models.EjercicioEnRutina.ejercicio_obj),
        joinedload(models.PlanRutina.dias)
            .joinedload(models.DiaRutina.ejercicios)
            .joinedload(models.EjercicioEnRutina.series_detalle)
    ).first()
    return rutina

@app.get("/api/rutinas/historial/{id}", response_model=List[PlanRutinaResponse], tags=["Musculación"])
def get_historial_rutinas(id: int, db: Session = Depends(database.get_db)):
    return db.query(models.PlanRutina).filter(
        models.PlanRutina.usuario_id == id
    ).options(
        joinedload(models.PlanRutina.dias)
            .joinedload(models.DiaRutina.ejercicios)
            .joinedload(models.EjercicioEnRutina.series_detalle)
    ).order_by(models.PlanRutina.fecha_creacion.desc()).all()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)