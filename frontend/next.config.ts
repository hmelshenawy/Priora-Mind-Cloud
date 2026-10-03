import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  experimental: {
    // Allow Nest's 120s Agent deadline plus persistence/response time (Next defaults to 30s).
    proxyTimeout: 150_000,
  },
  async rewrites() {
    const backend = (process.env.NEST_INTERNAL_API_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

    return [{source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*`}];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
