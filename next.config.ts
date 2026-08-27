import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
