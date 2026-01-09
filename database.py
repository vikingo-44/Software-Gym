import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Carga las variables del archivo .env si existe (útil para desarrollo local)
load_dotenv()

# --- CONFIGURACIÓN DE URL ---
# Intentamos obtener la URL de la variable de entorno 'DATABASE_URL' (la que configuraste en Render)
# Si no existe, usamos la URL de NeonDB que proporcionaste como respaldo.
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://neondb_owner:npg_FnbJO0iYd7Lv@ep-falling-sunset-ahqks10f-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

# --- MOTOR DE BASE DE DATOS ---
# Creamos el engine para PostgreSQL
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# --- SESIÓN Y BASE ---
# Configuramos la fábrica de sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Definimos la base para que models.py pueda heredar de ella
Base = declarative_base()

# --- DEPENDENCIA PARA ENDPOINTS ---
# Esta función es la que usan tus rutas en main.py (Depends(database.get_db))
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()