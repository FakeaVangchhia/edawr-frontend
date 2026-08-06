"""Store staff (managers and delivery riders).

Replaces src/app/api/users/route.ts.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import require_admin

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_admin)],
)

VALID_ROLES = {"manager", "delivery"}


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"role must be one of {sorted(VALID_ROLES)}.",
        )

    # `phone` is unique in the schema; check first so the caller gets a clear
    # 400 rather than a database IntegrityError surfacing as a 500.
    if db.scalar(select(User).where(User.phone == payload.phone)) is not None:
        raise HTTPException(status_code=400, detail="A user with that phone already exists.")

    user = User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
