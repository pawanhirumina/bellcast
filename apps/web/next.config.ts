import type { NextConfig } from "next";

const isTauri = process.env.TAURI_BUILD === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Only export static files when building for Tauri
  ...(isTauri ? { 
    output: 'export' as const,
    images: { unoptimized: true },
    distDir: 'out'
  } : {
    // Keep your security headers for the web version
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            {
              key: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
            },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;