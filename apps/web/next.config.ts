import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // Browser calls go to /api/* on the web origin and are proxied to Nest, so cookies stay first-party.
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
  transpilePackages: ['@ledgerline/api-client'],
};

export default nextConfig;
