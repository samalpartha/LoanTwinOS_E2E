from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routers import health, documents, loans, auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the database
    init_db()
    yield
    # Shutdown logic if needed
    pass

app = FastAPI(
    title="LoanTwin OS API", 
    version="1.0.0",
    lifespan=lifespan
)

# Robust CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(loans.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
