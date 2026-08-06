"""Orders: manager listing/assignment, and rider accept/reject/status.

Replaces:
    src/app/api/orders/route.ts               -> GET   /api/orders
    src/app/api/orders/[id]/assign/route.ts   -> POST  /api/orders/{id}/assign
    src/app/api/orders/[id]/status/route.ts   -> PATCH /api/orders/{id}/status
    src/app/api/orders/[id]/accept/route.ts   -> POST  /api/orders/{id}/accept
    src/app/api/orders/[id]/reject/route.ts   -> POST  /api/orders/{id}/reject

**Access is mixed in this file**, so unlike products.py there is no
router-level dependency. The manager routes carry
`admin: AdminUser = Depends(require_admin)` individually; the three rider
routes are public because the mobile app still has no login.

That asymmetry is deliberate and load-bearing: if you ever add rider auth,
these three routes are the ones to change, and their bare signatures make them
easy to find.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminUser, Order, User
from app.schemas import (
    AssignRequest,
    OrderOut,
    RiderActionRequest,
    StatusRequest,
    SuccessResponse,
)
from app.security import require_admin

router = APIRouter(prefix="/api/orders", tags=["orders"])

VALID_STATUSES = {"Pending", "Assigned", "Delivered"}


def _get_order(db: Session, order_id: int) -> Order:
    """Small helper so every route 404s identically."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


def _get_rider(db: Session, rider_id: int) -> User:
    rider = db.get(User, rider_id)
    if rider is None or rider.role != "delivery":
        raise HTTPException(status_code=400, detail="Delivery rider not found.")
    return rider


# --------------------------------------------------------------------------
# Manager routes (admin token required)
# --------------------------------------------------------------------------
@router.get("", response_model=list[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """GET /api/orders -- newest first, each with its items nested.

    The old Supabase route selected `*, order_items(*)` and then renamed
    `order_items` to `items`. Here the model's relationship is already called
    `items` and OrderOut declares it, so the nesting is automatic.
    """
    return db.scalars(select(Order).order_by(Order.id.desc())).all()


@router.post("/{order_id}/assign", response_model=OrderOut)
def assign_order(
    order_id: int,
    payload: AssignRequest,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """POST /api/orders/{order_id}/assign -- manager assigns a rider."""
    order = _get_order(db, order_id)
    _get_rider(db, payload.delivery_boy_id)

    order.delivery_boy_id = payload.delivery_boy_id
    order.status = "Assigned"
    db.commit()
    db.refresh(order)
    return order


# --------------------------------------------------------------------------
# Rider routes (public -- the mobile app has no auth yet)
# --------------------------------------------------------------------------
@router.patch("/{order_id}/status", response_model=OrderOut)
def update_status(order_id: int, payload: StatusRequest, db: Session = Depends(get_db)):
    """PATCH /api/orders/{order_id}/status

    PATCH, not PUT, because it changes one field rather than replacing the
    order. The mobile app sends PATCH here and POST to accept/reject.
    """
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(VALID_STATUSES)}.",
        )

    order = _get_order(db, order_id)
    order.status = payload.status

    # Returning an order to the pool must also release the rider. Otherwise the
    # order shows up in every rider's incoming feed (the feed filters on status)
    # while `accept` rejects all of them with 409 because it still looks taken.
    if payload.status == "Pending":
        order.delivery_boy_id = None
        order.offered_to_delivery_boy_id = None

    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/accept", response_model=OrderOut)
def accept_order(order_id: int, payload: RiderActionRequest, db: Session = Depends(get_db)):
    """POST /api/orders/{order_id}/accept -- rider claims a pending order."""
    order = _get_order(db, order_id)
    _get_rider(db, payload.delivery_boy_id)

    # Only a Pending order can be claimed. Without this, a stale mobile screen
    # (or any caller, since this route is unauthenticated) could POST /accept on
    # an already-Delivered order and resurrect it -- pulling it out of the
    # rider's recent list and back into their active slot.
    if order.status != "Pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This order is no longer available (status: {order.status}).",
        )

    # Guard the race the old route did not: two riders tapping Accept on the
    # same order. Whoever commits first wins; the second gets a clear 409
    # instead of silently stealing the order.
    if order.delivery_boy_id is not None and order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order has already been taken by another rider.",
        )

    order.delivery_boy_id = payload.delivery_boy_id
    order.status = "Assigned"
    order.offered_to_delivery_boy_id = None
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/reject", response_model=SuccessResponse)
def reject_order(order_id: int, payload: RiderActionRequest, db: Session = Depends(get_db)):
    """POST /api/orders/{order_id}/reject -- rider declines an offered order.

    Clears the offer so the order returns to the pool for other riders.
    """
    order = _get_order(db, order_id)

    if order.offered_to_delivery_boy_id == payload.delivery_boy_id:
        order.offered_to_delivery_boy_id = None
        db.commit()

    return SuccessResponse()
