/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three/drei ship untranspiled ESM in places; Next handles it via transpilePackages.
  transpilePackages: ['three'],
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? // `info` is kept as well as error/warn: /api/inquiry logs every
          // submission there, which is the fallback record of a lead on a host
          // with no persistent disk. See src/app/api/inquiry/route.ts.
          { exclude: ['error', 'warn', 'info'] }
        : false,
  },
  async redirects() {
    return [
      {
        // Cleaning and Staffing were one division until they were split into
        // two. The old URL is in the wild - search results, anything already
        // linked - so it keeps working.
        source: '/services/cleaning-staffing',
        destination: '/services/cleaning',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
