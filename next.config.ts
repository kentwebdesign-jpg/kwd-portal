import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Serve the static onboarding form at the clean /brief URL.
    return [{ source: "/brief", destination: "/brief/index.html" }];
  },
};

export default nextConfig;
