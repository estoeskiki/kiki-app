import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @kiki/supabase and @kiki/ui-tokens are workspace TS packages with no
  // build step of their own — Next.js needs to transpile them itself.
  transpilePackages: ['@kiki/supabase', '@kiki/ui-tokens'],
  // Allows dev server + HMR websocket to be reached from a phone on the same
  // LAN via the machine's IP instead of localhost (Next.js blocks other
  // origins by default as a dev-server CSRF protection).
  allowedDevOrigins: ['192.168.0.26', '192.168.11.210'],
};

export default nextConfig;
