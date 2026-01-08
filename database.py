import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Cargamos variables de entorno si existe un archivo .env (local)
load_dotenv()

# La URL de NeonDB se obtendrá de las variables de entorno de Render
# Formato: postgresql://user:password@host/dbname
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# En Render/NeonDB (PostgreSQL) necesitamos asegurar que la URL empiece con postgresql://
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# El motor de SQLAlchemy
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Sesión local para interactuar con la DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()