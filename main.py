from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import datetime
import os
import models
from database import SessionLocal, engine

# Sincronizar tablas
models.Base.metadata.create_all(bind=engine)

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

# --- PLANES ---
@app.get("/api/planes")
def get_planes(db: Session = Depends(get_db)):
    planes = db.query(models.Plan).all()
    return [{
        "id": p.id, 
        "nombre": p.nombre or "Sin Nombre", 
        "precio": p.precio or 0.0, 
        "periodo": p.periodo or "mensual", 
        "tag": p.tag or "General", 
        "descripcion": p.descripcion or ""
    } for p in planes]

@app.post("/api/planes")
def create_plan(plan: dict, db: Session = Depends(get_db)):
    new_plan = models.Plan(**plan)
    db.add(new_plan)
    db.commit()
    return {"status": "ok"}

# --- ALUMNOS ---
@app.get("/api/alumnos")
def get_alumnos(db: Session = Depends(get_db)):
    alumnos = db.query(models.Alumno).all()
    res = []
    for a in alumnos:
        res.append({
            "id": a.id,
            "nombre": a.nombre or "N/A",
            "email": a.email or "",
            "dni": a.dni or "",
            "plan_nombre": a.plan.nombre if a.plan else "Sin Plan",
            "fecha_ultima_renovacion": str(a.fecha_ultima_renovacion) if a.fecha_ultima_renovacion else "-",
            "fecha_vencimiento": str(a.fecha_vencimiento) if a.fecha_vencimiento else "-"
        })
    return res

@app.post("/api/alumnos")
def create_alumno(al: models.AlumnoBase, db: Session = Depends(get_db)):
    new_al = models.Alumno(
        nombre=al.nombre, email=al.email, dni=al.dni, plan_id=al.plan_id,
        fecha_vencimiento=datetime.datetime.strptime(al.fecha_vencimiento, "%Y-%m-%d").date(),
        fecha_ultima_renovacion=datetime.datetime.strptime(al.fecha_ultima_renovacion, "%Y-%m-%d").date()
    )
    db.add(new_al)
    db.commit()
    return {"status": "ok"}

# --- PRODUCTOS (STOCK) ---
@app.get("/api/productos")
def get_productos(db: Session = Depends(get_db)):
    prods = db.query(models.Producto).all()
    return [{
        "id": p.id, 
        "nombre": p.nombre or "Producto", 
        "stock_actual": p.stock_actual if p.stock_actual is not None else 0, 
        "precio_venta": p.precio_venta or 0.0, 
        "categoria": p.categoria or "General"
    } for p in prods]

@app.post("/api/productos")
def create_producto(p: models.ProductoCreate, db: Session = Depends(get_db)):
    new_p = models.Producto(**p.dict())
    db.add(new_p)
    db.commit()
    return {"status": "ok"}

# --- CLASES ---
@app.get("/api/clases")
def get_clases(db: Session = Depends(get_db)):
    clases = db.query(models.Clase).all()
    return [{
        "id": c.id, 
        "nombre": c.nombre or "Clase", 
        "coach": c.coach or "Sin Coach", 
        "capacidad_max": c.capacidad_max or 0
    } for c in clases]

@app.post("/api/clases")
def create_clase(c: models.ClaseCreate, db: Session = Depends(get_db)):
    new_c = models.Clase(**c.dict())
    db.add(new_c)
    db.commit()
    return {"status": "ok"}

# --- ADMINS / PROFESORES ---
@app.get("/api/admins")
def get_admins(db: Session = Depends(get_db)):
    admins = db.query(models.Admin).all()
    return [{
        "id": str(a.id), 
        "nombre": a.nombre or "Admin", 
        "email": a.email or "", 
        "rol": a.rol or "Profesor", 
        "especialidad": a.especialidad or "General"
    } for a in admins]

@app.post("/api/admins")
def create_admin(ad: dict, db: Session = Depends(get_db)):
    new_ad = models.Admin(**ad)
    db.add(new_ad)
    db.commit()
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)