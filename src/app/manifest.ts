import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ENERGYDEX",
    short_name: "ENERGYDEX",
    description: "Scan, rate, and collect energy drinks.",
    start_url: "/",
    display: "standalone",
    background_color: "#090b0a",
    theme_color: "#b9ff38",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
