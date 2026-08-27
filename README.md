# eDawr storefront

The customer-facing shop: Next.js 16 (App Router, React 19, Tailwind v4).

**This package serves no API routes.** Every figure, product and order comes
from the Django backend in `backend/`. Point `NEXT_PUBLIC_API_URL` at it before
anything will load.

```bash
cp .env.example .env      # then check NEXT_PUBLIC_API_URL
npm install
npm run dev               # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server, Turbopack |
| `npm run build` | Production build — catches missing `'use client'` and unawaited `params` |
| `npm run lint` | ESLint, including `react-hooks/set-state-in-effect` |
| `npm test` | Vitest, pure logic only |

## Routes

| Path | What it is |
|---|---|
| `/` | Hero, aisle rail and merchandising rows derived from the live catalogue |
| `/products` | The full catalogue, filtered by aisle server-side |
| `/categories` | Every aisle the store actually stocks |
| `/category/[slug]` | One aisle. The slug is derived from the category name |
| `/product/[id]` | One product, from `/api/store/products/{id}` |
| `/search` | Results from `/api/store/products?q=`, plus the ⌘K overlay |
| `/cart` | The basket, priced by `/api/store/quote` |
| `/checkout` | Details, delivery speed, and `POST /api/store/orders` |
| `/orders` | Orders this browser remembers, with live status |
| `/order/[token]` | Live tracking, polled every 10s |
| `/account`, `/addresses` | Name, number and address book — **local to the browser** |
| `/offers` | Real delivery thresholds and genuinely discounted stock |

The staff console is a **separate application in its own repository**
(`edawr-admin`, checked out alongside this directory at `admin/`), on port 3001.
Nothing in this package is authenticated: every endpoint the storefront touches
is public, because a customer has no account.

> **This package is not under version control.** `frontend/` has no `.git`, and
> neither does the directory above it. There is nothing to revert an edit to and
> no history to read. The last committed state is archived at
> `F:\Projects\eDawr-history.bundle` — a one-time snapshot, not a backup that
> updates. Keep a copy elsewhere before a substantial change.

## The three rules this package is built around

**Money is never computed here.** The cart holds a display snapshot of prices;
every total comes from `/api/store/quote` and finally from the order the server
creates. `lib/format.ts` renders numbers and never does arithmetic on them. The
checkout request carries product ids and quantities only — no price, no fee, no
total. Adding up line totals in TypeScript would be a second pricing engine, and
it would disagree with the server the first time a fee changed.

**No customer accounts exist.** There is no customer auth in the API. `/account`
and `/addresses` are localStorage conveniences that prefill checkout, and order
history is the set of tracking tokens saved at checkout (`lib/recent-orders.ts`).
Possession of a token is the credential — the same trust model as a paper
receipt. Clearing site data is destructive.

**Never set state synchronously inside an effect.** `react-hooks/set-state-in-effect`
is an error here, and the fix is structural rather than a suppression: tag
fetched data with the query that produced it and *derive* the loading flag.
`useQuote`, `SearchOverlay` and `OrdersPage` are the worked examples.

## Framework notes

This is not the Next.js you may know — see `AGENTS.md`, and read
`node_modules/next/dist/docs/` before writing framework code.

- **Middleware is called Proxy.** `src/proxy.ts` carries the CSP with a
  per-request nonce. It derives `connect-src` and `img-src` from
  `NEXT_PUBLIC_API_URL`; get that wrong and the browser blocks the catalogue and
  every product image, and the store renders empty. First thing to check when
  nothing loads.
- `params` in a dynamic route is a **Promise** and must be awaited.
- `useSearchParams` needs a `<Suspense>` boundary or the build fails.
- Product images use plain `<img>`, not `next/image`: the host is only known at
  runtime, so `remotePatterns` cannot be configured at build time without baking
  it in. The rule is disabled per-file with that reasoning.
- Inter is loaded through `next/font`, which self-hosts it. A Google Fonts
  `<link>` would be blocked by the CSP.
