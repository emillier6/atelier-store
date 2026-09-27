import type { NextConfig } from "next";
import { UNSPLASH_SEARCH } from "./src/lib/images";

const nextConfig: NextConfig = {
  images: {
    // Only Unsplash photos requested with our fixed query string are optimized.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
        search: UNSPLASH_SEARCH,
      },
    ],
    qualities: [75],
  },
};

export default nextConfig;
