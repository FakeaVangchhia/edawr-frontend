"""Create the schema and load sample data.

Run once after installing:   python seed.py

**Destructive.** It drops and recreates every table, so re-running also picks up
model changes (SQLAlchemy's `create_all` only creates missing tables -- it never
alters an existing one). Any admin accounts you added by hand are dropped too
and only the seeded admin comes back. It does NOT touch uploaded files.

Once real data exists, stop using this and add Alembic migrations instead.
"""

import os
import sys

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import AdminUser, Category, Order, OrderItem, Product, User
from app.security import hash_password

# Lowercased to match the lookup in routers/auth.py, which normalises the
# submitted email. Storing "Admin@edawr.local" verbatim would create an account
# that can never be logged into.
DEFAULT_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "admin@edawr.local").strip().lower()
DEFAULT_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "admin1234")


def seed() -> None:
    # Drop rather than delete rows, so schema changes (new columns, changed
    # foreign key rules) actually take effect on an existing database file.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        # --- Admin login -----------------------------------------------
        db.add(
            AdminUser(
                email=DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
            )
        )

        # --- Staff -----------------------------------------------------
        manager = User(name="Lalthanpuia", role="manager", phone="+919000000001")
        rider_a = User(
            name="Zoramthanga",
            role="delivery",
            phone="+919000000002",
            base_latitude=23.7272,
            base_longitude=92.7178,
            service_radius_km=10.0,
        )
        rider_b = User(
            name="Vanlalruata",
            role="delivery",
            phone="+919000000003",
            base_latitude=23.7350,
            base_longitude=92.7250,
            service_radius_km=6.0,
        )
        db.add_all([manager, rider_a, rider_b])

        # --- Categories ------------------------------------------------
        categories = [
            Category(name="Vegetables", description="Fresh local produce"),
            Category(name="Dairy", description="Milk, curd, cheese"),
            Category(name="Staples", description="Rice, flour, pulses"),
            Category(name="Snacks", description="Packaged snacks"),
        ]
        db.add_all(categories)

        # --- Products --------------------------------------------------
        products = [
            Product(name="Milk", category="Dairy", brand="Amul", unit="litre",
                    price=62.0, cost_price=52.0, mrp=65.0, stock=40, reorder_level=10,
                    sku="DRY-MLK-001", description="Full cream milk, 1L pouch."),
            Product(name="Curd", category="Dairy", brand="Amul", unit="cup",
                    price=35.0, cost_price=28.0, mrp=38.0, stock=25, reorder_level=8,
                    sku="DRY-CRD-002", description="Set curd, 400g."),
            Product(name="Bread", category="Staples", brand="Britannia", unit="loaf",
                    price=45.0, cost_price=36.0, mrp=48.0, stock=18, reorder_level=6,
                    sku="STP-BRD-003", description="Whole wheat sandwich loaf."),
            Product(name="Rice", category="Staples", brand="Local", unit="kg",
                    price=58.0, cost_price=48.0, mrp=62.0, stock=120, reorder_level=25,
                    sku="STP-RCE-004", description="Aizawl local white rice."),
            Product(name="Potato", category="Vegetables", brand="Local", unit="kg",
                    price=32.0, cost_price=24.0, mrp=35.0, stock=80, reorder_level=20,
                    sku="VEG-POT-005", description="Fresh potatoes."),
            Product(name="Tomato", category="Vegetables", brand="Local", unit="kg",
                    price=44.0, cost_price=34.0, mrp=48.0, stock=35, reorder_level=12,
                    sku="VEG-TOM-006", description="Vine-ripened tomatoes."),
            Product(name="Onion", category="Vegetables", brand="Local", unit="kg",
                    price=38.0, cost_price=30.0, mrp=42.0, stock=0, reorder_level=15,
                    sku="VEG-ONI-007", description="Currently out of stock."),
            Product(name="Biscuits", category="Snacks", brand="Parle", unit="pack",
                    price=20.0, cost_price=15.0, mrp=22.0, stock=60, reorder_level=20,
                    sku="SNK-BIS-008", description="Glucose biscuits, 150g."),
            Product(name="Instant Noodles", category="Snacks", brand="Maggi", unit="pack",
                    price=14.0, cost_price=11.0, mrp=15.0, stock=90, reorder_level=30,
                    sku="SNK-NDL-009", description="Masala flavour, 70g."),
            Product(name="Cooking Oil", category="Staples", brand="Fortune", unit="litre",
                    price=145.0, cost_price=125.0, mrp=155.0, stock=22, reorder_level=8,
                    sku="STP-OIL-010", status="inactive",
                    description="Sunflower oil -- hidden from the storefront (status=inactive)."),
        ]
        db.add_all(products)
        db.flush()  # assign ids so order items can reference them

        by_name = {p.name: p for p in products}

        # --- Orders ----------------------------------------------------
        # NOTE: nothing in the app creates orders any more -- that lived in the
        # deleted WhatsApp webhook. These exist so the dashboards have data.
        # See the README's "Known gap" section.
        pending = Order(
            customer_phone="+919812345678",
            customer_name="Lalrinsangi",
            customer_address="Chanmari, Aizawl",
            customer_latitude=23.7300,
            customer_longitude=92.7200,
            status="Pending",
        )
        pending.items = [
            OrderItem(product_id=by_name["Milk"].id, quantity=2, name="Milk", price=62.0),
            OrderItem(product_id=by_name["Bread"].id, quantity=1, name="Bread", price=45.0),
        ]

        assigned = Order(
            customer_phone="+919887654321",
            customer_name="Remruatpuia",
            customer_address="Zarkawt, Aizawl",
            customer_latitude=23.7260,
            customer_longitude=92.7190,
            status="Assigned",
            delivery_boy_id=None,  # set after flush below
        )
        assigned.items = [
            OrderItem(product_id=by_name["Rice"].id, quantity=5, name="Rice", price=58.0),
            OrderItem(product_id=by_name["Potato"].id, quantity=2, name="Potato", price=32.0),
        ]

        delivered = Order(
            customer_phone="+919776655443",
            customer_name="Lalduhawma",
            customer_address="Bazar Bawn, Aizawl",
            customer_latitude=23.7280,
            customer_longitude=92.7165,
            status="Delivered",
        )
        delivered.items = [
            OrderItem(product_id=by_name["Biscuits"].id, quantity=3, name="Biscuits", price=20.0),
        ]

        db.add_all([pending, assigned, delivered])
        db.flush()

        # Link the two non-pending orders to the first rider.
        assigned.delivery_boy_id = rider_a.id
        delivered.delivery_boy_id = rider_a.id

        db.commit()

        print("Seeded:")
        print(f"  admin login      {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_PASSWORD}")
        print(f"  staff            {db.scalar(select(User).where(User.role == 'manager')).name} + 2 riders")
        print(f"  products         {len(products)} ({len(products) - 1} active, 1 inactive)")
        print(f"  categories       {len(categories)}")
        print("  orders           3 (1 Pending, 1 Assigned, 1 Delivered)")


if __name__ == "__main__":
    try:
        seed()
    except Exception as exc:  # noqa: BLE001
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise
