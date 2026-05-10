import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone for now; add back when containerizing
  transpilePackages: ["react-markdown", "remark-gfm", "remark-parse", "unified", "vfile", "mdast-util-from-markdown", "mdast-util-to-hast", "hast-util-to-jsx-runtime"],
  // pi-coding-agent uses Node.js APIs and ESM; keep it out of the webpack bundle
  serverExternalPackages: ["@mariozechner/pi-coding-agent"],
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Applied only when no other route matches — keeps /api/* untouched
      fallback: [
        { source: "/:path*", destination: "/" },
      ],
    };
  },
};

export default nextConfig;
