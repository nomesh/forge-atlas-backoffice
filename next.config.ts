import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/customers/:customerId',
        destination: '/customers/detail?customerId=:customerId',
      },
    ];
  },
};

export default nextConfig;
