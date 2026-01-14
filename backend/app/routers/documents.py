from __future__ import annotations
import os, shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Document, Loan
from ..models.schemas import DocumentOut

router = APIRouter(tags=["documents"])
UPLOAD_DIR = "/tmp/uploads" if os.getenv("K_SERVICE") else "./data/uploads"

@router.post("/loans/{loan_id}/documents", response_model=DocumentOut)
def upload_document(loan_id: int, file: UploadFile = File(...)):
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        stored_path = os.path.join(UPLOAD_DIR, f"{loan_id}_{file.filename}")
        with open(stored_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        doc = Document(filename=file.filename, stored_path=stored_path, status="uploaded", loan_id=loan_id)
        session.add(doc); session.commit(); session.refresh(doc)
        return DocumentOut.model_validate(doc)

@router.get("/documents/{document_id}/file")
def get_document_file(document_id: int):
    with Session(engine) as session:
        doc = session.get(Document, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        if not os.path.exists(doc.stored_path):
            raise HTTPException(404, "File not found on disk")
        return FileResponse(doc.stored_path, media_type="application/pdf")

@router.get("/loans/{loan_id}/documents", response_model=list[DocumentOut])
def list_documents(loan_id: int):
    with Session(engine) as session:
        docs = session.exec(select(Document).where(Document.loan_id == loan_id)).all()
        return [DocumentOut.model_validate(d) for d in docs]
