# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

eDawr is a grocery ordering and delivery platform for Aizawl (Mizoram, India). It is a monorepo with three parts:

- `frontend/` — Next.js 16 (App Router, React 19, Tailwind v4). Customer storefront + admin console. **UI only — it serves no API routes.**
- `backend/` — Django 6 + Django REST Framework + SQLite. **This is the API.** Everything the frontend and mobile app read or write goes through it.
- `mobile/` — Expo / React Native (SDK 54) app used by delivery riders.

Supabase and the WhatsApp ordering module were removed and replaced by this backend. The backend was migrated from FastAPI/SQLAlchemy/Pydantic to Django/DRF; no FastAPI code remains. Do not reintroduce a client-side database, and do not reintroduce FastAPI.

## Commands

Backend (run from `backend/`). **Dependencies are managed with uv, not pip** — there is no `requirements.txt`. Never run `pip install` here; use `uv add`, which updates `pyproject.toml` and `uv.lock` together. See `backend/docs/uv.md`.
```bash
uv sync                                  # install from uv.lock
uv run manage.py migrate                 # create/update the schema
uv run manage.py seed                    # load sample data (deletes all rows)
uv run manage.py runserver 8000          # use 0.0.0.0:8000 for the phone
uv run manage.py makemigrations          # after editing api/models.py
uv run manage.py shell                   # REPL with Django configured
```
`uv run <cmd>` executes inside the project venv — no activation step. `uv.lock` is committed and must never be hand-edited.
Interactive docs at http://localhost:8000/docs. Seeded admin: `admin@edawr.local` / `admin1234`.

Frontend (run from `frontend/`):
```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint (flat config in eslint.config.mjs)
```

Mobile (run from `mobile/`):
```bash
npm start        # expo start (dev server / QR code)
npm run android  # expo start --android
npm run ios      # expo start --ios
```

There is no automated test suite in any package.

## Architecture

### The API base URL indirection — the seam between UI and backend
`frontend/src/lib/api.ts` builds request URLs from `NEXT_PUBLIC_API_URL` (set to `http://localhost:8000`). All data access goes through `apiUrl()` (public) or `authFetch()` (attaches the admin bearer token). **This is the only place the backend URL appears** — repointing the app is a one-variable change, so never hardcode a host in a component.

### Backend layout
Two packages. `backend/config/` is the Django *project*: `settings.py` (all configuration — env loading, database, CORS, DRF, media), `urls.py` (root URL table; mounts the api app, `/docs`, `/uploads`), `wsgi.py`, `asgi.py`. `backend/api/` is the single Django *app*: `models.py`, `serializers.py`, `authentication.py`, `permissions.py`, `security.py`, `exceptions.py`, `apps.py`, `urls.py`, `migrations/`, `management/commands/seed.py`, and `views/` with one module per resource.

Adding a resource means one view module, one `path()` line in `api/urls.py`, and usually a serializer.

**`backend/docs/drf.md` is the learning guide** — a concept-by-concept FastAPI→DRF translation written against this codebase, with a "adding an endpoint" checklist. Read it before writing backend code. `backend/README.md` has the endpoint table and deployment notes.

### URLs are separate from views, and carry no trailing slash
`api/urls.py` is the complete routing table. Every path is written **without** a trailing slash (`/api/products`, not `/api/products/`) because that is what the frontend and Expo app call, and `APPEND_SLASH = False` in settings so a mismatch 404s honestly instead of redirecting (a redirected POST loses its body).

Path converters replace FastAPI's type-annotated path params: `<int:product_id>` matches digits only and passes an `int` to the view. A non-numeric segment never matches, so `GET /api/products/abc` 404s before any view runs.

### Auth
`AdminLogin.tsx` POSTs `{email, password}` to `/api/auth/login` and gets `{access_token, token_type, username}`. The session is cached in `sessionStorage` under `edawr-admin-session` (`src/lib/auth.ts`) and sent as a Bearer token by `authFetch`.

