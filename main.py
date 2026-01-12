import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

# Importamos nuestros módulos locales
import models
import database

app = FastAPI(title="Vikingo Strength Hub API")

# ==========================================
# CONFIGURACIÓN Y MIDDLEWARE
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# MODELOS DE DATOS (PYDANTIC SCHEMAS)
# ==========================================

class UsuarioLogin(BaseModel):
    dni: str
    password: str

class TipoPlanSchema(BaseModel):
    id: int
    nombre: str
    duracion_dias: int
    class Config:
        from_attributes = True

class PlanSchema(BaseModel):
    id: int
    nombre: str
    precio: float
    tipo_plan_id: Optional[int]
    tipo: Optional[TipoPlanSchema] = None
    class Config:
        from_attributes = True

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
    
    class Config:
        from_attributes = True

class AlumnoUpdate(BaseModel):
    nombre_completo: str
    dni: str
    email: Optional[str] = None
    plan_id: int
    password: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    edad: Optional[int] = None
    peso: Optional[float] = None
    altura: Optional[float] = None
    imc: Optional[float] = None
    certificado_entregado: bool = False
    fecha_certificado: Optional[date] = None

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

class PlanUpdate(BaseModel):
    nombre: str
    precio: float
    tipo_plan_id: int

class ClaseUpdate(BaseModel):
    nombre: str
    coach: str
    dia: int
    horario: int
    color: Optional[str] = "#FF0000"
    capacidad_max: Optional[int] = 40

class ClaseMove(BaseModel):
    dia: int
    horario: int

class MovimientoCajaCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: str

# Schema específico para resolver el error 500 de Reservas
class ReservaCreate(BaseModel):
    usuario_id: int
    clase_id: int

# ==========================================
# ENDPOINTS DE ACCESO Y FRONTEND
# ==========================================

@app.get("/", tags=["Sistema"])
def api_root():
    return {
        "status": "Vikingo Strength Hub API is running",
        "documentation": "/docs",
        "frontend_app": "/app"
    }

@app.get("/app", tags=["Sistema"])
async def serve_app():
    return FileResponse("index.html")

# ==========================================
# MÓDULO 1: AUTENTICACIÓN (LOGIN)
# ==========================================

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
            "precio": user.plan.precio
        } if user.plan else None,
        "fecha_vencimiento": user.fecha_vencimiento.isoformat() if user.fecha_vencimiento else None,
        "fecha_ultima_renovacion": user.fecha_ultima_renovacion.isoformat() if user.fecha_ultima_renovacion else None,
        "peso": user.peso,
        "altura": user.altura,
        "imc": user.imc
    }

# ==========================================
# MÓDULO 2: GESTIÓN DE ALUMNOS Y FICHAS
# ==========================================

@app.get("/api/alumnos", response_model=List[UsuarioResponse], tags=["Alumnos"])
def get_alumnos(db: Session = Depends(database.get_db)):
    alumnos = db.query(models.Usuario).options(
        joinedload(models.Usuario.perfil),
        joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
    ).join(models.Perfil).filter(func.lower(models.Perfil.nombre) == "alumno").all()
    
    for al in alumnos:
        al.rol_nombre = al.perfil.nombre if al.perfil else "Alumno"
        
    return alumnos

@app.get("/api/alumnos/{id}/ficha", tags=["Alumnos"])
def get_ficha_tecnica(id: int, db: Session = Depends(database.get_db)):
    al = db.query(models.Usuario).options(joinedload(models.Usuario.plan)).filter(models.Usuario.id == id).first()
    if not al:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    return {
        "nombre_completo": al.nombre_completo,
        "dni": al.dni,
        "plan": al.plan.nombre if al.plan else "Sin plan",
        "peso": al.peso,
        "altura": al.altura,
        "imc": al.imc,
        "estado_cuenta": al.estado_cuenta,
        "rutina": [
            {"dia": "Día 1: Empuje", "ejercicios": ["Press Banca 4x10", "Sentadilla 4x8", "Press Militar 3x12"]},
            {"dia": "Día 2: Tracción", "ejercicios": ["Peso Muerto 3x5", "Dominadas 4x10", "Remo c/ Barra 4x12"]}
        ]
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
        fecha_ultima_renovacion=date.today(), 
        fecha_vencimiento=date.today(),
        fecha_nacimiento=alumno.fecha_nacimiento,
        edad=alumno.edad,
        peso=alumno.peso,
        altura=alumno.altura,
        imc=alumno.imc,
        certificado_entregado=alumno.certificado_entregado,
        fecha_certificado=alumno.fecha_certificado
    )
    db.add(new_al)
    db.commit()
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

    if data.password:
        al.password_hash = data.password
    db.commit()
    return {"status": "success"}

@app.delete("/api/alumnos/{id}", tags=["Alumnos"])
def delete_alumno(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.id == id).delete()
    db.commit()
    return {"status": "success"}

# ==========================================
# MÓDULO 3: RESERVAS (PERSISTENCIA Y CANCELACIÓN)
# ==========================================

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
        "alumno_dni": r.usuario.dni if r.usuario else "N/A",
        "clase_nombre": r.clase.nombre if r.clase else "Eliminada",
        "horario": r.clase.horario if r.clase else 0,
        "dia": r.clase.dia if r.clase else 0
    } for r in res]

