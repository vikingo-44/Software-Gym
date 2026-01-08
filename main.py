from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import models
from datetime import datetime, date

app = FastAPI(title="Vikingo Strength Hub API")

# Configuración de CORS para que tu HTML pueda conectar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción, limita esto a tu dominio
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DEPENDENCIAS ---
# Aquí iría tu lógica de conexión a NeonDB (ej. create_engine)
def get_db():
    # Placeholder para la sesión de base de datos
    db = None 
    try:
        yield db
    finally:
        # db.close()
        pass

# --- ENDPOINTS: DASHBOARD ---

@app.get("/api/dashboard/metrics", response_model=models.DashboardMetrics)
async def get_dashboard_metrics(db: Session = Depends(get_db)):
    """ Obtiene todos los datos para los widgets del Dashboard """
    # Lógica para calcular check-ins, top clases y actividad
    return {
        "checkins_recientes": [], # Datos de la tabla caja_movements o una nueva de asistencias
        "top_clases": [],         # Conteo de reservas por clase
        "metrica_asistencia": []  # Datos para el gráfico de barras
    }

# --- ENDPOINTS: ALUMNOS ---

@app.get("/api/alumnos", response_model=List[models.AlumnoBase])
async def get_alumnos(db: Session = Depends(get_db)):
    """ Directorio maestro de alumnos A-Z """
    # return db.query(models.Alumno).order_by(models.Alumno.nombre).all()
    return []

@app.post("/api/alumnos", status_code=status.HTTP_201_CREATED)
async def create_alumno(alumno: models.AlumnoBase, db: Session = Depends(get_db)):
    """ Registra un nuevo vikingo en el sistema """
    return {"message": "Alumno registrado con éxito"}

# --- ENDPOINTS: CAJA & FACTURACIÓN ---

@app.get("/api/caja/movements")
async def get_caja_movements(db: Session = Depends(get_db)):
    """ Historial de movimientos de caja """
    return []

@app.post("/api/caja/movements")
async def add_movement(descripcion: str, monto: float, tipo: str):
    """ Registra un nuevo ingreso o egreso """
    return {"message": "Movimiento registrado"}

# --- ENDPOINTS: STOCK ---

@app.get("/api/stock")
async def get_inventory(db: Session = Depends(get_db)):
    """ Lista de productos y suplementos """
    return []

# --- ENDPOINTS: CALENDARIO ---

@app.get("/api/calendario/semana")
async def get_weekly_schedule(start_date: date):
    """ Obtiene las clases agendadas para la semana actual """
    return []

@app.post("/api/calendario/asignar")
async def schedule_class(clase_id: int, fecha: date, hora: int):
    """ Asigna una clase al calendario (Drag & Drop) """
    return {"message": "Clase agendada correctamente"}

# --- ENDPOINTS: PERFIL ---

@app.get("/api/admin/profile")
async def get_admin_profile(admin_id: str):
    """ Obtiene la data de Gonzalo Luongo para el perfil """
    return {
        "nombre": "Gonzalo Federico Luongo",
        "especialidad": "Powerlifting & Weightlifting",
        "rol": "Master Admin"
    }

@app.put("/api/admin/profile")
async def update_profile(data: dict):
    """ Actualiza la info personal o contraseña """
    return {"message": "Perfil actualizado"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)