Server-side the old `require_admin` dependency is split in two, which is the DRF model:
- `api/authentication.py` — `AdminJWTAuthentication` answers *who is this?*. Runs on every request via `DEFAULT_AUTHENTICATION_CLASSES`, sets `request.user` to an `AdminUser` or `None`. Never rejects an anonymous request.
- `api/permissions.py` — `IsAdmin` answers *may they?* and rejects.

Attach guards **declaratively**, not with manual checks:
- Whole-resource admin views subclass `AdminAPIView` (= `APIView` + `permission_classes = [IsAdmin]`) — see `views/products.py`.
- Mixed-access modules set `permission_classes` per view class — see `views/orders.py`, which has `[IsAdmin]` manager views and `[IsRider]` rider views side by side.

**Riders authenticate too.** The mobile app signs in at `POST /api/auth/rider/login` with `{phone, pin}` and gets `{access_token, rider}`. Rider PINs are PBKDF2-hashed in `User.pin_hash` (NULL = cannot sign in); managers set one via the write-only `pin` field on `POST /api/users`.

Both token kinds are signed with the same `JWT_SECRET` and told apart by a **`typ` claim** (`"admin"` / `"rider"`, absent = admin, for FastAPI-era tokens). `AdminJWTAuthentication` and `RiderJWTAuthentication` both run on every request and both return `None` — never raise — for a token carrying the other's `typ`, because DRF stops at the first class that returns a user and a raise would end the chain early. That is why `decode_token()` takes an `expected_type`.

**The rider is taken from the token, never the body.** `accept`/`reject`/`status` used to read `delivery_boy_id` out of the JSON payload while requiring no credentials, so any caller could move any order. They now take no rider id at all, and each checks ownership (`order.delivery_boy_id != request.user.id` → 403). `/api/delivery/{id}/dashboard` verifies the path id is the caller. `AssignSerializer` still carries a `delivery_boy_id` because a *manager* legitimately assigns work to someone else.

JWTs are unchanged from the FastAPI backend (PyJWT, HS256, `sub` = email, same `JWT_SECRET`). Password hashing is **not**: `django.contrib.auth.hashers` (PBKDF2) replaced bcrypt, so old hashes no longer verify — re-seed.

### Database
SQLite at `backend/edawr.db` by default; switch to Postgres by changing `DATABASE_URL` only (parsed by `dj-database-url`, so use the `postgres://` form). Tables mirror the old Supabase schema minus `messages` (WhatsApp) and `todos` (unused), plus an `admin_users` table. Every model sets `Meta.db_table` to pin the original table names.

**Schema changes go through migrations**, not a destructive re-seed: `makemigrations` then `migrate`. Files in `api/migrations/` are source code — commit them. `manage.py seed` now only deletes and reinserts **rows**; it never touches the schema, but it does wipe hand-added admins.

Django issues `PRAGMA foreign_keys=ON` on every SQLite connection itself — no hand-rolled connect listener needed.

`OrderItem.product` is `on_delete=models.PROTECT` on purpose — deleting a product must never erase line items from past orders. `ProductDetailView.delete` counts references first and returns a 409 telling the caller to set `status` to `inactive` instead (PROTECT alone would surface as a 500).

Money columns are `FloatField` because SQLite has no decimal type; switch to `DecimalField(max_digits=10, decimal_places=2)` when moving to Postgres.

### Real-time (socket.io) — optional, off by default
`frontend/src/hooks/useSocket.ts` only connects when `NEXT_PUBLIC_SOCKET_URL` is set; otherwise it is a no-op (there is no socket.io server in this repo). `ManagerDashboard.tsx` listens for `order:created`, `order:updated`, `inventory:updated`, `product:updated` but null-guards the socket. Data is fetched via REST; don't assume events fire.

### Frontend component map
- `src/app/page.tsx` — storefront (`Storefront`).
- `src/app/admin/page.tsx` — admin console; renders `AdminLogin` or `AdminShell` based on session.
- `AdminShell` → `ManagerDashboard`, `ProductsDashboard`/`ProductsList`/`ProductEditor`, `CategoriesList`.
- Path alias `@/*` → `src/*` (tsconfig).

