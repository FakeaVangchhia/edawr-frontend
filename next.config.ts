import type { NextConfig } from "next";

/**
 * Refuse to produce a build that cannot talk to the API.
 *
 * `src/proxy.ts` derives the CSP's `connect-src` and `img-src` from
 * NEXT_PUBLIC_API_URL, and it is written to degrade quietly: an unset or
 * unparseable value yields an empty origin, the policy comes out as
 * `connect-src 'self'`, and the browser blocks every request the storefront
 * makes. The shop then renders perfectly and shows an empty catalogue with no
 * product images — and because it is the *browser* refusing, nothing appears in
 * a deploy log, a health check or an error report. A hosting dashboard where
 * nobody filled the variable in produces exactly this, and it stays invisible
 * until a customer opens the site.
 *
 * That is too quiet a failure for the most consequential variable here, so the
 * build stops instead. Development is exempt: `next dev` is where you are
 * allowed to have half a configuration.
 *
 * The console has had this guard since it was split out; the storefront had
 * not, and the storefront needs it more — it has no CI to catch anything, and
 * it is the half of the estate customers see.
 */
if (process.env.NODE_ENV === "production") {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  let origin = "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      origin = parsed.origin;
    }
  } catch {
    // Leaves origin empty, which the check below reports.
  }

  if (!origin) {
    const what = raw ? `not a usable http(s) URL (got ${JSON.stringify(raw)})` : "unset";
    throw new Error(
      [
        `NEXT_PUBLIC_API_URL is ${what}.`,
        "",
        "It names the Django API in the CSP's connect-src and img-src, and is",
        "baked into the client bundle — so a build without it ships a storefront",
        "that paints, lists nothing, and shows no product images.",
        "",
        "Set it on the deployment (and in .env locally), scheme included and no",
        "trailing slash, e.g. https://api.example.com — then rebuild. Changing",
        "it needs a rebuild, not a restart.",
      ].join("\n"),
    );
  }
}

// Baseline hardening headers applied to every response. These are the ones
// that never vary per request, which is why they live here where they can be
// read without tracing a function.
//
// The Content-Security-Policy is deliberately NOT here: it carries a
// per-request nonce and therefore has to be generated per request, which is
// `src/proxy.ts`. Do not add a second policy to this list — two CSP headers on
// one response are intersected, and the result is whichever is stricter in
// every directive, which is nobody's intent.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

/**
 * HSTS, one year, production builds only.
 *
 * The API sends this (`SECURE_HSTS_SECONDS`) and so does the console. The
 * storefront was the last of the three not to, and it is not the least
 * important one: `/signin` and `/signup` are here, so a first request over
 * plain HTTP is a customer's password on the wire, and the tracking token in
 * `/order/[token]` is a bearer credential in a URL. The header tells the
 * browser never to try HTTP for this host again.
 *
 * **No `includeSubDomains`, unlike the console.** That directive was safe there
 * because the console is itself a subdomain and the flag only reached below it.
 * The storefront is the apex, so the same flag would force HTTPS on every
 * sibling — the API, the console, and anything not yet built — on the strength
 * of one header served from the shop. That is a commitment to make deliberately
 * on the apex, once every host is known to serve TLS, not one to inherit from a
 * copy-paste. Each host asserts its own policy today.
 *
 * No `preload` either: that is a submission to a browser-vendor list and is
 * close to irreversible.
 *
 * Guarded on NODE_ENV because a header a browser ignores over plain HTTP is
 * still a header worth not sending in development, where the answer to "why is
 * localhost forcing HTTPS" costs an afternoon.
 */
const productionOnlyHeaders =
  process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, ...productionOnlyHeaders],
      },
    ];
  },
};

export default nextConfig;
