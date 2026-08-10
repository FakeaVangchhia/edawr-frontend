# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Overview

eDawr is a **quick-commerce** grocery platform for Aizawl, Mizoram: customers
order from a web storefront and a rider delivers on a 15-minute promise.

- `frontend/` — Next.js 16 (App Router, React 19, Tailwind v4). Storefront +
  admin console. **UI only — it serves no API routes.**
- `backend/` — Django 6 + DRF + SQLite. **This is the API.**
- `mobile/` — Expo / React Native (SDK 54), the rider app.

Supabase and the WhatsApp ordering module were removed. The backend was migrated
from FastAPI/SQLAlchemy/Pydantic to Django/DRF; no FastAPI code remains. Do not
reintroduce a client-side database, and do not reintroduce FastAPI.

**`backend/` is a separate git repository** with its own remote
(`edawr-backend`), ignored by the root repo. Commit backend changes from inside
`backend/`. Do not `git add backend` at the root — that records a gitlink which
clones as an empty directory.

## Commands

Backend (from `backend/`). **Dependencies are managed with uv, not pip** — there
is no `requirements.txt`. Never run `pip install`; use `uv add`, which updates
`pyproject.toml` and `uv.lock` together.
```bash
uv sync                                  # install from uv.lock
uv run manage.py migrate                 # create/update the schema
uv run manage.py seed                    # load sample data (deletes all rows)
uv run manage.py runserver 8000          # use 0.0.0.0:8000 for the phone
uv run manage.py makemigrations          # after editing api/models.py
uv run manage.py test                    # 160 tests, ~1s
uv run manage.py check --deploy          # before shipping
```

Frontend (from `frontend/`): `npm run dev` · `npm run build` · `npm run lint`
Mobile (from `mobile/`): `npm start` · `npx expo-doctor`

**There are no frontend or mobile tests.** Adding them is the largest open gap;
if you touch either package substantially, consider whether you can leave a test
behind.

## The rules that matter

### Money is Decimal, and it is never computed on the client
Every price, fee and total is `DecimalField` server-side and quantised
ROUND_HALF_UP in `api/pricing.py`. A float cannot represent 0.1, so a basket
totalled in floats drifts — that is a rounding error handed to a customer on a
bill.

The checkout request carries **product ids and quantities only**. It carries no
price, no fee and no total, and the server reads none from it. `/api/store/quote`
exists so the cart drawer shows the same arithmetic that will charge the
customer. Do not add up line totals in TypeScript — that is a second pricing
engine, and it will disagree with the server the first time a fee changes.

DRF is configured with `COERCE_DECIMAL_TO_STRING = False` so money arrives as a
JSON number, because the clients display it rather than recompute it.

### Order status is a state machine
Legal moves are declared in `Order.TRANSITIONS` and enforced by
`Order.advance_status()`, which also stamps the matching timestamp exactly once.
**Never assign `order.status` directly.** An illegal move raises `ValueError`,
which views turn into a 409 — a conflict with the order's state, not a bad
request.

```
Placed → Packing → Ready → Dispatched → Delivered
   └────────┴────────┴──────────────────→ Cancelled
                       Dispatched → Ready   (rider hands it back)
```

Cancelling goes through `checkout.cancel_order()`, never `advance_status` alone,
because it must also restore stock under a lock.

### Two product serializers, on purpose
`ProductSerializer` (admin) carries cost price, supplier and shelf location.
`StoreProductSerializer` (public) carries none of them and reduces `stock` to
`in_stock` + `low_stock`. They are separate classes so exposing margin data would
need a deliberate edit rather than a forgotten exclusion. Same reasoning splits
`OrderSerializer` from `OrderTrackingSerializer`.

### Checkout is one transaction, with rows locked in primary-key order
`api/checkout.py` locks product rows with `select_for_update()`, ordered by id so
two baskets containing the same products cannot deadlock. Stock check, item
insert and stock decrement all land together or not at all. The lock is a no-op
on SQLite — which is why `DATABASE_URL` must point at Postgres before real
traffic.

