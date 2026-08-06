"""Admin category CRUD.

Replaces:
    src/app/api/categories/route.ts       -> GET, POST  /api/categories
    src/app/api/categories/[id]/route.ts  -> PUT, DELETE /api/categories/{id}
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate, SuccessResponse
from app.security import require_admin

router = APIRouter(
    prefix="/api/categories",
    tags=["categories"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    # Guard against pointing a category at a parent that does not exist --
    # SQLite would happily accept the dangling id otherwise.
    if payload.parent_id is not None and db.get(Category, payload.parent_id) is None:
        raise HTTPException(status_code=400, detail="Parent category not found.")

    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    if payload.parent_id is not None:
        if payload.parent_id == category_id:
            raise HTTPException(status_code=400, detail="A category cannot be its own parent.")
        if db.get(Category, payload.parent_id) is None:
            raise HTTPException(status_code=400, detail="Parent category not found.")

    for field, value in payload.model_dump().items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", response_model=SuccessResponse)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    db.delete(category)
    db.commit()
    return SuccessResponse()
