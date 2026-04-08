function normalizeApiBaseUrl(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

const configuredApiBaseUrl = normalizeApiBaseUrl(
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!configuredApiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${configuredApiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
