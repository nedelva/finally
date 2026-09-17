import type { NextConfig } from "next";

// Static export: `npm run build` produces `out/` with no server runtime —
// FastAPI serves that directory directly, same-origin, in production.
//
// Next.js does not allow `rewrites()` to be defined at all alongside
// `output: 'export'` (it errors at build time even if the function returns
// an empty array), so the two configs are built as entirely separate
// objects rather than toggled by a flag inside one object. `npm run dev`
// (only) proxies `/api/*` to a locally running backend on port 8000, purely
// for local development convenience — this proxy does not exist in the
// exported build, which is fine because the static files it produces are
// served BY FastAPI itself in production, so `/api/*` is already
// same-origin there.
const isDev = process.env.NODE_ENV === "development";

const devConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

const exportConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

const nextConfig: NextConfig = isDev ? devConfig : exportConfig;

export default nextConfig;
