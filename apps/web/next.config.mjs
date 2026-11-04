const apiOrigin = (process.env.NEXT_PUBLIC_API_APP_URL || process.env.API_APP_URL || 'http://localhost:4000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy the API through the web app's own origin so admin session and CSRF cookies are
    // first-party. Cross-site cookies are blocked or stripped by browsers, which caused
    // admin requests to fail with 401 "Admin session is required".
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
