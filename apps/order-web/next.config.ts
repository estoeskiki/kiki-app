import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @kiki/supabase and @kiki/ui-tokens are workspace TS packages with no
  // build step of their own — Next.js needs to transpile them itself.
  transpilePackages: ['@kiki/supabase', '@kiki/ui-tokens'],
  // Allows dev server + HMR websocket to be reached from a phone on the same
  // LAN via the machine's IP instead of localhost (Next.js blocks other
  // origins by default as a dev-server CSRF protection).
  allowedDevOrigins: ['192.168.0.26', '192.168.11.210'],
  // Lets next/image optimize (resize/reformat) photos stored in the
  // "storefront-media" Supabase Storage bucket — welcome_bg_url/logo_url.
  // Arbitrary external photo URLs are intentionally NOT whitelisted here;
  // storing media in our own Storage bucket is what makes optimization safe
  // (a fixed, known origin) instead of allow-listing random restaurant sites.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'shmmbnvdtmqxmrlzpluh.supabase.co',
        pathname: '/storage/v1/object/public/storefront-media/**',
      },
      // "kiki" bucket (pre-existing, used elsewhere for org welcome media —
      // now public). Both paths allowed: public for new uploads, sign for
      // the older signed URL already stored on COS Sports Plaza's welcome_bg_url.
      {
        protocol: 'https',
        hostname: 'shmmbnvdtmqxmrlzpluh.supabase.co',
        pathname: '/storage/v1/object/public/kiki/**',
      },
      {
        protocol: 'https',
        hostname: 'shmmbnvdtmqxmrlzpluh.supabase.co',
        pathname: '/storage/v1/object/sign/kiki/**',
      },
      // picsum.photos: dev-only placeholder photos seeded on test
      // restaurants/food courts. Remove once those are replaced with real
      // uploads to storefront-media.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};

export default nextConfig;
