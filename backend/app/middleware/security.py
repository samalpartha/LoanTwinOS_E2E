"""
Security Middleware - Enterprise-Grade Authentication & Authorization
Implements OAuth 2.0, MFA, RBAC, and session management
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from functools import wraps
import hashlib
import secrets
import json
import os

from fastapi import Request, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

# JWT handling
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

# TOTP for MFA
try:
    import pyotp
    TOTP_AVAILABLE = True
except ImportError:
    TOTP_AVAILABLE = False


# ============================================================================
# Configuration
# ============================================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "loantwin-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# OAuth 2.0 bearer scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ============================================================================
# Role-Based Access Control (RBAC)
# ============================================================================

class Role:
    """User roles with hierarchical permissions."""
    ADMIN = "admin"
    ANALYST = "analyst"
    TRADER = "trader"
    AUDITOR = "auditor"
    VIEWER = "viewer"


# Role hierarchy (higher roles inherit lower permissions)
ROLE_HIERARCHY = {
    Role.ADMIN: 100,
    Role.ANALYST: 70,
    Role.TRADER: 60,
    Role.AUDITOR: 50,
    Role.VIEWER: 10
}

# Permissions by resource
PERMISSIONS = {
    # Loan operations
    "loan:read": [Role.ADMIN, Role.ANALYST, Role.TRADER, Role.AUDITOR, Role.VIEWER],
    "loan:write": [Role.ADMIN, Role.ANALYST],
    "loan:delete": [Role.ADMIN],
    
    # Risk assessment
    "risk:assess": [Role.ADMIN, Role.ANALYST],
    "risk:view": [Role.ADMIN, Role.ANALYST, Role.TRADER, Role.AUDITOR],
    "risk:train": [Role.ADMIN],
    
    # Trade operations
    "trade:prepare": [Role.ADMIN, Role.TRADER],
    "trade:execute": [Role.ADMIN, Role.TRADER],
    "trade:view": [Role.ADMIN, Role.ANALYST, Role.TRADER, Role.AUDITOR],
    
    # Vetting & compliance
    "vetting:submit": [Role.ADMIN, Role.ANALYST],
    "vetting:verify": [Role.ADMIN, Role.AUDITOR],
    "vetting:view": [Role.ADMIN, Role.ANALYST, Role.AUDITOR],
    
    # Admin operations
    "users:manage": [Role.ADMIN],
    "settings:manage": [Role.ADMIN],
    "audit:view": [Role.ADMIN, Role.AUDITOR],
    "audit:export": [Role.ADMIN],
    
    # Data import
    "import:csv": [Role.ADMIN, Role.ANALYST],
    "import:url": [Role.ADMIN],
    
    # Expert network
    "experts:view": [Role.ADMIN, Role.ANALYST, Role.TRADER, Role.AUDITOR],
    "experts:engage": [Role.ADMIN, Role.ANALYST],
    "experts:manage": [Role.ADMIN]
}


def has_permission(user_role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    if permission not in PERMISSIONS:
        return False
    return user_role in PERMISSIONS[permission]


def require_permission(permission: str):
    """Decorator to require a specific permission."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from request context
            request = kwargs.get('request')
            if request:
                user = getattr(request.state, 'user', None)
                if user and has_permission(user.role, permission):
                    return await func(*args, **kwargs)
            raise HTTPException(403, f"Permission denied: {permission} required")
        return wrapper
    return decorator


# ============================================================================
# JWT Token Management
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    if not JWT_AVAILABLE:
        return secrets.token_urlsafe(32)
    
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "type": "access",
        "iat": datetime.utcnow()
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """Create JWT refresh token for token renewal."""
    if not JWT_AVAILABLE:
        return secrets.token_urlsafe(32)
    
    to_encode = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": datetime.utcnow(),
        "jti": secrets.token_urlsafe(16)  # Unique token ID for revocation
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token."""
    if not JWT_AVAILABLE:
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify token and return payload without raising exceptions."""
    if not JWT_AVAILABLE:
        return None
    
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        return None


# ============================================================================
# Multi-Factor Authentication (MFA)
# ============================================================================

class MFAManager:
    """TOTP-based Multi-Factor Authentication."""
    
    @staticmethod
    def generate_secret() -> str:
        """Generate a new TOTP secret for a user."""
        if not TOTP_AVAILABLE:
            return secrets.token_urlsafe(32)
        return pyotp.random_base32()
    
    @staticmethod
    def get_provisioning_uri(secret: str, email: str) -> str:
        """Get QR code provisioning URI for authenticator apps."""
        if not TOTP_AVAILABLE:
            return ""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name="LoanTwin OS")
    
    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        """Verify TOTP code."""
        if not TOTP_AVAILABLE:
            return True  # Skip MFA if not available
        
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)  # Allow 1 window tolerance


