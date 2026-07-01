import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless Chrome for the design-review loop must load at runtime from
  // node_modules, not be bundled by the compiler.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
