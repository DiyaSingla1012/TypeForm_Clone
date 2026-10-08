import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  // Dev and production must not overwrite one another's generated chunks.
  return { distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-build" };
}
