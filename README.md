# eDawr storefront

The customer-facing shop: Next.js 16 (App Router, React 19, Tailwind v4).

**This package serves no API routes.** Every figure, product and order comes
from the Django API in `edawr-backend/`. Point `NEXT_PUBLIC_API_URL` at it before
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
| `npm run brand-assets` | Regenerate every icon and wordmark from the masters in `scripts/brand/` |

## Routes

| Path | What it is |
|---|---|
| `/` | Hero, category rail and merchandising rows derived from the live catalogue |
| `/products` | The full catalogue, filtered by category server-side |
| `/categories` | Every category the store actually stocks |
| `/category/[slug]` | One category. The slug is derived from the category name |
| `/product/[id]` | One product, from `/api/store/products/{id}` |
| `/search` | Results from `/api/store/products?q=`, plus the ⌘K overlay |
| `/cart` | The basket, priced by `/api/store/quote` |
| `/checkout` | Details, delivery speed, and `POST /api/store/orders` |
| `/orders` | The account's orders, plus any this browser remembers, with live status |
| `/order/[token]` | Live tracking, polled every 10s |
| `/signin`, `/signup` | Optional customer accounts: phone and password |
| `/account` | The account (name, password, sign out) and the device's remembered details |
| `/addresses` | The address book — **local to the browser** |
| `/offers` | Real delivery thresholds and genuinely discounted stock |

The staff console is a **separate application in its own repository**
(`edawr-admin`, checked out alongside this directory at `admin/`), on port 3001.
Everything a guest touches is public; the `/api/customer/*` and
`/api/auth/customer/*` routes take the optional account's bearer token, and
nothing else does (`lib/api.ts` explains why `request()` never attaches one).

This package is the `edawr-frontend` repository. The customer app in
`../customer-app` is a port of it, route for route: **a change to
customer-facing behaviour belongs in both**, and its README lists the few
places the two are allowed to differ.

## The three rules this package is built around

**Money is never computed here.** The cart holds a display snapshot of prices;
every total comes from `/api/store/quote` and finally from the order the server
creates. `lib/format.ts` renders numbers and never does arithmetic on them. The
checkout request carries product ids and quantities only — no price, no fee, no
total. Adding up line totals in TypeScript would be a second pricing engine, and
it would disagree with the server the first time a fee changed.

**An account is optional, and guest checkout is the main path.** A customer
may sign up with a phone number and a password; nothing requires it. The
address book and the remembered name and number are localStorage
conveniences that prefill checkout for everyone, and a guest's order history
is the set of tracking tokens saved at checkout (`lib/recent-orders.ts`).
Possession of a token is the credential — the same trust model as a paper
receipt — and a signed-in customer additionally sees the orders placed on the
account. Clearing site data loses the local half.

**Never set state synchronously inside an effect.** `react-hooks/set-state-in-effect`
is an error here, and the fix is structural rather than a suppression: tag
fetched data with the query that produced it and *derive* the loading flag.
`useQuote`, `SearchOverlay` and `OrdersPage` are the worked examples.

## Framework notes

This is not the Next.js you may know — read `node_modules/next/dist/docs/`
before writing framework code.

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
