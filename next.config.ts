import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "app/api/asp/honeypot/route": ["./bin/onchainos"],
  },
  webpack: (config) => {
    // WalletConnect's dependency tree references optional logger transports
    // (pino-pretty) and a couple of legacy Node-only packages that aren't
    // actually used at runtime in the browser — externalize them so
    // webpack doesn't try (and fail) to resolve them into the bundle.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
