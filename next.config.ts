import type { NextConfig } from "next";

/* The FastAPI backend in api/ is reached through this app's own origin at
   /api/py/... unless API_BASE_URL points somewhere else (see the auth route
   handler). In development that prefix is proxied to a local uvicorn on port
   8000. On Vercel it is served by the Python function built from api/main.py,
   which Vercel exposes at /api/main. Vercel hands that function the original
   request path, so the FastAPI app strips the /api/py prefix itself. */
const BACKEND_PREFIX = "/api/py";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: `${BACKEND_PREFIX}/:path*`,
        destination:
          process.env.NODE_ENV === "development"
            ? `http://127.0.0.1:8000${BACKEND_PREFIX}/:path*`
            : "/api/main",
      },
    ];
  },
};

export default nextConfig;
