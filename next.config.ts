import type { NextConfig } from "next";
import nextPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
};

const withPWA = nextPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  swSrc: "src/worker/index.ts",
});

export default withPWA(nextConfig);
