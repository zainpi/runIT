/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
      { source: "/local-lore", destination: "/local-lore/index.html" },
      { source: "/local-lore/", destination: "/local-lore/index.html" },
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
      { source: "/", destination: "/the-last-echo/", permanent: true },
      { source: "/services", destination: "/", permanent: true },
      { source: "/case-studies", destination: "/", permanent: true },
      {
        source: "/about",
        destination: "/the-last-echo/about.html",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/the-last-echo/support.html",
        permanent: true,
      },
      { source: "/book", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
