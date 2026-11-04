import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    // The manager app's live-update pointers (public/updates/, written by the
    // app's `npm run live:publish` and `npm run apk`). They must never be served
    // from a cache, or an app keeps seeing the previous release. The bundle zips
    // are named by build number and never change, so they keep default caching.
    return [
      {
        source: '/updates/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/updates/apk.json',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
};

export default nextConfig;
