import type { Metadata } from "next";
import { VT323, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cello Buddy",
  description:
    "A practice companion that watches, listens, and follows your sheet music.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${vt323.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
