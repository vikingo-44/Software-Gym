from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import models
from database import SessionLocal, engine
from datetime import datetime, date

# Crea las tablas en la base de datos si no existen
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vikingo Strength Hub API")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DEPENDENCIAS ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- RUTA RAÍZ (Para evitar el 404 en Render) ---
@app.get("/")
async def root():
    return {
        "status": "active",
        "message": "Vikingo Strength Hub API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }

# --- ENDPOINTS: DASHBOARD ---

@app.get("/api/dashboard/metrics", response_model=models.DashboardMetrics)
async def get_dashboard_metrics(db: Session = Depends(get_db)):
    """ Obtiene métricas reales del Dashboard """
    return {
        "checkins_recientes": [], 
        "top_clases": [],         
        "metrica_asistencia": []  
    }

# --- ENDPOINTS: ALUMNOS ---

@app.get("/api/alumnos", response_model=List[models.AlumnoBase])
async def get_alumnos(db: Session = Depends(get_db)):
    """ Lista de alumnos ordenada por nombre """
    return db.query(models.Alumno).order_by(models.Alumno.nombre).all()

@app.post("/api/alumnos", status_code=status.HTTP_201_CREATED)
async def create_alumno(alumno: models.AlumnoBase, db: Session = Depends(get_db)):
    """ Crea un alumno en la base de datos """
    db_alumno = models.Alumno(**alumno.model_dump()) # Usamos model_dump() para Pydantic v2
    db.add(db_alumno)
    db.commit()
    db.refresh(db_alumno)
    return db_alumno

# --- ENDPOINTS: CAJA & FACTURACIÓN ---

@app.get("/api/caja/movements")
async def get_caja_movements(db: Session = Depends(get_db)):
    return db.query(models.CajaMovement).order_by(models.CajaMovement.fecha_hora.desc()).all()

# --- ENDPOINTS: PERFIL ---

@app.get("/api/admin/profile")
async def get_admin_profile(db: Session = Depends(get_db)):
    admin = db.query(models.Admin).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin no encontrado")
    return admin

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)