import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /api/preview reads template HTML off disk at request time. Vercel bundles
  // a serverless function from the traced import graph, and a readFile with a
  // computed path is invisible to that trace — without this, the route works
  // locally and 404s on every template in production.
  outputFileTracingIncludes: {
    "/api/preview": ["./templates/**/*"],
  },
};

export default nextConfig;
