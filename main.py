from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
from typing import List, Optional
import datetime
import os

# --- CONFIGURACIÓN DE BASE DE DATOS (NEON) ---
# Asegúrate de configurar DATABASE_URL en las variables de entorno de Render
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://tu_usuario:tu_password@tu_host/neondb?sslmode=require")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- MODELOS DE BASE DE DATOS (SQLAlchemy) ---

class PlanDB(Base):
    __tablename__ = "planes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    tag = Column(String(50))
    descripcion = Column(Text)
    periodo = Column(String(20))  # mensual, trimestral, semestral, anual
    precio = Column(Float, default=0.0)
    alumnos = relationship("AlumnoDB", back_populates="plan")

class AlumnoDB(Base):
    __tablename__ = "alumnos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(150))
    dni = Column(String(20), unique=True, nullable=False, index=True)
    estado = Column(String(20), default="Activo")
    plan_id = Column(Integer, ForeignKey("planes.id"))
    origen = Column(String(50), default="Admin")
    fecha_ultima_renovacion = Column(Date)
    fecha_vencimiento = Column(Date)
    plan = relationship("PlanDB", back_populates="alumnos")

class ProductoDB(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    categoria = Column(String(50))
    stock_actual = Column(Integer, default=0)
    precio_venta = Column(Float, nullable=False)

class ClaseDB(Base):
    __tablename__ = "clases"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    coach = Column(String(100))
    duracion_minutos = Column(Integer, default=60)
    capacidad_max = Column(Integer, default=10)

class CajaDB(Base):
    __tablename__ = "caja_movements"
    id = Column(Integer, primary_key=True, index=True)
    fecha_hora = Column(DateTime, default=datetime.datetime.utcnow)
    descripcion = Column(Text, nullable=False)
    categoria = Column(String(50))
    monto = Column(Float, nullable=False)
    tipo = Column(String(5))  # in, out
    metodo_pago = Column(String(50), default="Efectivo")

# Crear tablas
Base.metadata.create_all(bind=engine)

# --- ESQUEMAS (Pydantic) ---

class PlanBase(BaseModel):
    nombre: str
    precio: float
    periodo: str
    tag: Optional[str] = None

class PlanResponse(PlanBase):
    id: int
    class Config: orm_mode = True

class AlumnoCreate(BaseModel):
    nombre: str
    email: str
    dni: str
    plan_id: int
    fecha_vencimiento: str
    fecha_ultima_renovacion: str

class ProductoCreate(BaseModel):
    nombre: str
    categoria: str
    stock_actual: int
    precio_venta: float

class ClaseCreate(BaseModel):
    nombre: str
    coach: str
    capacidad_max: int

# --- API ---

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# PLANES
@app.get("/api/planes", response_model=List[PlanResponse])
def get_planes(db: Session = Depends(get_db)):
    return db.query(PlanDB).all()

@app.post("/api/planes")
def create_plan(plan: PlanBase, db: Session = Depends(get_db)):
    new_plan = PlanDB(**plan.dict())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan

# ALUMNOS
@app.get("/api/alumnos")
def get_alumnos(db: Session = Depends(get_db)):
    alumnos = db.query(AlumnoDB).all()
    res = []
    for a in alumnos:
        res.append({
            "id": a.id,
            "nombre": a.nombre,
            "email": a.email,
            "dni": a.dni,
            "plan_nombre": a.plan.nombre if a.plan else "N/A",
            "fecha_ultima_renovacion": str(a.fecha_ultima_renovacion),
            "fecha_vencimiento": str(a.fecha_vencimiento)
        })
    return res

@app.post("/api/alumnos")
def create_alumno(al: AlumnoCreate, db: Session = Depends(get_db)):
    new_al = AlumnoDB(
        nombre=al.nombre, email=al.email, dni=al.dni, plan_id=al.plan_id,
        fecha_vencimiento=datetime.datetime.strptime(al.fecha_vencimiento, "%Y-%m-%d").date(),
        fecha_ultima_renovacion=datetime.datetime.strptime(al.fecha_ultima_renovacion, "%Y-%m-%d").date()
    )
    db.add(new_al)
    db.commit()
    return {"status": "ok"}

# PRODUCTOS
@app.get("/api/productos")
def get_productos(db: Session = Depends(get_db)):
    return db.query(ProductoDB).all()

@app.post("/api/productos")
def create_producto(p: ProductoCreate, db: Session = Depends(get_db)):
    new_p = ProductoDB(**p.dict())
    db.add(new_p)
    db.commit()
    return {"status": "ok"}

# CLASES
@app.get("/api/clases")
def get_clases(db: Session = Depends(get_db)):
    return db.query(ClaseDB).all()

@app.post("/api/clases")
def create_clase(c: ClaseCreate, db: Session = Depends(get_db)):
    new_c = ClaseDB(**c.dict())
    db.add(new_c)
    db.commit()
    return {"status": "ok"}

# CAJA
@app.get("/api/caja")
def get_caja(db: Session = Depends(get_db)):
    return db.query(CajaDB).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)