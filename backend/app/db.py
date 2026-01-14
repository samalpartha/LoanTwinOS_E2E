from sqlmodel import SQLModel, create_engine
import os
import shutil

# Default local path
DB_PATH = "./data/loantwin.db"
DB_URL = f"sqlite:///{DB_PATH}"

# Cloud Run detection
if os.getenv("K_SERVICE"):
    # Always use /tmp in cloud to ensure writability
    # We defer the copy logic to init_db to avoid import-time errors
    DB_URL = "sqlite:////tmp/loantwin.db"

# Create engine with the URL determined above
engine = create_engine(DB_URL, echo=False)

def init_db():
    print(f"Initializing DB configuration for {os.getenv('K_SERVICE', 'LOCAL')} environemnt...")
    
    # Cloud specific initialization
    if os.getenv("K_SERVICE"):
        try:
            tmp_db = "/tmp/loantwin.db"
            source_db = "/app/data/loantwin.db"
            
            if os.path.exists(source_db):
                print(f"Source DB found at {source_db}. Copying to {tmp_db}...")
                # Use copyfile as it's cleaner for data
                if not os.path.exists(tmp_db):
                    shutil.copyfile(source_db, tmp_db)
                    print(f"DB successfully copied to {tmp_db}")
            else:
                print(f"WARNING: Source DB not found at {source_db}. Starting with empty DB.")
                
        except Exception as e:
            # Log but DO NOT CRASH. We want the container to start.
            print(f"ERROR during Cloud DB setup: {e}")

    # Create tables (idempotent)
    try:
        print("Running SQLModel.create_all...")
        SQLModel.metadata.create_all(engine)
        print("Database initialized successfully.")
    except Exception as e:
        # Log but DO NOT CRASH.
        print(f"CRITICAL ERROR creating tables: {e}")
        # We allow the app to start so we can inspect /health



