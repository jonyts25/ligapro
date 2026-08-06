import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  PLATFORM_DESCRIPTION,
  PLATFORM_NAME,
  platformPageTitle,
} from "@/lib/platform/config";
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
  applicationName: PLATFORM_NAME,
  title: {
    default: PLATFORM_NAME,
    template: platformPageTitle("%s"),
  },
  description: PLATFORM_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: PLATFORM_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#14b8a6",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#main-content"
          className="absolute left-[-9999px] top-4 z-50 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground focus:left-4"
        >
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