@app.post("/api/reservas", tags=["Reservas"])
def book_clase(data: ReservaCreate, db: Session = Depends(database.get_db)):
    # 1. Verificar si ya existe reserva para el mismo alumno y clase hoy
    exists = db.query(models.Reserva).filter(
        models.Reserva.usuario_id == data.usuario_id,
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.fecha_reserva == date.today()
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail="Ya tienes una reserva para esta clase hoy")
    
    # 2. Verificar cupo disponible
    clase = db.query(models.Clase).filter(models.Clase.id == data.clase_id).first()
    if not clase:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
        
    cupo_actual = db.query(models.Reserva).filter(
        models.Reserva.clase_id == data.clase_id,
        models.Reserva.fecha_reserva == date.today()
    ).count()
    
    if cupo_actual >= clase.capacidad_max:
        raise HTTPException(status_code=400, detail="Clase sin cupos disponibles")

    # 3. Guardar en la tabla de NeonDB
    new_res = models.Reserva(
        usuario_id=data.usuario_id,
        clase_id=data.clase_id,
        fecha_reserva=date.today()
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

# ==========================================
# MÓDULO 4: STAFF (PROFESORES / ADM)
# ==========================================

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
    db.commit()
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

# ==========================================
# MÓDULO 5: PRODUCTOS Y STOCK
# ==========================================

@app.get("/api/stock", tags=["Inventario"])
def get_stock(db: Session = Depends(database.get_db)):
    return db.query(models.Stock).all()

@app.post("/api/stock", tags=["Inventario"])
def create_stock(data: StockUpdate, db: Session = Depends(database.get_db)):
    new_s = models.Stock(
        nombre_producto=data.nombre_producto, 
        stock_actual=data.stock_actual, 
        stock_inicial=data.stock_actual, 
        precio_venta=data.precio_venta
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
        db.commit()
    return {"status": "success"}

@app.delete("/api/stock/{id}", tags=["Inventario"])
def delete_stock(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Stock).filter(models.Stock.id == id).delete()
    db.commit()
    return {"status": "success"}

# ==========================================
# MÓDULO 6: PLANES DE ENTRENAMIENTO
# ==========================================

@app.get("/api/planes", tags=["Planes"])
def get_planes(db: Session = Depends(database.get_db)):
    return db.query(models.Plan).options(joinedload(models.Plan.tipo)).all()

@app.post("/api/planes", tags=["Planes"])
def create_plan(data: PlanUpdate, db: Session = Depends(database.get_db)):
    new_p = models.Plan(
        nombre=data.nombre,
        precio=data.precio,
        tipo_plan_id=data.tipo_plan_id
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
        db.commit()
    return {"status": "success"}

@app.delete("/api/planes/{id}", tags=["Planes"])
def delete_plan(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Plan).filter(models.Plan.id == id).delete()
    db.commit()
    return {"status": "success"}

@app.get("/api/tipos-planes", tags=["Planes"])
def get_tipos(db: Session = Depends(database.get_db)):
    return db.query(models.TipoPlan).all()

# ==========================================
# MÓDULO 7: CLASES Y AGENDA
# ==========================================

@app.get("/api/clases", tags=["Clases"])
def get_clases(db: Session = Depends(database.get_db)):
    return db.query(models.Clase).all()

@app.post("/api/clases", tags=["Clases"])
def create_clase(data: ClaseUpdate, db: Session = Depends(database.get_db)):
    new_c = models.Clase(
        nombre=data.nombre,
        coach=data.coach,
        dia=data.dia,
        horario=data.horario,
        color=data.color,
        capacidad_max=data.capacidad_max
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
        c.dia = data.dia
        c.horario = data.horario
        c.color = data.color
        c.capacidad_max = data.capacidad_max
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Clase no encontrada"}

@app.put("/api/clases/{id}/move", tags=["Clases"])
def move_clase(id: int, data: ClaseMove, db: Session = Depends(database.get_db)):
    c = db.query(models.Clase).filter(models.Clase.id == id).first()
    if c:
        c.dia = data.dia
        c.horario = data.horario
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Clase no encontrada"}

@app.delete("/api/clases/{id}", tags=["Clases"])
def delete_clase(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Clase).filter(models.Clase.id == id).delete()
    db.commit()
    return {"status": "success"}

# ==========================================
# MÓDULO 8: CAJA Y FINANZAS
# ==========================================

@app.get("/api/caja/resumen", tags=["Finanzas"])
def get_caja_resumen(db: Session = Depends(database.get_db)):
    ing = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Ingreso").scalar() or 0
    egr = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Egreso").scalar() or 0
    return {"ingresos": float(ing), "gastos": float(egr), "balance": float(ing - egr)}

@app.get("/api/caja/movimientos", tags=["Finanzas"])
def get_movimientos(db: Session = Depends(database.get_db)):
    return db.query(models.MovimientoCaja).order_by(models.MovimientoCaja.fecha.desc()).limit(15).all()

@app.post("/api/caja/movimiento", tags=["Finanzas"])
def create_movimiento(data: MovimientoCajaCreate, db: Session = Depends(database.get_db)):
    new_mov = models.MovimientoCaja(
        tipo=data.tipo,
        monto=data.monto,
        descripcion=data.descripcion
    )
    db.add(new_mov)
    db.commit()
    return {"status": "success"}

# ==========================================
# EJECUCIÓN DEL SERVIDOR
# ==========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))