/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      { source: "/services", destination: "/", permanent: true },
      { source: "/case-studies", destination: "/", permanent: true },
      { source: "/about", destination: "/the-last-echo/about.html", permanent: true },
      { source: "/contact", destination: "/the-last-echo/support.html", permanent: true },
      { source: "/book", destination: "/", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/the-last-echo/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
