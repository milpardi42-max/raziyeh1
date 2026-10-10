import type { NextConfig } from "next";

// Browser-hosted previews cannot run the native Sharp image-optimisation service.
// Keep this separate from production and normal Node development.
const stackblitzPreview = process.env.ROSIE_STACKBLITZ === "1" && process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app", "*.webcontainer-api.io", "*.local-credentialless.webcontainer-api.io", "*.stackblitz.io"],
  // Keep server routes, API handlers, middleware, and authentication in the distributable bundle.
  output: "standalone",
  distDir: "dist/.next",
  async redirects() {
    return [
      // Resolve the short admin URL to the panel; middleware applies the current temporary access mode.
      { source: "/admin", destination: "/admin/fa", permanent: false },
      // Legacy locale-prefixed admin links land in the matching admin panel.
      { source: "/fa/admin", destination: "/admin/fa", permanent: false },
      { source: "/en/admin", destination: "/admin/en", permanent: false },
    ];
  },
  images: {
    unoptimized: stackblitzPreview,
    // The default candidate list tops out at 3840w, which appends dead weight to every srcset.
    // Nothing on this site renders wider than 2×1920; capping the list trims ~40% off each <img>.
    deviceSizes: [640, 750, 1080, 1200, 1920, 2560, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
