"""Product image upload.

Replaces src/app/api/uploads/products/image/route.ts, which pushed to a
Supabase Storage bucket. Files now land on local disk under `backend/uploads/`
and are served back by the StaticFiles mount in main.py.

The response is `{"image_url": "/uploads/<name>"}` -- a *relative* path on
purpose. The frontend runs it through `assetUrl()`, which prefixes
NEXT_PUBLIC_API_URL, so the same stored value works whether the API is on
localhost:8000 or a deployed host. Storing an absolute URL would bake the
hostname into the database.
"""

import re
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.schemas import UploadResponse
from app.security import require_admin

router = APIRouter(
    prefix="/api/uploads",
    tags=["uploads"],
    dependencies=[Depends(require_admin)],
)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
CHUNK_SIZE = 64 * 1024

UPLOAD_DIR = Path(settings.upload_dir)


def _safe_stem(filename: str) -> str:
    """Reduce a user-supplied filename to something harmless.

    Strips directory components and anything that is not alphanumeric, dash or
    underscore, so a name like `../../etc/passwd` cannot escape the upload dir.
    """
    stem = Path(filename or "image").stem
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_")
    return (cleaned or "image")[:40]


@router.post("/products/image", response_model=UploadResponse)
async def upload_product_image(file: UploadFile = File(...)):
    """POST /api/uploads/products/image

    `file: UploadFile = File(...)` tells FastAPI this is multipart/form-data,
    not JSON -- the parameter name `file` must match the FormData key the
    frontend appends. This is the one case where the body is not a Pydantic
    model. (It needs the `python-multipart` package installed.)

    Declared `async` because UploadFile's read is awaitable.
    """
    extension = ALLOWED_CONTENT_TYPES.get((file.content_type or "").lower())
    if extension is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Use JPEG, PNG, WebP or GIF.",
        )

    # Read in chunks and bail as soon as the limit is passed, rather than
    # buffering the whole body first. A single multi-GB request would otherwise
    # be spooled to disk in full before we returned the 400.
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(CHUNK_SIZE):
        total += len(chunk)
        if total > MAX_BYTES:
            raise HTTPException(status_code=400, detail="Image is larger than 5 MB.")
        chunks.append(chunk)

    contents = b"".join(chunks)
    if not contents:
        raise HTTPException(status_code=400, detail="No file was uploaded.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Random suffix so two uploads of "photo.jpg" cannot overwrite each other.
    filename = f"{_safe_stem(file.filename)}-{secrets.token_hex(8)}{extension}"
    (UPLOAD_DIR / filename).write_bytes(contents)

    return UploadResponse(image_url=f"/uploads/{filename}")
