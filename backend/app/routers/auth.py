"""
Authentication Router - OAuth 2.0, MFA, and Session Management
Enterprise-grade authentication with JWT tokens and RBAC
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlmodel import Session, select
from datetime import datetime
import secrets

from ..db import engine
from ..models.tables import User
from ..models.schemas import UserCreate, UserOut, UserLogin
from ..middleware.security import (
    Role,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_token,
    hash_password,
    verify_password,
    SessionManager,
    MFAManager,
    get_current_user,
    require_auth,
    require_role,
    RateLimiter,
    log_security_event
)

router = APIRouter(tags=["auth"])


# ============================================================================
# Request/Response Models
# ============================================================================

class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: Dict[str, Any]


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


class MFASetupResponse(BaseModel):
    """MFA setup response with QR code URI."""
    secret: str
    provisioning_uri: str
    backup_codes: list[str]


class MFAVerifyRequest(BaseModel):
    """MFA verification request."""
    code: str


class PasswordChangeRequest(BaseModel):
    """Password change request."""
    current_password: str
    new_password: str


# ============================================================================
# Authentication Endpoints
# ============================================================================

@router.post("/auth/social-login", response_model=TokenResponse)
def social_login(payload: UserCreate, request: Request):
    """OAuth 2.0 social login (Google, GitHub, LinkedIn, etc.)"""
    
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not RateLimiter.check_rate_limit(f"login:{client_ip}", max_requests=10, window_seconds=60):
        raise HTTPException(429, "Too many login attempts. Please try again later.")
    
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == payload.email)).first()
        
        if not user:
            # Create new user from social login
            user = User(
                full_name=payload.full_name,
                email=payload.email,
                social_provider=payload.social_provider,
                picture_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={payload.email}",
                role=Role.ANALYST  # Default role for new users
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
            # Log security event
            log_security_event("user_created", user.id, {
                "method": "social_login",
                "provider": payload.social_provider
            }, client_ip)
        
        # Generate tokens
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name
        }
        
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(user.id)
        
        # Create session
        SessionManager.create_session(user.id, token_data)
        
        # Log login event
        log_security_event("login_success", user.id, {
            "method": "social_login",
            "provider": payload.social_provider
        }, client_ip)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "picture_url": user.picture_url
            }
        )


@router.post("/auth/register", response_model=TokenResponse)
def register(payload: UserCreate, request: Request):
    """Register new user with email/password."""
    
    client_ip = request.client.host if request.client else "unknown"
    
    with Session(engine) as session:
        # Check if user exists
        existing = session.exec(select(User).where(User.email == payload.email)).first()
        if existing:
            raise HTTPException(400, "Email already registered")
        
        # Hash password
        password_hash, salt = hash_password(payload.password or "")
        
        user = User(
            full_name=payload.full_name,
            email=payload.email,
            hashed_password=f"{password_hash}:{salt}",  # Store hash:salt
            social_provider=None,
            picture_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={payload.email}",
            role=Role.ANALYST
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        
        # Generate tokens
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name
        }
        
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(user.id)
        
        # Log event
        log_security_event("user_registered", user.id, {"method": "email"}, client_ip)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "picture_url": user.picture_url
            }
        )


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request):
    """Login with email/password."""
    
    client_ip = request.client.host if request.client else "unknown"
    
    # Rate limiting
    if not RateLimiter.check_rate_limit(f"login:{client_ip}", max_requests=5, window_seconds=60):
        log_security_event("login_rate_limited", None, {"email": payload.email}, client_ip)
        raise HTTPException(429, "Too many login attempts. Please try again later.")
    
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == payload.email)).first()
        
        if not user:
            log_security_event("login_failed", None, {"reason": "user_not_found"}, client_ip)
            raise HTTPException(401, "Invalid email or password")
        
        # Verify password
        if user.hashed_password:
            try:
                stored_hash, salt = user.hashed_password.split(":")
                if not verify_password(payload.password, stored_hash, salt):
                    log_security_event("login_failed", user.id, {"reason": "invalid_password"}, client_ip)
                    raise HTTPException(401, "Invalid email or password")
            except ValueError:
                # Legacy format fallback
                if user.hashed_password != f"hash_{payload.password}":
                    raise HTTPException(401, "Invalid email or password")
        
        # Check if MFA is required
        mfa_secret = getattr(user, 'mfa_secret', None)
        if mfa_secret:
            # Return partial token for MFA verification
            return {
                "requires_mfa": True,
                "mfa_token": create_access_token({"sub": str(user.id), "mfa_pending": True}),
                "user_id": user.id
            }
        
        # Generate tokens
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name
        }
        
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(user.id)
        
        # Create session
        SessionManager.create_session(user.id, token_data)
        
        log_security_event("login_success", user.id, {"method": "password"}, client_ip)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "picture_url": user.picture_url
            }
        )


@router.post("/auth/refresh")
def refresh_token(request_body: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    
    payload = decode_token(request_body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    
    # Verify refresh token is not revoked
    jti = payload.get("jti")
    if jti and not SessionManager.validate_refresh_token(jti):
        raise HTTPException(401, "Refresh token has been revoked")
    
    user_id = int(payload.get("sub", 0))
    
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(401, "User not found")
        
        # Generate new access token
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name
        }
        
        new_access_token = create_access_token(token_data)
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }


@router.post("/auth/logout")
def logout(request: Request, current_user: Dict = Depends(require_auth)):
    """Logout and invalidate session."""
    
    # Get token from header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = verify_token(token)
        if payload:
            jti = payload.get("jti")
            if jti:
                SessionManager.revoke_refresh_token(jti)
    
    # Invalidate user sessions
    SessionManager.invalidate_user_sessions(current_user.get("id"))
    
    log_security_event("logout", current_user.get("id"), {}, None)
    
    return {"message": "Logged out successfully"}


# ============================================================================
# MFA Endpoints
# ============================================================================

@router.post("/auth/mfa/setup", response_model=MFASetupResponse)
def setup_mfa(current_user: Dict = Depends(require_auth)):
    """Setup MFA for current user."""
    
    secret = MFAManager.generate_secret()
    email = current_user.get("email", "")
    provisioning_uri = MFAManager.get_provisioning_uri(secret, email)
    
    # Generate backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    
    # Store secret (in production, encrypt this)
    with Session(engine) as session:
        user = session.get(User, current_user.get("id"))
        if user:
            # Store MFA secret (add field to User model in production)
            # user.mfa_secret = secret
            # user.mfa_backup_codes = ",".join(backup_codes)
            session.commit()
    
    return MFASetupResponse(
        secret=secret,
        provisioning_uri=provisioning_uri,
        backup_codes=backup_codes
    )


@router.post("/auth/mfa/verify")
def verify_mfa(mfa_request: MFAVerifyRequest, request: Request):
    """Verify MFA code and complete login."""
    
    # Get pending MFA token from header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "MFA token required")
    
    token = auth_header[7:]
    payload = decode_token(token)
    
    if not payload or not payload.get("mfa_pending"):
        raise HTTPException(401, "Invalid MFA token")
    
    user_id = int(payload.get("sub", 0))
    
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(401, "User not found")
        
        # Verify TOTP code
        mfa_secret = getattr(user, 'mfa_secret', None)
        if not mfa_secret or not MFAManager.verify_code(mfa_secret, mfa_request.code):
            log_security_event("mfa_failed", user_id, {}, None)
            raise HTTPException(401, "Invalid MFA code")
        
        # Generate full access tokens
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
            "mfa_verified": True
        }
        
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(user.id)
        
        log_security_event("mfa_success", user_id, {}, None)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role
            }
        )


# ============================================================================
# User Management Endpoints
# ============================================================================

@router.get("/auth/me")
def get_current_user_info(current_user: Dict = Depends(require_auth)):
    """Get current authenticated user info."""
    return current_user


@router.post("/auth/password/change")
def change_password(
    password_request: PasswordChangeRequest,
    current_user: Dict = Depends(require_auth)
):
    """Change password for current user."""
    
    with Session(engine) as session:
        user = session.get(User, current_user.get("id"))
        if not user:
            raise HTTPException(404, "User not found")
        
        # Verify current password
        if user.hashed_password:
            try:
                stored_hash, salt = user.hashed_password.split(":")
                if not verify_password(password_request.current_password, stored_hash, salt):
                    raise HTTPException(401, "Current password is incorrect")
            except ValueError:
                pass
        
        # Set new password
        new_hash, new_salt = hash_password(password_request.new_password)
        user.hashed_password = f"{new_hash}:{new_salt}"
        session.add(user)
        session.commit()
        
        # Invalidate all sessions
        SessionManager.invalidate_user_sessions(user.id)
        
        log_security_event("password_changed", user.id, {}, None)
        
        return {"message": "Password changed successfully. Please log in again."}


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, current_user: Dict = Depends(require_auth)):
    """Get user by ID (admin or self only)."""
    
    if current_user.get("role") != Role.ADMIN and current_user.get("id") != user_id:
        raise HTTPException(403, "Access denied")
    
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")
        return UserOut.model_validate(user)


@router.get("/users")
def list_users(current_user: Dict = Depends(require_role([Role.ADMIN]))):
    """List all users (admin only)."""
    
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        return {
            "users": [
                {
                    "id": u.id,
                    "email": u.email,
                    "full_name": u.full_name,
                    "role": u.role,
                    "created_at": u.created_at.isoformat() if u.created_at else None
                }
                for u in users
            ]
        }


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    new_role: str,
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """Update user role (admin only)."""
    
    valid_roles = [Role.ADMIN, Role.ANALYST, Role.TRADER, Role.AUDITOR, Role.VIEWER]
    if new_role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Choose from: {valid_roles}")
    
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")
        
        old_role = user.role
        user.role = new_role
        session.add(user)
        session.commit()
        
        log_security_event("role_changed", user_id, {
            "old_role": old_role,
            "new_role": new_role,
            "changed_by": current_user.get("id")
        }, None)
        
        return {"message": f"User role updated to {new_role}"}
