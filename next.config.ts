import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid picking a parent folder when multiple package-lock.json files exist (e.g. monorepo home).
    root: path.join(__dirname),
  },
};

export default nextConfig;
