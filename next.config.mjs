/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @react-pdf/renderer must not be bundled by webpack for server routes
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
