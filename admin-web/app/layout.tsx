import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Dirección · Activate Personal Training",
  description:
    "Panel interno para gestionar clientes, entrenadores y packs de Activate Personal Training.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/activate-icon.png",
    apple: "/activate-icon.png",
  },
  openGraph: {
    title: "Activate Personal Training · Panel Dirección",
    description:
      "Gestión privada de clientes, entrenadores y sesiones del centro.",
    type: "website",
    images: [
      {
        url: "/og-panel.png",
        width: 1735,
        height: 907,
        alt: "Activate Personal Training · Panel Dirección",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Activate Personal Training · Panel Dirección",
    description:
      "Gestión privada de clientes, entrenadores y sesiones del centro.",
    images: ["/og-panel.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
