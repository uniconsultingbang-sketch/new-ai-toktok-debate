import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://new-ai-toktok-debate.vercel.app"),
  title: "AI Talk Talk",
  description: "낙관, 비관, 중간 관점의 전문가들이 안건을 논리적으로 토론하는 AI Talk Talk 서비스",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AI Talk",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/images/ai-talk-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/ai-talk-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "AI Talk Talk",
    description: "Claude, GPT, Gemini가 세 관점으로 토론하고 결론을 정리합니다.",
    url: "https://new-ai-toktok-debate.vercel.app/",
    siteName: "AI Talk Talk",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/images/ai-talk-og-v0512.png",
        width: 1200,
        height: 630,
        alt: "AI Talk Talk",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Talk Talk",
    description: "Claude, GPT, Gemini가 세 관점으로 토론하고 결론을 정리합니다.",
    images: ["/images/ai-talk-og-v0512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6A4CFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
