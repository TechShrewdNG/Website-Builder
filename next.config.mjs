/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Published pages and the editor canvas ship raw user HTML; we render it as
  // a string rather than through the image pipeline.
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
