import type { NextConfig } from "next";
import { readAllowedDevOrigins } from "./src/lib/db/read-hostnames";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["echarts", "zrender"],
  turbopack: {},
  allowedDevOrigins: readAllowedDevOrigins(),
};

export default nextConfig;
