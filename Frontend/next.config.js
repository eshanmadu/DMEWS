/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "meteo.gov.lk",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
