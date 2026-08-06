"""Pydantic schemas: the shape of what goes in and what comes out.

Two jobs:

1. **Request schemas** (`ProductCreate`, `LoginRequest`, ...) validate the
   incoming JSON. If the body does not match, FastAPI rejects it with a 422
   before your function ever runs.
2. **Response schemas** (`ProductOut`, `OrderOut`, ...) declare what leaves.
   `response_model=` filters the output to exactly these fields, so you cannot
   accidentally leak a password hash by returning an ORM object.

`from_attributes=True` lets a schema read a SQLAlchemy object's attributes
directly, so a route can `return db_product` and FastAPI converts it.
"""

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", check_fields=False)
    def _serialize_created_at(self, value: datetime | None) -> str | None:
        """Always emit an explicitly-UTC timestamp ending in `Z`.

        SQLite has no timezone type, so SQLAlchemy hands back a *naive*
        datetime even though the column is declared `DateTime(timezone=True)`.
        Serialized bare, that produces "2026-08-06T18:18:53" -- and JavaScript
        parses an offset-less ISO string as LOCAL time, so `new Date(...)` in
        the dashboards would read a UTC instant as if it were IST and display
        it 5h30m off.

        Values are stored as UTC, so a naive value is stamped UTC here rather
        than converted. `check_fields=False` lets schemas without a
        `created_at` field (e.g. OrderItemOut) inherit this harmlessly.
        """
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


# --------------------------------------------------------------------------
# Products
# --------------------------------------------------------------------------
class ProductBase(BaseModel):
    name: str = Field(min_length=1)
    sku: str | None = None
    barcode: str | None = None
    category: str | None = "General"
    brand: str | None = None
    unit: str | None = "unit"
    price: float = 0.0
    cost_price: float = 0.0
    mrp: float = 0.0
    stock: int = 0
    reorder_level: int = 0
    status: str = "active"
    location: str | None = None
    supplier_name: str | None = None
    supplier_phone: str | None = None
    description: str | None = None
    image_url: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductOut(ORMModel, ProductBase):
    id: int
    created_at: datetime


# --------------------------------------------------------------------------
# Categories
# --------------------------------------------------------------------------
class CategoryBase(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    parent_id: int | None = None
    status: str = "active"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    pass


class CategoryOut(ORMModel, CategoryBase):
    id: int
    created_at: datetime


# --------------------------------------------------------------------------
# Users (store staff / riders)
# --------------------------------------------------------------------------
class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    role: str
    phone: str = Field(min_length=1)
    base_latitude: float = 23.7272
    base_longitude: float = 92.7178
    service_radius_km: float = 10.0


class UserOut(ORMModel):
    id: int
    name: str
    role: str
    phone: str
    base_latitude: float
    base_longitude: float
    service_radius_km: float
    created_at: datetime


# --------------------------------------------------------------------------
# Orders
# --------------------------------------------------------------------------
class OrderItemOut(ORMModel):
    id: int
    order_id: int
    product_id: int
    quantity: int
    name: str
    price: float


class OrderOut(ORMModel):
    id: int
    customer_phone: str
    customer_name: str
    customer_address: str
    customer_latitude: float
    customer_longitude: float
    status: str
    delivery_boy_id: int | None
    offered_to_delivery_boy_id: int | None
    offered_distance_km: float | None
    created_at: datetime
    items: list[OrderItemOut] = []


class AssignRequest(BaseModel):
    delivery_boy_id: int


class StatusRequest(BaseModel):
    status: str


class RiderActionRequest(BaseModel):
    delivery_boy_id: int


# --------------------------------------------------------------------------
# Delivery dashboard
# --------------------------------------------------------------------------
class DeliveryDashboard(BaseModel):
    incoming_orders: list[OrderOut]
    active_order: OrderOut | None
    recent_orders: list[OrderOut]


# --------------------------------------------------------------------------
# Uploads
# --------------------------------------------------------------------------
class UploadResponse(BaseModel):
    image_url: str


class SuccessResponse(BaseModel):
    success: bool = True
