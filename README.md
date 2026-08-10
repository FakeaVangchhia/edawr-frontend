# eDawr

Quick-commerce grocery delivery for Aizawl, Mizoram. Customers order from a web
storefront, a store manager fulfils from an admin console, and riders deliver
through a mobile app — on a **15-minute promise**.

## Monorepo layout

| Path        | Stack                                   | Purpose                              |
| ----------- | --------------------------------------- | ------------------------------------ |
| `frontend/` | Next.js 16 (App Router, React 19, TW4)  | Storefront + admin console (UI only) |
| `backend/`  | Django 6 + DRF + SQLite                 | **The API** — all data access        |
| `mobile/`   | Expo / React Native (SDK 54)            | Delivery rider app                   |

> `backend/` is its own git repository (`edawr-backend`) with its own remote, so
> the root repo ignores it. Commit backend changes from inside `backend/`.

The frontend serves no API routes; every request goes to Django on port 8000.
See `backend/README.md` for the endpoint table.

## How an order actually flows

```
customer                store manager            rider
────────                ─────────────            ─────
browse ─┐
add to cart
        │  POST /api/store/quote      (server prices the basket)
checkout┴► POST /api/store/orders  ──► Placed
                                        │ "Start packing"
                                        ▼
                                      Packing
                                        │ "Mark ready"
                                        ▼
                                      Ready ────────► appears in every nearby
                                        │              available rider's feed
                                        │              (minus ones they declined)
                                        │                    │ Accept
                                        ▼                    ▼
                                    Dispatched ◄─────── rider has it
                                        │                    │ Mark delivered
                                        ▼                    ▼
                                    Delivered
```

Cancelling is legal from `Placed`, `Packing` or `Ready` — while the goods are
still in the store — and puts the stock back. Once a rider has the order it is
too late, and the tracking page says so.

The legal transitions live in `Order.TRANSITIONS` and are enforced by
`Order.advance_status()`. Nothing anywhere assigns `order.status` directly.

## Local development

Three terminals.

### 1. Backend (the API)

Dependencies are managed with [uv](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync                       # creates .venv from uv.lock
uv run manage.py migrate      # creates edawr.db
uv run manage.py seed         # 8 categories, 33 products, 5 sample orders
uv run manage.py runserver 8000
```

Interactive API docs: http://localhost:8000/docs
Seeded admin login: `admin@edawr.local` / `admin1234`

### 2. Frontend (storefront + admin)

```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                   # http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

### 3. Mobile (rider app)

```bash
cd mobile
npm install
npm start                     # Expo dev server / QR code
```

On a physical phone the app auto-detects your computer's LAN IP on port 8000.
Start the backend with `uv run manage.py runserver 0.0.0.0:8000` so the phone
can reach it. Seeded rider: `+919000000002` / PIN `4813`.

## Tests

```bash
cd backend && uv run manage.py test        # 160 tests, ~1s
```

There is no test suite for the frontend or the mobile app yet — that is the
largest remaining gap. See "Known gaps" below.

## Architecture

```
  Next.js :3000            Django/DRF :8000         SQLite / Postgres
  ─────────────            ────────────────         ─────────────────
  Storefront    ──┐
  Admin console ──┼──► apiUrl()/authFetch() ──► /api/* routes ──► edawr.db
  Rider app     ──┘         (Bearer JWT)         + /uploads/*
```

### The rules that hold this together

**Money is never computed on the client.** The storefront sends product ids and
quantities; the server prices the basket in `Decimal` and stores the result.
`/api/store/quote` exists so the cart drawer shows the same arithmetic that will
charge the customer, rather than a parallel implementation in TypeScript that
drifts the first time a fee changes.

**The public API returns a narrower shape.** `StoreProductSerializer` omits cost
price, supplier, shelf location and exact stock. It is a separate class from the
admin `ProductSerializer` so exposing margin data would take a deliberate edit,
not a forgotten exclusion.

**Order tracking is authorised by possession of a token.** A customer has no
account, so `/api/store/orders/{token}` is keyed on a 190-bit random string
rather than the order id. There is no sequence to walk.

**The rider comes from the token, never the request body.** `accept`, `reject`
and `status` take no rider id, and each checks ownership.

**One API base URL.** `frontend/src/lib/api.ts` is the only place the backend
host appears — and `frontend/src/proxy.ts` reads the same variable to name the
API origin in the Content Security Policy.

## Deploying

Read `backend/README.md` first — the startup check refuses to boot with insecure
configuration, and each item it rejects is exploitable rather than untidy.

The short version:

```bash
ENVIRONMENT=production
JWT_SECRET=$(uv run python -c "import secrets; print(secrets.token_urlsafe(48))")
DJANGO_SECRET_KEY=$(uv run python -c "import secrets; print(secrets.token_urlsafe(48))")
ALLOWED_HOSTS=api.your-domain
CORS_ORIGINS=https://your-frontend-domain
CACHE_URL=redis://your-redis:6379/0
DATABASE_URL=postgres://user:password@host:5432/edawr
```

**Move to Postgres before taking real orders.** SQLite serialises every write
against the whole database and has no row locks, so the `select_for_update()`
that stops the last unit of stock being sold twice is a no-op there.

## Known gaps

- **No frontend or mobile tests.** The backend has 160; the other two packages
  have none. This is the biggest remaining hole.
- **Cash on delivery only.** No payment gateway is integrated. `payment_method`
  exists on the order and `PAYMENT_CHOICES` has one entry.
- **No over-the-air updates or crash reporting in the mobile app.** Every fix
  ships through a store review, and errors are shown to the rider and nowhere
  else.
- **No push notifications.** The rider feed and the customer's tracking page
  both poll.
- **No socket.io server**, so "real-time" is polling everywhere. The listeners
  are null-guarded and off unless `NEXT_PUBLIC_SOCKET_URL` is set.
- **Rider dispatch is pull, not push.** Every available rider in range sees
  every packed order except ones they declined; first to accept wins. An order
  declined by everyone stops appearing anywhere, which is why
  `GET /api/orders?stalled=true` exists for the manager. A push design with
  timed offers would need a scheduler and a background worker.
- **Straight-line distance.** Rider service radius uses haversine, and Aizawl is
  built on ridges — road distance can be several times it. It decides whether an
  order is plausibly in a rider's area, and is not shown to anyone as an ETA.
- **`backend/edawr-sqlalchemy-backup.db`** is the pre-migration SQLite file,
  kept for data recovery. Nothing uses it; delete it when you are satisfied.

## Regenerating the app icons

`mobile/assets/*.png` are generated rather than drawn, so the brand colour is
defined once:

```bash
python mobile/scripts/make-icons.py
```

No imaging library required — it writes the PNGs directly. Edit `BRAND_TOP`,
`BRAND_BOTTOM` or the `BOLT` polygon at the top of that file and re-run. Replace
it wholesale the moment you have a real logo; this exists so the app is
submittable rather than because a lightning bolt is the final answer.
