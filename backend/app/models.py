"""SQLAlchemy ORM models.

These mirror the tables from the old Supabase schema, minus the WhatsApp
`messages` table and the unused `todos` table.

Money is stored as Float here because SQLite has no native decimal type. If you
move to Postgres, switch these to `Numeric(10, 2)` for exact currency maths.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Current time as an aware UTC datetime.

    Kept timezone-aware so it is correct on Postgres. SQLite silently drops the
    tzinfo on write; `ORMModel._serialize_created_at` in schemas.py re-stamps
    UTC on the way out so clients never see an ambiguous timestamp.
    """
    return datetime.now(timezone.utc)


class AdminUser(Base):
    """Admin console logins.

    Separate from `users` (store staff / riders), which has no password and is
    operational data. Auth identities and staff records are different concerns.
    """

    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    """Store staff: managers and delivery riders."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # 'manager' | 'delivery'
    phone: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    base_latitude: Mapped[float] = mapped_column(Float, nullable=False, default=23.7272)
    base_longitude: Mapped[float] = mapped_column(Float, nullable=False, default=92.7178)
    service_radius_km: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sku: Mapped[str | None] = mapped_column(String)
    barcode: Mapped[str | None] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(String)
    brand: Mapped[str | None] = mapped_column(String)
    unit: Mapped[str | None] = mapped_column(String)
    price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cost_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    mrp: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    location: Mapped[str | None] = mapped_column(String)
    supplier_name: Mapped[str | None] = mapped_column(String)
    supplier_phone: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_phone: Mapped[str] = mapped_column(String, nullable=False)
    customer_name: Mapped[str] = mapped_column(String, nullable=False, default="Customer")
    customer_address: Mapped[str] = mapped_column(String, nullable=False, default="Bazar Bawn, Aizawl")
    customer_latitude: Mapped[float] = mapped_column(Float, nullable=False, default=23.7272)
    customer_longitude: Mapped[float] = mapped_column(Float, nullable=False, default=92.7178)
    status: Mapped[str] = mapped_column(String, nullable=False, default="Pending")
    delivery_boy_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    offered_to_delivery_boy_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    offered_distance_km: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # `items` is what the frontend expects the list to be called, so naming the
    # relationship `items` means the response model needs no renaming.
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",  # loads all items in one extra query, avoiding N+1
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    # RESTRICT, not CASCADE: deleting a product must never quietly erase line
    # items from past orders. `name` and `price` are denormalised onto this row
    # precisely so order history survives catalogue changes -- cascading would
    # destroy the record anyway. The delete route turns this into a clear 409.
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    order: Mapped[Order] = relationship(back_populates="items")
