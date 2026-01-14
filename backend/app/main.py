from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .db import init_db
from .routers import health, documents, loans, auth, agent, market_intelligence, ai, voice, support, workflows, exports, data_import, risk, vetting, audit, experts, covenants, lma
import traceback

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the database
    init_db()
    yield
    # Shutdown logic if needed
    pass

app = FastAPI(
    title="LoanTwin OS API", 
    version="4.0.0",
    description="The Self-Driving Loan Asset Platform - Enterprise Edition",
    lifespan=lifespan
)

# Robust CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Global exception handler to ensure CORS headers are sent on errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions with proper CORS headers."""
    error_detail = str(exc)
    tb = traceback.format_exc()
    print(f"[ERROR] {request.url.path}: {error_detail}\n{tb}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": error_detail,
            "path": str(request.url.path),
            "type": type(exc).__name__
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Include all routers
app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(loans.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(market_intelligence.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(data_import.router, prefix="/api")
app.include_router(risk.router, prefix="/api")
app.include_router(vetting.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(experts.router, prefix="/api")
app.include_router(covenants.router, prefix="/api")
app.include_router(lma.router, prefix="/api")

# Root level health check for convenience
@app.get("/health", tags=["health"])
def root_health():
    return {"ok": True, "status": "online", "version": "3.0.0"}
