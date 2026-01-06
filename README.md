# LoanTwin OS (Complete E2E)

LoanTwin OS turns long-form loan agreements (PDF) into:
- **Digital Loan Record (DLR)** (structured JSON)
- **Clause Explorer** (search + page ranges)
- **Obligation Calendar** (borrower reporting + notices)
- **Secondary Trade Due Diligence Pack** (checklist + risk flags)

## Run (Docker)
```bash
docker compose up --build
```

Open:
- Frontend: http://localhost:3000
- API: http://localhost:8000/api/health

## Demo Steps
1. Workspace → Create Loan
2. Upload a PDF
3. Process
4. Open DLR / Clause Explorer / Obligations / Trade Pack

## Key API Endpoints
- POST /api/loans
- POST /api/loans/{loanId}/documents
- POST /api/loans/{loanId}/process-document/{documentId}
- GET  /api/loans/{loanId}/dlr
- GET  /api/loans/{loanId}/clauses?query=...
- GET  /api/loans/{loanId}/obligations
- GET  /api/loans/{loanId}/trade-pack
