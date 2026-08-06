"""Public storefront catalog.

Replaces src/app/api/store/products/route.ts.

This is the only *public* read of product data, and it is a separate router
from `products.py` for exactly that reason: `products.py` carries a
router-level `require_admin`, and this must not. Splitting by access level
rather than by table keeps the guard honest.

It also returns a narrower row set (active products only), which is why the
frontend has two endpoints for one table in the first place.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product
from app.schemas import ProductOut

router = APIRouter(prefix="/api/store", tags=["storefront"])


@router.get("/products", response_model=list[ProductOut])
def list_store_products(db: Session = Depends(get_db)):
    """GET /api/store/products -- active products only.

    The old route matched `status in ('active', 'Active')`. Lowercasing in SQL
    handles those two plus any other casing that crept in.
    """
    stmt = (
        select(Product)
        .where(func.lower(Product.status) == "active")
        .order_by(Product.id)
    )
    return db.scalars(stmt).all()
