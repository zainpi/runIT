// The templates store loads the Meta Pixel only when a pixel ID is configured.
const metaPixel = /^\d{5,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "");
const metaScript = metaPixel ? " https://connect.facebook.net" : "";
const metaBeacon = metaPixel ? " https://www.facebook.com" : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Runtime data and local credentials belong on their configured host/volume,
  // never in a traced Next.js or OpenNext deployment artifact.
  outputFileTracingExcludes: {
    "/*": ["./.neutronium-dev/**/*", "./deploy/neutronium/backups/**/*", "./.env", "./.env.*", "./.dev.vars*"],
  },
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
        source: "/templates/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}${metaScript}; style-src 'self' 'unsafe-inline'; img-src 'self' data:${metaBeacon}; font-src 'self'; connect-src 'self'${metaBeacon}${metaScript}; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com` },
        ],
      },
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
