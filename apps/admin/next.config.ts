import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@toney/types",
    "@toney/constants",
  ],
};

export default nextConfig;
