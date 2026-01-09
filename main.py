import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

# Importamos nuestros módulos locales
import models
import database

app = FastAPI(title="Vikingo Strength Hub API")

# Configuración de CORS para permitir conexiones desde cualquier origen
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS PARA VALIDACIÓN ---

class UsuarioLogin(BaseModel):
    dni: str
    password: str

class PerfilSchema(BaseModel):
    id: int
    nombre: str
    class Config: from_attributes = True

class TipoPlanSchema(BaseModel):
    id: int
    nombre: str
    duracion_dias: int
    class Config: from_attributes = True

class PlanSchema(BaseModel):
    id: int
    nombre: str
    precio: float
    tipo: Optional[TipoPlanSchema]
    class Config: from_attributes = True

class UsuarioResponse(BaseModel):
    id: int
    nombre_completo: str
    dni: str
    email: Optional[str]
    rol_nombre: Optional[str] = None
    plan: Optional[PlanSchema] = None
    estado_cuenta: Optional[str] = "Al día"
    fecha_vencimiento: Optional[date] = None
    especialidad: Optional[str] = None
    class Config: from_attributes = True

class AlumnoCreate(BaseModel):
    nombre_completo: str
    dni: str
    email: str
    plan_id: int

class StaffCreate(BaseModel):
    nombre_completo: str
    dni: str
    email: Optional[str]
    password: str
    especialidad: Optional[str] = None
    perfil_nombre: str 

# --- ENDPOINTS DE API ---

@app.post("/api/login")
def login(data: UsuarioLogin, db: Session = Depends(database.get_db)):
    # Buscamos al usuario y cargamos su perfil
    user = db.query(models.Usuario).options(joinedload(models.Usuario.perfil)).filter(models.Usuario.dni == data.dni).first()
    
    if not user or user.password_hash != data.password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    return {
        "id": user.id,
        "nombre_completo": user.nombre_completo,
        "dni": user.dni,
        "rol_nombre": user.perfil.nombre
    }

@app.get("/api/alumnos", response_model=List[UsuarioResponse])
def get_alumnos(db: Session = Depends(database.get_db)):
    usuarios = db.query(models.Usuario).options(
        joinedload(models.Usuario.plan).joinedload(models.Plan.tipo)
    ).join(models.Perfil).filter(models.Perfil.nombre == "Alumno").all()
    return usuarios

@app.post("/api/alumnos")
def create_alumno(alumno: AlumnoCreate, db: Session = Depends(database.get_db)):
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == "Alumno").first()
    if not perfil:
        raise HTTPException(status_code=500, detail="Perfil Alumno no configurado en BD")

    new_al = models.Usuario(
        nombre_completo=alumno.nombre_completo,
        dni=alumno.dni,
        email=alumno.email,
        plan_id=alumno.plan_id,
        perfil_id=perfil.id,
        password_hash=alumno.dni, # Password por defecto es el DNI
        fecha_ultima_renovacion=date.today(),
        fecha_vencimiento=date.today(),
        estado_cuenta="Al día"
    )
    db.add(new_al)
    db.commit()
    return {"status": "success"}

@app.get("/api/profesores", response_model=List[UsuarioResponse])
def list_profesores(db: Session = Depends(database.get_db)):
    return db.query(models.Usuario).join(models.Perfil).filter(models.Perfil.nombre == "Profesor").all()

@app.get("/api/administrativos", response_model=List[UsuarioResponse])
def list_admins(db: Session = Depends(database.get_db)):
    return db.query(models.Usuario).join(models.Perfil).filter(models.Perfil.nombre == "Administracion").all()

@app.post("/api/staff")
def create_staff(data: StaffCreate, db: Session = Depends(database.get_db)):
    perfil = db.query(models.Perfil).filter(models.Perfil.nombre == data.perfil_nombre).first()
    if not perfil:
        raise HTTPException(status_code=400, detail="El rol especificado no existe")
        
    new_staff = models.Usuario(
        nombre_completo=data.nombre_completo,
        dni=data.dni,
        email=data.email,
        password_hash=data.password,
        perfil_id=perfil.id,
        especialidad=data.especialidad
    )
    db.add(new_staff)
    db.commit()
    return {"status": "success"}

@app.get("/api/stock")
def get_stock(db: Session = Depends(database.get_db)):
    return db.query(models.Stock).all()

@app.get("/api/caja/resumen")
def get_caja_resumen(db: Session = Depends(database.get_db)):
    # Calculamos ingresos y gastos desde la tabla 'caja'
    ingresos = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Ingreso").scalar() or 0
    gastos = db.query(func.sum(models.MovimientoCaja.monto)).filter(models.MovimientoCaja.tipo == "Egreso").scalar() or 0
    return {
        "ingresos": float(ingresos), 
        "gastos": float(gastos), 
        "balance": float(ingresos - gastos)
    }

@app.get("/api/caja/movimientos")
def get_movimientos(db: Session = Depends(database.get_db)):
    return db.query(models.MovimientoCaja).order_by(models.MovimientoCaja.fecha.desc()).limit(20).all()

@app.get("/api/planes")
def get_planes(db: Session = Depends(database.get_db)):
    return db.query(models.Plan).options(joinedload(models.Plan.tipo)).all()

@app.get("/api/clases")
def get_clases(db: Session = Depends(database.get_db)):
    return db.query(models.Clase).all()

# --- SERVIR FRONTEND ---

# Esta ruta sirve tu index.html cuando entras a la raíz (/)
@app.get("/")
async def read_index():
    return FileResponse("index.html")

# Si tienes carpetas de imágenes o assets, puedes descomentar la siguiente línea:
# app.mount("/assets", StaticFiles(directory="assets"), name="assets")

if __name__ == "__main__":
    import uvicorn
    # En local corre en el puerto 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)