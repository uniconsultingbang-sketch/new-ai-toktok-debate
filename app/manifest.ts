import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Talk Talk",
    short_name: "AI Talk",
    description: "낙관, 비관, 중간 관점의 전문가들이 안건을 논리적으로 토론하는 AI Talk Talk 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8F9FF",
    theme_color: "#6A4CFF",
    orientation: "portrait",
    lang: "ko",
    icons: [
      {
        src: "/images/ai-talk-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/ai-talk-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/ai-talk-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/ai-talk-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
