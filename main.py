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

# Configuración de CORS
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

class PlanSchema(BaseModel):
    id: int
    nombre: str
    precio: float
    tipo_plan_id: Optional[int]
    tipo: Optional[dict] = None
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
    class Config: from_attributes = True

class AlumnoUpdate(BaseModel):
    nombre_completo: str
    dni: str
    email: str
    plan_id: int

class StaffUpdate(BaseModel):
    nombre_completo: str
    dni: str
    email: Optional[str] = None
    especialidad: Optional[str] = None
    perfil_nombre: str

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

class ClaseMove(BaseModel):
    dia: int
    horario: int

# --- ENDPOINTS ---

@app.post("/api/login")
def login(data: UsuarioLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).filter(models.Usuario.dni == data.dni).first()
    if not user or user.password_hash != data.password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # IMPORTANTE: Ahora incluimos el email en la respuesta
    return {
        "id": user.id, 
        "nombre_completo": user.nombre_completo, 
        "dni": user.dni, 
        "email": user.email,
        "rol_nombre": user.perfil.nombre
    }

# ALUMNOS
@app.get("/api/alumnos", response_model=List[UsuarioResponse])
def get_alumnos(db: Session = Depends(database.get_db)):
    # Buscamos por el nombre exacto del perfil "Alumno"
    return db.query(models.Usuario).options(joinedload(models.Usuario.plan)).join(models.Perfil).filter(models.Perfil.nombre == "Alumno").all()

@app.post("/api/alumnos")
def create_alumno(alumno: AlumnoUpdate, db: Session = Depends(database.get_db)):
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == "Alumno").first()
    new_al = models.Usuario(
        nombre_completo=alumno.nombre_completo, dni=alumno.dni, email=alumno.email,
        plan_id=alumno.plan_id, perfil_id=perfil.id, password_hash=alumno.dni,
        fecha_ultima_renovacion=date.today(), fecha_vencimiento=date.today()
    )
    db.add(new_al)
    db.commit()
    return {"status": "success"}

@app.put("/api/alumnos/{id}")
def update_alumno(id: int, data: AlumnoUpdate, db: Session = Depends(database.get_db)):
    al = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    for k, v in data.dict().items(): setattr(al, k, v)
    db.commit()
    return {"status": "success"}

@app.delete("/api/alumnos/{id}")
def delete_alumno(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.id == id).delete()
    db.commit()
    return {"status": "success"}

# STAFF (Profesores y Administrativos)
@app.get("/api/profesores", response_model=List[UsuarioResponse])
def list_profesores(db: Session = Depends(database.get_db)):
    return db.query(models.Usuario).join(models.Perfil).filter(models.Perfil.nombre == "Profesor").all()

@app.get("/api/administrativos", response_model=List[UsuarioResponse])
def list_admins(db: Session = Depends(database.get_db)):
    return db.query(models.Usuario).join(models.Perfil).filter(models.Perfil.nombre == "Administracion").all()

@app.post("/api/staff")
def create_staff(data: dict, db: Session = Depends(database.get_db)):
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == data['perfil_nombre']).first()
    new_staff = models.Usuario(
        nombre_completo=data['nombre_completo'], dni=data['dni'], email=data.get('email'),
        password_hash=data.get('password', data['dni']), perfil_id=perfil.id,
        especialidad=data.get('especialidad')
    )
    db.add(new_staff)
    db.commit()
    return {"status": "success"}

@app.put("/api/staff/{id}")
def update_staff(id: int, data: StaffUpdate, db: Session = Depends(database.get_db)):
    st = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == data.perfil_nombre).first()
    st.nombre_completo = data.nombre_completo
    st.dni = data.dni
    st.email = data.email
    st.especialidad = data.especialidad
    st.perfil_id = perfil.id
    db.commit()
    return {"status": "success"}

@app.delete("/api/staff/{id}")
def delete_staff(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Usuario).filter(models.Usuario.id == id).delete()
    db.commit()
    return {"status": "success"}

# STOCK
@app.get("/api/stock")
def get_stock(db: Session = Depends(database.get_db)):
    return db.query(models.Stock).all()

@app.post("/api/stock")
def create_stock(data: StockUpdate, db: Session = Depends(database.get_db)):
    new_s = models.Stock(nombre_producto=data.nombre_producto, stock_actual=data.stock_actual, stock_inicial=data.stock_actual, precio_venta=data.precio_venta)
    db.add(new_s)
    db.commit()
    return {"status": "success"}

@app.put("/api/stock/{id}")
def update_stock(id: int, data: StockUpdate, db: Session = Depends(database.get_db)):
    s = db.query(models.Stock).filter(models.Stock.id == id).first()
    for k, v in data.dict().items(): setattr(s, k, v)
    db.commit()
    return {"status": "success"}

@app.delete("/api/stock/{id}")
def delete_stock(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Stock).filter(models.Stock.id == id).delete()
    db.commit()
    return {"status": "success"}

# PLANES
@app.get("/api/planes")
def get_planes(db: Session = Depends(database.get_db)):
    return db.query(models.Plan).options(joinedload(models.Plan.tipo)).all()

@app.post("/api/planes")
def create_plan(data: PlanUpdate, db: Session = Depends(database.get_db)):
    new_p = models.Plan(**data.dict())
    db.add(new_p)
    db.commit()
    return {"status": "success"}

@app.put("/api/planes/{id}")
def update_plan(id: int, data: PlanUpdate, db: Session = Depends(database.get_db)):
    p = db.query(models.Plan).filter(models.Plan.id == id).first()
    for k, v in data.dict().items(): setattr(p, k, v)
    db.commit()
    return {"status": "success"}

@app.delete("/api/planes/{id}")
def delete_plan(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Plan).filter(models.Plan.id == id).delete()
    db.commit()
    return {"status": "success"}

# CLASES
@app.get("/api/clases")
def get_clases(db: Session = Depends(database.get_db)):
    return db.query(models.Clase).all()

@app.post("/api/clases")
def create_clase(data: ClaseUpdate, db: Session = Depends(database.get_db)):
    new_c = models.Clase(**data.dict())
    db.add(new_c)
    db.commit()
    return {"status": "success"}

@app.put("/api/clases/{id}")
def update_clase(id: int, data: ClaseUpdate, db: Session = Depends(database.get_db)):
    c = db.query(models.Clase).filter(models.Clase.id == id).first()
    for k, v in data.dict().items(): setattr(c, k, v)
    db.commit()
    return {"status": "success"}

@app.put("/api/clases/{id}/move")
def move_clase(id: int, data: ClaseMove, db: Session = Depends(database.get_db)):
    c = db.query(models.Clase).filter(models.Clase.id == id).first()
    c.dia = data.dia
    c.horario = data.horario
    db.commit()
    return {"status": "success"}

@app.delete("/api/clases/{id}")
def delete_clase(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Clase).filter(models.Clase.id == id).delete()
    db.commit()
    return {"status": "success"}

# OTROS
@app.get("/api/tipos-planes")
def get_tipos(db: Session = Depends(database.get_db)):
    return db.query(models.TipoPlan).all()

@app.get("/api/caja/resumen")
def get_caja_resumen(db: Session = Depends(database.get_db)):
    ing = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Ingreso").scalar() or 0
    egr = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Egreso").scalar() or 0
    return {"ingresos": float(ing), "gastos": float(egr), "balance": float(ing - egr)}

@app.get("/api/caja/movimientos")
def get_movimientos(db: Session = Depends(database.get_db)):
    return db.query(models.MovimientoCaja).order_by(models.MovimientoCaja.fecha.desc()).limit(10).all()

@app.get("/")
async def read_index():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))