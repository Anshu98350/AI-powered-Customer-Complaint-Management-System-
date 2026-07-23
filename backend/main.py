import os
import json
import io
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from db import init_db, get_db, Complaint
from langgraph_workflow import complaint_app
from extraction_agent import chat_with_complaint_llm, edit_complaint_with_llm

class EditComplaintRequest(BaseModel):
    existing_data: dict
    edit_instruction: str
    api_key: Optional[str] = None

@app.post("/api/edit-complaint")
async def edit_complaint(payload: EditComplaintRequest):
    updated_data = edit_complaint_with_llm(
        existing_data=payload.existing_data,
        edit_instruction=payload.edit_instruction,
        api_key=payload.api_key
    )
    return {"status": "success", "updated": updated_data}


import PyPDF2
import docx

app = FastAPI(
    title="Pharma QMS AI Customer Complaint System",
    description="AI-powered Customer Complaint Intake & Triage Engine for API and FDF Manufacturing",
    version="1.0.0"
)

# CORS setup for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_db_client():
    init_db()

class TextExtractionRequest(BaseModel):
    text: str
    api_key: Optional[str] = None

class ChatRequest(BaseModel):
    complaint_context: dict
    user_question: str
    api_key: Optional[str] = None

class SaveComplaintRequest(BaseModel):
    complaint_source: Optional[str] = None
    customer_name: Optional[str] = None
    product_name: Optional[str] = None
    product_strength_grade: Optional[str] = None
    batch_lot_number: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    quantity_affected: Optional[str] = None
    complaint_type: Optional[str] = None
    complaint_date: Optional[str] = None
    detailed_description: Optional[str] = None
    initial_severity: Optional[str] = None
    priority: Optional[str] = None
    severity_reasoning: Optional[str] = None
    recommended_actions: Optional[str] = None
    status: Optional[str] = "Pending Triage"

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Pharma QMS AI Complaint API is running."}

@app.post("/api/extract-text")
async def extract_from_text(payload: TextExtractionRequest):
    initial_state = {
        "raw_document_text": payload.text,
        "api_key": payload.api_key or os.getenv("GROQ_API_KEY", ""),
        "extraction_stage": "Initiated",
        "progress_percentage": 10,
        "extracted_data": {},
        "error": ""
    }
    
    final_state = complaint_app.invoke(initial_state)
    return {
        "status": "success",
        "progress": final_state.get("progress_percentage", 100),
        "stage": final_state.get("extraction_stage", "Complete"),
        "extracted": final_state.get("extracted_data", {})
    }

@app.post("/api/extract-file")
async def extract_from_file(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None)
):
    filename = file.filename.lower()
    content = await file.read()
    extracted_text = ""

    try:
        if filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"
        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(content))
            for para in doc.paragraphs:
                extracted_text += para.text + "\n"
        else: # .txt, .eml, etc.
            extracted_text = content.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file format: {str(e)}")

    if not extracted_text.strip():
        extracted_text = f"Customer Complaint File received: {file.filename}. Please inspect attached batch certificates for OOS non-conformance."

    initial_state = {
        "raw_document_text": extracted_text,
        "api_key": api_key or os.getenv("GROQ_API_KEY", ""),
        "extraction_stage": "File Read Successfully",
        "progress_percentage": 20,
        "extracted_data": {},
        "error": ""
    }

    final_state = complaint_app.invoke(initial_state)
    return {
        "status": "success",
        "filename": file.filename,
        "progress": final_state.get("progress_percentage", 100),
        "stage": final_state.get("extraction_stage", "Complete"),
        "extracted": final_state.get("extracted_data", {})
    }

@app.post("/api/chat")
async def chat_with_assistant(payload: ChatRequest):
    reply = chat_with_complaint_llm(
        complaint_context=payload.complaint_context,
        user_question=payload.user_question,
        api_key=payload.api_key
    )
    return {"reply": reply}

@app.post("/api/complaints")
def save_complaint(complaint_data: SaveComplaintRequest, db: Session = Depends(get_db)):
    db_complaint = Complaint(
        complaint_source=complaint_data.complaint_source,
        customer_name=complaint_data.customer_name,
        product_name=complaint_data.product_name,
        product_strength_grade=complaint_data.product_strength_grade,
        batch_lot_number=complaint_data.batch_lot_number,
        manufacturing_date=complaint_data.manufacturing_date,
        expiry_date=complaint_data.expiry_date,
        quantity_affected=complaint_data.quantity_affected,
        complaint_type=complaint_data.complaint_type,
        complaint_date=complaint_data.complaint_date,
        detailed_description=complaint_data.detailed_description,
        initial_severity=complaint_data.initial_severity,
        priority=complaint_data.priority,
        severity_reasoning=complaint_data.severity_reasoning,
        recommended_actions=complaint_data.recommended_actions,
        status=complaint_data.status or "Pending Triage",
        extracted_metadata_json=json.dumps(complaint_data.dict())
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return {"status": "success", "id": db_complaint.id, "message": "Complaint recorded successfully in QMS Database."}

@app.get("/api/complaints")
def list_complaints(db: Session = Depends(get_db)):
    complaints = db.query(Complaint).order_by(Complaint.created_at.desc()).all()
    return complaints

@app.get("/api/complaints/{complaint_id}")
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return c
