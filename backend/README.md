# eDawr backend (FastAPI)

The API for the storefront, the admin console, and the rider app. Replaces the
deleted Next.js API routes and Supabase.

- **Interactive docs:** http://localhost:8000/docs once running. Every endpoint
  below is listed there and can be called from the browser.
- **Framework routing guide:** see [How routing works](#how-routing-works) — written
  against this codebase, mapping each concept back to the Next.js routes it replaced.

---

## Quick start

Dependencies are managed with [uv](https://docs.astral.sh/uv/). If you don't
have it: `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"` (Windows)
or `curl -LsSf https://astral.sh/uv/install.sh | sh` (macOS/Linux).

```bash
cd backend

uv sync                         # creates .venv and installs from uv.lock
cp .env.example .env            # defaults are fine for LOCAL dev only --
                                # JWT_SECRET must be replaced before deploying

uv run seed.py                  # creates edawr.db + sample data
uv run uvicorn app.main:app --reload --port 8000
```

No virtualenv activation — `uv run` executes inside the project environment.
See [docs/uv.md](docs/uv.md) for the full command reference and why this
replaced pip.

Then point the frontend at it — in `frontend/.env`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

and run `npm run dev` in `frontend/`. That single variable is the only wiring;
every fetch in the app goes through `apiUrl()`/`authFetch()` in
`frontend/src/lib/api.ts`.

**Seeded admin login:** `admin@edawr.local` / `admin1234`

`--reload` restarts the server whenever you save a file. Leave it on while
learning; drop it in production.

**Testing with the mobile app on a real phone:** bind to all interfaces so the
phone can reach your machine over the LAN —

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The Expo app auto-detects your LAN IP and targets port 8000 (`mobile/src/config.ts`).
CORS does not apply to React Native, so no extra origin config is needed.

---

## Project layout

```
backend/
├── app/
│   ├── main.py          app instance, CORS, static files, router registration
│   ├── config.py        settings from environment / .env
│   ├── database.py      engine, session factory, get_db dependency
│   ├── models.py        SQLAlchemy tables
│   ├── schemas.py       Pydantic request/response shapes
│   ├── security.py      password hashing, JWT, require_admin dependency
│   └── routers/         one file per resource
│       ├── auth.py          /api/auth/*
│       ├── store.py         /api/store/*        (public)
│       ├── products.py      /api/products/*     (admin)
│       ├── categories.py    /api/categories/*   (admin)
│       ├── orders.py        /api/orders/*       (mixed)
│       ├── users.py         /api/users/*        (admin)
│       ├── delivery.py      /api/delivery/*     (public)
│       └── uploads.py       /api/uploads/*      (admin)
├── docs/uv.md           dependency management guide
├── seed.py              sample data
├── pyproject.toml       project metadata + direct dependencies
├── uv.lock              exact resolved versions (committed, never hand-edited)
└── .python-version      Python version for this project (3.14)
```

The split mirrors what the Next.js folder tree was doing, one layer up: a folder
per resource became a *file* per resource.

---

## Endpoints

Auth column: **admin** = requires `Authorization: Bearer <token>`;
**public** = no auth.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/api/health` | public | liveness check |
| POST | `/api/auth/login` | public | `{email, password}` → `{access_token, username}` |
| GET | `/api/auth/me` | admin | validate a stored token, get a fresh one |
| GET | `/api/store/products` | public | storefront catalog (active products only) |
| GET | `/api/products` | admin | all products |
| POST | `/api/products` | admin | create product |
| PUT | `/api/products/{id}` | admin | replace product |
| DELETE | `/api/products/{id}` | admin | delete product |
| POST | `/api/uploads/products/image` | admin | multipart upload → `{image_url}` |
| GET | `/api/categories` | admin | list categories |
| POST | `/api/categories` | admin | create category |
| PUT | `/api/categories/{id}` | admin | update category |
| DELETE | `/api/categories/{id}` | admin | delete category |
| GET | `/api/orders` | admin | orders newest-first, items nested |
| POST | `/api/orders/{id}/assign` | admin | manager assigns a rider |
| GET | `/api/users` | admin | staff + riders |
| POST | `/api/users` | admin | create staff member |
| GET | `/api/delivery/riders` | public | rider profiles for mobile login |
| GET | `/api/delivery/{id}/dashboard` | public | incoming / active / recent buckets |
| PATCH | `/api/orders/{id}/status` | public | rider updates status |
| POST | `/api/orders/{id}/accept` | public | rider claims an order |
| POST | `/api/orders/{id}/reject` | public | rider declines an offer |

The five **public** rider endpoints are public because the Expo app has no
login. That is a known gap carried over from the old backend, not an oversight —
see [Known gaps](#known-gaps).

---

## How routing works

Everything below is in this repo, so you can open the file and see it running.

### 1. The core shift: decorators instead of filenames

In Next.js the **file path was the URL**, and the **exported function name was
the method**:

```
src/app/api/products/[id]/route.ts
   export async function PUT(...)     ->  PUT /api/products/:id
   export async function DELETE(...)  ->  DELETE /api/products/:id
```

In FastAPI the path and method are arguments to a **decorator**, and the file
location is irrelevant:

```python
@router.put("/{product_id}")
def update_product(product_id: int): ...
```

Consequences worth internalising:

- Files no longer constrain URLs. You can put every route in one file. Splitting
  by resource is a convention *you* choose, not something the framework imposes.
- Renaming a folder cannot silently break a URL.
- Two routes for the same path with different methods sit next to each other as
  ordinary functions rather than as two exports.

### 2. `APIRouter` — grouping routes

A router is a collection of routes that gets mounted onto the app. From
`app/routers/products.py`:

```python
router = APIRouter(
    prefix="/api/products",          # prepended to every path in this router
    tags=["products"],               # groups them in /docs
    dependencies=[Depends(require_admin)],   # runs before EVERY route here
)
```

Then in `app/main.py`:

```python
app.include_router(products.router)
```

`prefix` means you write the shared part once. `@router.get("")` is
`GET /api/products`; `@router.get("/{product_id}")` is
`GET /api/products/{product_id}`.

### 3. Path operations

The decorator names the HTTP method:

```python
@router.get("")                     # GET    /api/products
@router.post("")                    # POST   /api/products
@router.put("/{product_id}")        # PUT    /api/products/42
@router.patch("/{order_id}/status") # PATCH  /api/orders/42/status
@router.delete("/{product_id}")     # DELETE /api/products/42
```

`@router.post("")` and `@router.get("")` can coexist on the same path — same URL,
different method, different function.

### 4. Where each parameter comes from

This is the part that feels like magic until you know the rule. FastAPI inspects
your function signature and decides each parameter's source:

| Your parameter | Source | Rule |
| -------------- | ------ | ---- |
| `product_id: int` | **path** | name appears in `{braces}` in the decorator |
| `q: str = None` | **query** | scalar type, name *not* in the path |
| `payload: ProductCreate` | **body** | type is a Pydantic model |
| `db: Session = Depends(get_db)` | **dependency** | default is `Depends(...)` |
| `file: UploadFile = File(...)` | **form** | default is `File(...)`/`Form(...)` |

From `products.py`:

```python
@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,                       # path  -- {product_id} is in the URL
    payload: ProductUpdate,                # body  -- Pydantic model
    db: Session = Depends(get_db),         # dependency
):
```

There is no `await request.json()` and no `parseInt(id, 10)`. The `: int`
annotation *is* the validation: `PUT /api/products/abc` returns 422 and your
function never runs. Compare the old route, which needed:

```ts
const orderId = parseInt(id, 10);
if (isNaN(orderId)) return NextResponse.json({ detail: "Invalid order ID." }, { status: 400 });
```

### 5. `response_model` — what goes out

```python
@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.id)).all()
```

You return SQLAlchemy objects; FastAPI converts them. `response_model` also
**filters** — any attribute not declared on `ProductOut` is dropped. That is a
safety property, not just documentation: returning an `AdminUser` from a route
whose `response_model` lacks `password_hash` cannot leak the hash.

### 6. Dependencies — `Depends`

A dependency is a function FastAPI runs before your handler, passing you the
result. The two here are `get_db` (a session, closed automatically afterwards)
and `require_admin` (rejects the request unless a valid token is present).

Dependencies **compose** — `require_admin` itself depends on `get_db`:

```python
def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
```

FastAPI resolves the whole tree before your route runs, and caches `get_db`
within a single request so both callers share one session.

**Two ways to attach a guard, and the difference matters:**

```python
# (a) router-level -- every route in the router, including ones added later
router = APIRouter(prefix="/api/products", dependencies=[Depends(require_admin)])

