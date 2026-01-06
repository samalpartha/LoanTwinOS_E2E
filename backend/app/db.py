from sqlmodel import SQLModel, create_engine
DB_URL = "sqlite:///./data/loantwin.db"
engine = create_engine(DB_URL, echo=False)
def init_db():
    SQLModel.metadata.create_all(engine)
