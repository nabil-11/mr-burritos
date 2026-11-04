import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    // Live-update pointers in public/updates/: the manager app's (written by the
    // app's `npm run live:publish` and `npm run apk`) and the till's screen
    // bundles in updates/caisse/ (the till's `npm run live:publish`). They must
    // never be served from a cache, or an app keeps seeing the previous release.
    // The bundle zips are named by build number and never change, so they keep
    // default caching.
    return [
      {
        source: '/updates/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/updates/apk.json',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/updates/caisse/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
};

export default nextConfig;
