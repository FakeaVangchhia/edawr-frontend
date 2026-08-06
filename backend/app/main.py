"""FastAPI application entrypoint.

This file does four things and nothing else:
  1. creates the app
  2. enables CORS so the browser will let localhost:3000 call localhost:8000
  3. mounts /uploads for serving uploaded images
  4. registers every router

Keeping route definitions out of here is the point: each router owns its own
prefix, so adding a resource means writing one file and adding one
`include_router` line.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import check_production_safety, settings
from app.database import Base, engine
from app.routers import auth, categories, delivery, orders, products, store, uploads, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once on startup, before the first request is served.

    `create_all` builds any table that does not exist yet. It does NOT alter
    existing tables -- once the schema starts changing in production you want
    Alembic migrations instead.
    """
    # Raises outside development if the JWT secret is still the placeholder.
    for warning in check_production_safety():
        print(f"\n  WARNING: {warning}\n")

    Base.metadata.create_all(bind=engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="eDawr API",
    description="Backend for the eDawr storefront, admin console and rider app.",
    version="1.0.0",
    lifespan=lifespan,
)

# The browser blocks cross-origin requests unless the server opts in. The
# frontend is served from :3000 and this API from :8000 -- different origins,
# so without this every fetch fails with a CORS error in the console.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded product images at /uploads/<filename>.
app.mount(
    "/uploads",
    StaticFiles(directory=settings.upload_dir, check_dir=False),
    name="uploads",
)


@app.get("/api/health", tags=["meta"])
def health():
    """Cheap liveness check -- handy for confirming the server is actually up."""
    return {"status": "ok"}


# Order of registration does not matter here because every router has a
# distinct prefix. It matters *within* a router (see delivery.py).
app.include_router(auth.router)
app.include_router(store.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(orders.router)
app.include_router(users.router)
app.include_router(delivery.router)
app.include_router(uploads.router)
