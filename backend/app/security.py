"""Password hashing, JWT issue/verify, and the `require_admin` dependency.

`require_admin` is the piece worth understanding. It replaces the old
`requireAdmin(request)` call that every Next.js admin route had to remember to
make. Here it is a *dependency*: attach it to a route (or a whole router) and
FastAPI runs it before the handler. If it raises, the handler never runs.

That inversion matters -- forgetting to guard a route becomes a visible
omission in the signature rather than a missing line buried in a function body.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AdminUser

# `auto_error=False` so we can return our own 401 shape ({"detail": ...})
# instead of Starlette's default, keeping the frontend's error handling working.
bearer_scheme = HTTPBearer(auto_error=False)


# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash in the database -- treat as a failed login, not a 500.
        return False


# --------------------------------------------------------------------------
# Tokens
# --------------------------------------------------------------------------
def create_access_token(subject: str) -> str:
    """Sign a JWT whose `sub` claim is the admin's email."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Return the `sub` claim, or None if the token is invalid/expired."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


# --------------------------------------------------------------------------
# Dependency
# --------------------------------------------------------------------------
def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    """Reject the request unless it carries a valid admin bearer token.

    Note this dependency itself depends on `get_db` -- dependencies compose,
    and FastAPI resolves the whole tree before calling the route.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        raise unauthorized

    email = decode_access_token(credentials.credentials)
    if email is None:
        raise unauthorized

    admin = db.scalar(select(AdminUser).where(AdminUser.email == email))
    if admin is None or not admin.is_active:
        raise unauthorized

    return admin
