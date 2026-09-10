/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.NEUTRONIUM_DIST_DIR ? { distDir: process.env.NEUTRONIUM_DIST_DIR } : {}),
  ...(process.env.NEUTRONIUM_STANDALONE === "true"
    ? { eslint: { ignoreDuringBuilds: true }, typescript: { ignoreBuildErrors: true } }
    : {}),
  ...(process.env.NEUTRONIUM_STANDALONE === "true"
    ? { output: "standalone", experimental: { cpus: 1 } }
    : {}),
  poweredByHeader: false,
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/neutronium/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async rewrites() {
    return [
      {
        source: "/the-last-echo",
        destination: "/the-last-echo/index.html",
      },
      {
        source: "/the-last-echo/",
        destination: "/the-last-echo/index.html",
      },
      {
        source: "/the-last-echo/guides",
        destination: "/the-last-echo/guides/index.html",
      },
      {
        source: "/the-last-echo/guides/",
        destination: "/the-last-echo/guides/index.html",
      },
    ];
  },
  async redirects() {
    return [
      { source: "/services", destination: "/#products", permanent: true },
      { source: "/case-studies", destination: "/#products", permanent: true },
      {
        source: "/about",
        destination: "/#company",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/#contact",
        permanent: true,
      },
      { source: "/book", destination: "/#contact", permanent: true },
    ];
  },
};

export default nextConfig;
