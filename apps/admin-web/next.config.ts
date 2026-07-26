import type { NextConfig } from 'next';

/**
 * Static security headers.
 *
 * Content-Security-Policy is deliberately NOT here — it carries a per-request
 * nonce and so is built in proxy.ts. Keeping it out of this file means there is
 * exactly one place that defines the policy; two definitions would silently
 * fight, and the weaker one would win wherever it applied last.
 *
 * These headers are all request-independent, so they belong in the static
 * config where they cost nothing per request.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Stop the browser guessing content types (an uploaded "image" that
          // is really HTML must not be rendered as HTML).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Belt and braces alongside the CSP's frame-ancestors, for browsers
          // that honour only one of the two.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Never leak an admin URL (which contains order and restaurant ids)
          // into a third party's referer log.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