# ============================================================================
# Session Management
# ============================================================================

class SessionManager:
    """In-memory session management (use Redis in production)."""
    
    _sessions: Dict[str, Dict[str, Any]] = {}
    _refresh_tokens: Dict[str, str] = {}  # jti -> user_id
    
    @classmethod
    def create_session(cls, user_id: int, user_data: dict) -> str:
        """Create new session."""
        session_id = secrets.token_urlsafe(32)
        cls._sessions[session_id] = {
            "user_id": user_id,
            "user_data": user_data,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat()
        }
        return session_id
    
    @classmethod
    def get_session(cls, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data."""
        session = cls._sessions.get(session_id)
        if session:
            # Update last activity
            session["last_activity"] = datetime.utcnow().isoformat()
        return session
    
    @classmethod
    def invalidate_session(cls, session_id: str):
        """Invalidate/logout session."""
        if session_id in cls._sessions:
            del cls._sessions[session_id]
    
    @classmethod
    def invalidate_user_sessions(cls, user_id: int):
        """Invalidate all sessions for a user (password change, etc.)."""
        to_remove = [
            sid for sid, data in cls._sessions.items()
            if data.get("user_id") == user_id
        ]
        for sid in to_remove:
            del cls._sessions[sid]
    
    @classmethod
    def store_refresh_token(cls, jti: str, user_id: int):
        """Store refresh token JTI for validation."""
        cls._refresh_tokens[jti] = str(user_id)
    
    @classmethod
    def validate_refresh_token(cls, jti: str) -> bool:
        """Check if refresh token JTI is valid (not revoked)."""
        return jti in cls._refresh_tokens
    
    @classmethod
    def revoke_refresh_token(cls, jti: str):
        """Revoke a refresh token."""
        if jti in cls._refresh_tokens:
            del cls._refresh_tokens[jti]


# ============================================================================
# Password Hashing
# ============================================================================

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash password with salt using SHA-256 (use bcrypt in production)."""
    if salt is None:
        salt = secrets.token_hex(16)
    
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return hashed, salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """Verify password against stored hash."""
    computed_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(computed_hash, hashed)


# ============================================================================
# Request Authentication Middleware
# ============================================================================

async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[Dict[str, Any]]:
    """
    Extract and validate current user from request.
    Returns user data or None if not authenticated.
    """
    if not token:
        return None
    
    payload = decode_token(token)
    if not payload:
        return None
    
    # Check token type
    if payload.get("type") != "access":
        return None
    
    # Return user data from token
    return {
        "id": int(payload.get("sub", 0)),
        "email": payload.get("email"),
        "role": payload.get("role", Role.VIEWER),
        "full_name": payload.get("full_name")
    }


async def require_auth(
    user: Optional[Dict] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Require authentication for endpoint."""
    if not user:
        raise HTTPException(401, "Authentication required")
    return user


def require_role(allowed_roles: List[str]):
    """Dependency to require specific roles."""
    async def role_checker(user: Dict = Depends(require_auth)) -> Dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(403, f"Required roles: {', '.join(allowed_roles)}")
        return user
    return role_checker


# ============================================================================
# Rate Limiting
# ============================================================================

class RateLimiter:
    """Simple in-memory rate limiter (use Redis in production)."""
    
    _requests: Dict[str, List[datetime]] = {}
    
    @classmethod
    def check_rate_limit(
        cls,
        key: str,
        max_requests: int = 100,
        window_seconds: int = 60
    ) -> bool:
        """
        Check if request is within rate limit.
        Returns True if allowed, False if rate limited.
        """
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)
        
        if key not in cls._requests:
            cls._requests[key] = []
        
        # Clean old requests
        cls._requests[key] = [
            ts for ts in cls._requests[key]
            if ts > window_start
        ]
        
        if len(cls._requests[key]) >= max_requests:
            return False
        
        cls._requests[key].append(now)
        return True


# ============================================================================
# Security Headers Middleware
# ============================================================================

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin"
}


async def add_security_headers(request: Request, call_next):
    """Middleware to add security headers to all responses."""
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response


# ============================================================================
# Audit Trail Integration
# ============================================================================

def log_security_event(
    event_type: str,
    user_id: Optional[int],
    details: Dict[str, Any],
    ip_address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Log security-relevant events for audit trail.
    In production, this would write to immutable audit log.
    """
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
        "details": details
    }
    
    # In production: write to append-only log, send to SIEM, etc.
    # For now, just return the event structure
    return event


# Export commonly used functions
__all__ = [
    "Role",
    "has_permission",
    "require_permission",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "verify_token",
    "MFAManager",
    "SessionManager",
    "hash_password",
    "verify_password",
    "get_current_user",
    "require_auth",
    "require_role",
    "RateLimiter",
    "log_security_event",
    "PERMISSIONS",
    "ROLE_HIERARCHY"
]