### Auth
- `api/authentication.py` answers *who is this?* and never rejects.
- `api/permissions.py` answers *may they?* and rejects.
- Admin and rider tokens share a secret and are told apart by a `typ` claim.
  Each authentication class returns `None` — never raises — for the other's
  token, because DRF stops at the first class that returns a user.
- **The rider comes from the token, never the body.** `accept`/`reject`/`status`
  take no rider id and each checks ownership.
- `is_active` is re-checked on every request, so deactivating a rider revokes
  access immediately rather than when their 12-hour token expires.
- A valid token of the wrong kind gets **403**, not 401. 401 means "I don't know
  who you are" and is what makes the web app clear its stored session; clearing
  it on 403 would sign an admin out of pages they merely lack rights for.

### Public endpoints are the security boundary
`api/urls.py` marks which routes are public. Checkout and tracking are
unauthenticated because a customer has no account, so each is throttled and
tracking is keyed on a 190-bit token rather than a sequential id.

## Frontend specifics

### This is not the Next.js you know
Next 16 has breaking changes (`frontend/AGENTS.md`). Consult
`frontend/node_modules/next/dist/docs/` before writing framework code. In
particular:
- **Middleware is called Proxy.** `src/proxy.ts` is the current convention, not
  dead code. It carries the CSP with a per-request nonce.
- `params` in a dynamic route is a **Promise** and must be awaited.
- Turbopack is the default for `dev` and `build`.

### The CSP names the API origin
`src/proxy.ts` derives `connect-src` and `img-src` from `NEXT_PUBLIC_API_URL`.
Get that wrong and the browser blocks the catalogue and every product image, and
the store renders empty. It is the first thing to check when nothing loads.

### Never set state synchronously inside an effect
`react-hooks/set-state-in-effect` is an error here, and the fix is structural
rather than a suppression: tag fetched data with the query that produced it and
**derive** the loading flag, and refresh by bumping a token from an event
handler. See `Storefront.tsx` and `ManagerDashboard.tsx`.

### The cart is an external store, not context
`src/lib/cart-store.ts` + `useSyncExternalStore`. No provider, no hydration
mismatch, and two browser tabs share one basket. The cart holds a **display**
snapshot of prices; the bill always comes from the server.

### Conventions
- Path alias `@/*` → `src/*`.
- Product images use plain `<img>`, not `next/image`: the host is only known at
  runtime, so `remotePatterns` cannot be configured at build time without baking
  it in. The lint rule is disabled per-file with that reasoning.
- **Do not run `git push`.** Stage and commit; leave pushing to the user.

## Backend conventions & gotchas

- Error responses are always `{"detail": "..."}` (`api/exceptions.py`). Raise
  `NotFound`/`ValidationError`, or return `Response({"detail": ...}, status=...)`.
  Never return a bare error dict.
- A bad request body is **400**, not 422.
- **DRF `CharField` rejects `""`.** Optional text fields use the shared
  `OPTIONAL_TEXT` kwargs.
- **`default=` is what makes PUT replace.** `required=False` alone leaves an
  omitted field unchanged.
- URLs carry **no trailing slash** and `APPEND_SLASH = False`, because a
  redirected POST loses its body.
- Nest-heavy queries need `.prefetch_related("items")` and
  `.select_related("delivery_boy")`, or listing 50 orders is 101 queries.
- `OrderItem.product` is `on_delete=PROTECT` on purpose; the delete view counts
  references first and returns a 409 telling the caller to deactivate instead.
- Uploads return a **relative** `/uploads/<name>` path; the frontend prefixes it
  via `assetUrl()`.
- Phone numbers are normalised to `+91XXXXXXXXXX` by `api/validators.py` on both
  storage and login. Two spellings of one number would otherwise be two accounts.
- `manage.py seed` deletes and reinserts **rows** only; it never touches the
  schema, but it does wipe hand-added admins.
- Migrations are source code — commit them, and write them to survive existing
  data. `0003_quick_commerce` is the worked example: it renames the old status
  vocabulary, backfills totals, dedupes category names before a unique
  constraint, and populates tracking tokens row by row before making the column
  unique (a single `AddField` with a callable default gives every row the *same*
  value).
- Tests swap in an MD5 password hasher (`settings.TESTING`). PBKDF2 must stay
  slow in production; it turned a 6-second suite into 53 seconds.
