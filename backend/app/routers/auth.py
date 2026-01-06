from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import User
from ..models.schemas import UserCreate, UserOut, UserLogin

router = APIRouter(tags=["auth"])

@router.post("/auth/social-login", response_model=UserOut)
def social_login(payload: UserCreate):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == payload.email)).first()
        if not user:
            user = User(
                full_name=payload.full_name,
                email=payload.email,
                social_provider=payload.social_provider,
                picture_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={payload.email}"
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        return UserOut.model_validate(user)

@router.post("/auth/register", response_model=UserOut)
def register(payload: UserCreate):
    with Session(engine) as session:
        # Check if user exists
        existing = session.exec(select(User).where(User.email == payload.email)).first()
        if existing:
            raise HTTPException(400, "Email already registered")
        
        user = User(
            full_name=payload.full_name,
            email=payload.email,
            hashed_password=f"hash_{payload.password}", # Mock hashing
            social_provider=None,
            picture_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={payload.email}"
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return UserOut.model_validate(user)

@router.post("/auth/login", response_model=UserOut)
def login(payload: UserLogin):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == payload.email)).first()
        if not user or user.hashed_password != f"hash_{payload.password}":
            raise HTTPException(401, "Invalid email or password")
        return UserOut.model_validate(user)

@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")
        return UserOut.model_validate(user)
