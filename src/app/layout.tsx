import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ODDOREVE: Next-Gen Camera Hand Cricket & Baseball",
  description: "Play ODDOREVE online on camera against friends or the AI computer. Real-time vision finger detection, 2v2 modes, and anti-cheat multiplayer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&family=Syne:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#07090e] text-slate-100 selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
