import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LigaPro",
    short_name: "LigaPro",
    description: "Plataforma de administración de ligas amateur",
    start_url: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#14b8a6",
    orientation: "portrait-primary",
    lang: "es-MX",
    icons: [
      {
        src: "/icons/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512?maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
