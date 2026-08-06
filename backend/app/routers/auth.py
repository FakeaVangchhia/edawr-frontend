"""Admin login.

Replaces the Supabase Auth flow that AdminLogin.tsx used to call directly.
The frontend POSTs {email, password} and expects {access_token, username}.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminUser
from app.schemas import LoginRequest, LoginResponse
from app.security import create_access_token, require_admin, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """POST /api/auth/login

    Note this route is NOT protected -- it is how you get a token in the first
    place. It is in a router with no router-level dependency, which is exactly
    why auth lives in its own router rather than alongside protected routes.
    """
    admin = db.scalar(select(AdminUser).where(AdminUser.email == payload.email.strip().lower()))

    # Same error whether the email is unknown or the password is wrong, so the
    # response cannot be used to enumerate which admin emails exist.
    if admin is None or not admin.is_active or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return LoginResponse(
        access_token=create_access_token(admin.email),
        username=admin.email,
    )


@router.get("/me", response_model=LoginResponse)
def me(admin: AdminUser = Depends(require_admin)):
    """GET /api/auth/me -- lets the frontend check whether a stored token is
    still valid, and issues a fresh one. Guarded per-route via Depends, since
    the sibling /login route must stay public.
    """
    return LoginResponse(
        access_token=create_access_token(admin.email),
        username=admin.email,
    )