### Mobile app
Two screens: `LoginScreen` (phone + PIN) → `DeliveryScreen` (see `mobile/App.tsx`). All requests go through `mobile/src/api.ts`, which attaches the bearer token and raises `UnauthorizedError` on 401/403 so the app can sign the rider out instead of alerting. The token lives in `expo-secure-store` (`src/session.ts`) and is revalidated against `/api/auth/rider/me` on launch.

**`mobile/src/config.ts` resolves the API URL in four steps**, and the order is the point: `EXPO_PUBLIC_API_URL` (ignored if it names localhost, which a phone can never reach) → the Expo dev server's LAN IP, *dev only* → `expo.extra.apiUrl` in `app.json` → localhost in dev, or a **thrown error** in a release build. That last branch is deliberate: `debuggerHost` does not exist outside Expo Go, so the old code silently fell back to `localhost:8000` in a production APK and every request failed against an address that cannot exist on the device. A release build with no backend configured now fails loudly at startup instead.

`ALLOWED_HOSTS` defaults to `*` in development so the LAN-IP request is accepted.

## Conventions & gotchas

- **Next.js is a newer major with breaking changes** (`frontend/AGENTS.md`, referenced by `frontend/CLAUDE.md`). Consult `frontend/node_modules/next/dist/docs/` before writing framework code rather than relying on older Next.js knowledge.
- **Do not run `git push`.** Stage and commit if asked, but leave pushing to the user (per `frontend/AGENTS.md`).
- Env files are gitignored in both `frontend/` and `backend/`; each has a `.env.example`. The backend runs with no `.env` at all — every setting has a working default.
- Error responses are always `{"detail": "..."}`. `api/exceptions.py` is a custom `EXCEPTION_HANDLER` that flattens DRF's field-keyed validation errors into that shape (keeping the original under `errors`). Raise `NotFound`/`ValidationError`, or return `Response({"detail": ...}, status=...)`; never return a bare error dict without `detail`.
- **A bad request body is 400, not 422** (FastAPI returned 422). Clients only read `detail`, so nothing broke.
- **DRF `CharField` rejects `""` by default.** The product editor submits empty strings for untouched optional fields, so optional text fields use the shared `OPTIONAL_TEXT` kwargs in `serializers.py` (`allow_blank=True, allow_null=True, default=None`).
- **`default=` is what makes PUT replace.** `required=False` alone leaves an omitted field unchanged; an explicit `default=` is applied on a non-partial update. Optional serializer fields declare defaults for that reason.
- Order status values are capitalized (`"Pending"`, `"Assigned"`, `"Delivered"`) and compared literally in the UI; they are `Order.STATUS_CHOICES` constants. Product `status` is matched case-insensitively in `views/store.py` (`status__iexact`).
- Uploads return a **relative** `/uploads/<name>` path so the hostname isn't baked into the database; the frontend prefixes it via `assetUrl()`. Django parses multipart natively — the file is `request.FILES["file"]`, no extra package.
- Timestamps are handled by `USE_TZ = True`; DRF emits `...Z`. No custom serializer hook is needed (the FastAPI version needed one to avoid a 5h30m IST offset bug).
- Nest-heavy queries need `.prefetch_related("items")` — `OrderSerializer` nests order items, so omitting it silently produces an N+1.
- **Nothing creates orders** — that lived in the removed WhatsApp webhook. `manage.py seed` provides sample orders. `POST /api/orders` + storefront checkout is the main open task; wrap it in `@transaction.atomic`.
- **`POST /api/orders/{id}/reject` is a no-op** — nothing ever sets `offered_to_delivery_boy_id`, so there is no offer to clear. Needs a dispatch step or an `order_rejections` table; don't paper over it.
- `ManagerDashboard.tsx` fetches `/api/products` into a `products` state that nothing reads (pre-existing dead code).
- `backend/edawr-sqlalchemy-backup.db` is the pre-migration SQLite file, kept for data recovery. It is not used by anything.
