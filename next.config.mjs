/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
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
      { source: "/", destination: "/the-last-echo/", permanent: true },
      { source: "/services", destination: "/", permanent: true },
      { source: "/case-studies", destination: "/", permanent: true },
      { source: "/about", destination: "/the-last-echo/about.html", permanent: true },
      { source: "/contact", destination: "/the-last-echo/support.html", permanent: true },
      { source: "/book", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
