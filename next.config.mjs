/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * Build a self-contained server into .next/standalone.
   *
   * This is what deploy.sh ships to the VPS: server.js plus only the
   * node_modules actually reached at runtime, which is a fraction of the full
   * install. Nothing else changes - `npm run dev` and `npm start` behave
   * exactly as before, and this key is ignored by both.
   *
   * The two folders Next does NOT copy in, because they are static assets
   * rather than traced code, are `public/` and `.next/static`. deploy.sh and
   * update.sh copy them in after every build; see the `stage` step in both.
   */
  output: 'standalone',
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
