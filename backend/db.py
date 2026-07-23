import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pharma_qms.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    complaint_source = Column(String(255), nullable=True)
    customer_name = Column(String(255), nullable=True)
    product_name = Column(String(255), nullable=True)
    product_strength_grade = Column(String(255), nullable=True)
    batch_lot_number = Column(String(255), nullable=True)
    manufacturing_date = Column(String(100), nullable=True)
    expiry_date = Column(String(100), nullable=True)
    quantity_affected = Column(String(100), nullable=True)
    complaint_type = Column(String(255), nullable=True)
    complaint_date = Column(String(100), nullable=True)
    detailed_description = Column(Text, nullable=True)
    initial_severity = Column(String(100), nullable=True)  # Minor, Major, Critical
    priority = Column(String(100), nullable=True)          # Low, Medium, High, Urgent
    severity_reasoning = Column(Text, nullable=True)
    recommended_actions = Column(Text, nullable=True)
    status = Column(String(100), default="Pending Triage")  # Pending Triage, Under Investigation, Closed
    created_at = Column(DateTime, default=datetime.utcnow)
    extracted_metadata_json = Column(Text, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
