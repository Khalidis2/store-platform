import type { NextConfig } from "next";
import { assertProductionEnv } from "./lib/env";

assertProductionEnv();

const nextConfig: NextConfig = {};

export default nextConfig;
