import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "new AI 톡톡 토론",
    short_name: "3관점 토론",
    description: "낙관, 회의, 중간 관점의 전문가들이 안건을 논리적으로 토론하는 로컬 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5F2EA",
    theme_color: "#172033",
    orientation: "portrait",
    lang: "ko",
    icons: [
      {
        src: "/images/ai-toktok-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/ai-toktok-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
