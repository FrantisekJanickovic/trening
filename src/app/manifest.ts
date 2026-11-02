import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tréning",
    short_name: "Tréning",
    description: "Precvičovanie školských predmetov pre deti základnej školy",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef3fb",
    theme_color: "#eef3fb",
    lang: "sk",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
