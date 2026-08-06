"""Rider-facing endpoints for the mobile app.

Replaces:
    src/app/api/delivery/riders/route.ts          -> GET /api/delivery/riders
    src/app/api/delivery/[id]/dashboard/route.ts  -> GET /api/delivery/{id}/dashboard

Both are public, because the Expo app still has no login. That is a known gap,
not an oversight -- see the README.

**Route ordering note.** These two paths have different shapes (`/riders` is one
segment, `/{delivery_id}/dashboard` is two), so they cannot collide. But if you
ever add a plain `GET /api/delivery/{delivery_id}`, it *would* match the literal
string "riders" and try to parse it as an int. FastAPI matches routes top to
bottom and takes the first hit, so the fixed path must be registered before the
parameterised one. Keeping literal paths above `{param}` paths is the habit that
avoids the bug.
"""

import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, User
from app.schemas import DeliveryDashboard, OrderOut, UserOut

router = APIRouter(prefix="/api/delivery", tags=["delivery"])

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points, in kilometres."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Literal path -- registered before the parameterised one below. See module docstring.
@router.get("/riders", response_model=list[UserOut])
def list_riders(db: Session = Depends(get_db)):
    """GET /api/delivery/riders -- profiles the mobile login screen offers."""
    stmt = select(User).where(User.role == "delivery").order_by(User.id)
    return db.scalars(stmt).all()


@router.get("/{delivery_id}/dashboard", response_model=DeliveryDashboard)
def rider_dashboard(delivery_id: int, db: Session = Depends(get_db)):
    """GET /api/delivery/{delivery_id}/dashboard

    Buckets every order relative to one rider:
      - incoming: Pending, within the rider's service radius, not offered to
                  a different rider
      - active:   Assigned to this rider
      - recent:   Delivered by this rider (latest 10)
    """
    rider = db.get(User, delivery_id)
    if rider is None:
        raise HTTPException(status_code=404, detail="Delivery rider not found.")
    if rider.role != "delivery":
        raise HTTPException(status_code=400, detail="User is not a delivery rider.")

    orders = db.scalars(select(Order).order_by(Order.id.desc())).all()

    def to_out(order: Order) -> OrderOut:
        """Convert to the response schema, filling in distance if unset.

        Building an OrderOut rather than assigning onto the ORM object keeps
        this a pure read -- nothing here should write to the database.
        """
        out = OrderOut.model_validate(order)
        if out.offered_distance_km is None:
            out.offered_distance_km = haversine_km(
                rider.base_latitude,
                rider.base_longitude,
                order.customer_latitude,
                order.customer_longitude,
            )
        return out

    all_orders = [to_out(order) for order in orders]

    active_order = next(
        (o for o in all_orders if o.delivery_boy_id == delivery_id and o.status == "Assigned"),
        None,
    )

    recent_orders = [
        o for o in all_orders if o.delivery_boy_id == delivery_id and o.status == "Delivered"
    ][:10]

    incoming_orders = [
        o
        for o in all_orders
        if o.status == "Pending"
        # not already claimed -- a Pending order with a rider attached is in an
        # inconsistent state, and offering it would only produce a 409 on accept
        and o.delivery_boy_id is None
        # not already promised to a different rider
        and o.offered_to_delivery_boy_id in (None, delivery_id)
        # and close enough to be worth offering
        and (o.offered_distance_km or 0.0) <= rider.service_radius_km
    ]

    return DeliveryDashboard(
        incoming_orders=incoming_orders,
        active_order=active_order,
        recent_orders=recent_orders,
    )
