import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const appRoot = path.dirname(require.resolve("./package.json"));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