# (b) per-route -- only this route
def list_orders(admin: AdminUser = Depends(require_admin)): ...
```

Use (a) when the whole resource is admin-only (`products.py`, `categories.py`,
`users.py`, `uploads.py`). Use (b) when access is mixed — `orders.py` has manager
routes *and* public rider routes in one file, so the guard goes per-route.

This is a real improvement over the old design. Previously every route had to
remember to call `requireAdmin(request)` in its body, and forgetting was
invisible. Now the guard is in the signature or the router constructor, and a new
route added to a guarded router is protected by default.

### 7. Errors

Raise `HTTPException`; do not return an error object:

```python
raise HTTPException(status_code=404, detail="Product not found.")
```

Which serialises to `{"detail": "Product not found."}` — the exact shape the
frontend already reads (`data.detail || 'Failed to save'`), so no client changes
were needed.

Validation errors (422) are produced for you and also use `detail`.

### 8. Route ordering

FastAPI matches **top to bottom, first match wins**. Literal paths must be
registered before parameterised ones that could swallow them.

In `delivery.py` the two paths have different shapes (`/riders` is one segment,
`/{delivery_id}/dashboard` is two), so they cannot actually collide. But if you
add a plain `GET /api/delivery/{delivery_id}`, it *would* match the literal
string `"riders"` and try to parse it as an int:

```python
@router.get("/riders")             # must come first
@router.get("/{delivery_id}")      # would otherwise swallow /riders
```

Next.js resolved this for you by preferring static segments over dynamic ones.
FastAPI does not. Habit to keep: **literal paths above `{param}` paths.**

### 9. Async or not?

Both work. Use `def` for normal database code — FastAPI runs it in a threadpool
so it will not block the event loop. Use `async def` only when you `await`
something, like `uploads.py` does for `await file.read()`.

Writing `async def` around blocking database calls is the classic FastAPI
performance mistake: it blocks the whole event loop. When in doubt here, use
plain `def`.

### 10. CORS

The browser blocks cross-origin requests unless the server opts in. The frontend
is `:3000` and this API is `:8000` — different origins, so without the middleware
in `main.py` every fetch fails:

```python
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, ...)
```

This never came up before because the API routes lived inside the Next.js app at
the same origin. Add your deployed frontend domain to `CORS_ORIGINS` when you
ship.

---

## Auth flow

1. `AdminLogin.tsx` POSTs `{email, password}` to `/api/auth/login`.
2. The route checks bcrypt hash, signs a JWT with `sub = email`, returns
   `{access_token, username}`.
3. The frontend stores it in `sessionStorage` under `edawr-admin-session`.
4. `authFetch` attaches `Authorization: Bearer <token>` to every admin request.
5. `require_admin` decodes it, loads the `AdminUser`, and rejects if invalid,
   expired, or inactive.

Login failures return the same 401 whether the email is unknown or the password
is wrong, so the endpoint cannot be used to enumerate admin accounts.

**Add another admin:**

```bash
uv run python -c "from app.database import SessionLocal; from app.models import AdminUser; from app.security import hash_password; db=SessionLocal(); db.add(AdminUser(email='you@example.com'.lower(), password_hash=hash_password('your-password'))); db.commit()"
```

The email **must be stored lowercase** — login normalises the submitted address
before looking it up, so a row stored as `You@Example.com` can never be matched.

## Deploying

Set `ENVIRONMENT` to anything other than `development` and the app refuses to
start while `JWT_SECRET` is still the placeholder from `.env.example`. That
placeholder is committed to this repository, so a deployment using it would let
anyone who knows an admin email forge a valid admin token.

```bash
ENVIRONMENT=production
JWT_SECRET=$(uv run python -c "import secrets; print(secrets.token_urlsafe(48))")
CORS_ORIGINS=https://your-frontend-domain
```

Install with `uv sync --frozen --no-dev` in production — `--frozen` fails the
deploy if `uv.lock` is stale rather than silently resolving something else.

---

## Database

SQLite by default (`backend/edawr.db`), zero setup. Tables mirror the old
Supabase schema minus the WhatsApp `messages` table and the unused `todos`
table, plus a new `admin_users` table for logins.

**Moving to Postgres** is one line in `.env`:

```
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/edawr
```

plus `uv add "psycopg[binary]"`. Two things to change in code when you do:

- `models.py`: money columns are `Float` because SQLite has no decimal type.
  Switch to `Numeric(10, 2)` for exact currency maths.
- `database.py`: drop the `check_same_thread` connect arg (SQLite-only).

Schema changes are currently applied by `Base.metadata.create_all()` at startup,
which **only creates missing tables — it never alters existing ones**. The moment
you change a column, add Alembic (`uv add alembic`) and use migrations.

---

## Known gaps

- **Nothing creates orders.** Order creation lived inside the deleted WhatsApp
  webhook, so no endpoint replaces it. `seed.py` inserts three sample orders so
  the dashboards have data. The natural next step is `POST /api/orders` plus a
  checkout button on the storefront, which currently has a cart with nowhere to
  send it. **This is the main decision waiting for you.**
- **The rider "Reject" button does nothing.** `POST /api/orders/{id}/reject`
  clears `offered_to_delivery_boy_id`, but nothing in the system ever *sets*
  that column — there is no offer/dispatch step, so orders go straight into
  every nearby rider's `incoming` feed. The endpoint returns
  `{"success": true}` and the order reappears on the next refresh. This is a
  faithful port of the old Supabase route, which had the same dead logic.
  Making it work needs a decision: either a dispatch step that offers an order
  to one rider at a time, or an `order_rejections` table so a decline is
  remembered per rider. **Not implemented — it needs your call on which.**
- **Rider endpoints are unauthenticated.** Carried over from the old backend —
  the mobile app has no login, so riders are identified only by the `id` they
  pick. Anyone who can reach the API can move any order. Fix by giving riders
  logins and swapping the public routes in `orders.py`/`delivery.py` to use a
  `require_rider` dependency.
- **Order creation is not transactional** in any future implementation unless you
  make it so — the old webhook inserted items and decremented stock in a loop.
  Wrap it in a single transaction when you build it.
- **No tests.** The endpoints were verified manually. `pytest` + `httpx` with
  FastAPI's `TestClient` is the standard setup when you want them.
- **No rate limiting** on `/api/auth/login`.
