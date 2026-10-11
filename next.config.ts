import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The installed Tailwind loader implements the standard loader API.
  // Webpack builds avoid Turbopack's worker port requirement in restricted runtimes.
  webpack(config) {
    config.module.rules.push({test:/globals\.css$/,enforce:'pre',use:['@tailwindcss/turbopack']});
    return config;
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
