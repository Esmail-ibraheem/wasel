import type { Metadata } from "next";
import { Changa, Vazirmatn, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const changa = Changa({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-changa",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-vazirmatn",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "واصل", template: "%s · واصل" },
  description: "متابعة التحويلات الواردة عبر المحافظ الإلكترونية في مكان واحد",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${changa.variable} ${vazirmatn.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
