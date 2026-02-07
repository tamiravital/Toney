import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@toney/types",
    "@toney/constants",
    "@toney/coaching",
  ],
};

export default nextConfig;
