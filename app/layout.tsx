import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Talk Talk",
  description: "낙관, 비관, 중간 관점의 전문가들이 안건을 논리적으로 토론하는 AI Talk Talk 서비스",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AI Talk Talk",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/images/ai-toktok-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/ai-toktok-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#172033",
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
