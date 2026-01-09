from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de NeonDB
SQLALCHEMY_DATABASE_URL = "postgresql://neondb_owner:npg_FnbJO0iYd7Lv@ep-falling-sunset-ahqks10f-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()