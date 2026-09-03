/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three/drei ship untranspiled ESM in places; Next handles it via transpilePackages.
  transpilePackages: ['three'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
