/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Published pages and the editor canvas ship raw user HTML; we render it as
  // a string rather than through the image pipeline.
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
  // Left for the Workers runtime to load directly out of node_modules rather
  // than bundled by webpack, which is what lets @opennextjs/cloudflare's
  // build patch Prisma's wasm query engine into a location the Worker can
  // actually read at runtime.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
};

export default nextConfig;

// Lets `next dev` reach real Cloudflare bindings (the D1 database) through
// OpenNext's local simulation, instead of only working once deployed.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
