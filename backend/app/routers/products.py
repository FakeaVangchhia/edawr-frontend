"""Admin product CRUD.

Replaces the old Next.js files:
    src/app/api/products/route.ts        -> GET  /api/products, POST /api/products
    src/app/api/products/[id]/route.ts   -> PUT  /api/products/{product_id}
                                            DELETE /api/products/{product_id}

Read this file first if you are learning the routing model -- it exercises
every piece: router prefix, router-level dependencies, path params, request
bodies, response models, and status codes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OrderItem, Product
from app.schemas import ProductCreate, ProductOut, ProductUpdate, SuccessResponse
from app.security import require_admin

# An APIRouter is a group of related routes that gets mounted onto the app.
#
#   prefix       -> prepended to every path below, so @router.get("") is
#                   really GET /api/products. Declare the shared part once.
#   tags         -> groups these routes in the /docs page. Cosmetic only.
#   dependencies -> runs for EVERY route in this router. Because all four
#                   endpoints here are admin-only, the guard goes on the router
#                   instead of being repeated four times. A route added later
#                   is protected automatically -- you cannot forget it.
router = APIRouter(
    prefix="/api/products",
    tags=["products"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    """GET /api/products -- every product, oldest first.

    `response_model=list[ProductOut]` does three things at once: it converts
    each ORM object to JSON, strips any field not declared on ProductOut, and
    documents the response shape in OpenAPI.
    """
    return db.scalars(select(Product).order_by(Product.id)).all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """POST /api/products

    `payload: ProductCreate` is the whole trick. Because ProductCreate is a
    Pydantic model (not a scalar and not a Depends), FastAPI reads it from the
    JSON request body and validates it. A bad body returns 422 automatically --
    there is no manual parsing step like `await request.json()`.
    """
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)  # reload so server-side defaults (id, created_at) are populated
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    """PUT /api/products/{product_id}

    Two parameters, two different sources, inferred by name:
      - `product_id` appears in the path string, so it is a PATH parameter.
        The `: int` annotation makes FastAPI coerce and validate it; a request
        to /api/products/abc gets a 422 and never reaches this function.
      - `payload` is a Pydantic model, so it is the BODY.
    """
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")

    # PUT replaces the resource, so every field is overwritten.
    for field, value in payload.model_dump().items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", response_model=SuccessResponse)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """DELETE /api/products/{product_id}

    Refuses to delete a product that appears in any order, so order history is
    never rewritten. The caller is told to deactivate it instead, which hides it
    from the storefront (see routers/store.py) while keeping the record intact.

    Returns `{"success": true}` because that is what the existing frontend
    expects. A stricter API would return 204 No Content with an empty body.
    """
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")

    order_count = db.scalar(
        select(func.count())
        .select_from(OrderItem)
        .where(OrderItem.product_id == product_id)
    )
    if order_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This product appears in {order_count} order(s) and cannot be deleted. "
                'Set its status to "inactive" to hide it from the storefront instead.'
            ),
        )

    db.delete(product)
    db.commit()
    return SuccessResponse()
