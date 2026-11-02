import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/nunito";
import "./globals.css";
import { AuthProvider } from "@/components/auth";

export const metadata: Metadata = {
  title: "Tréning",
  description: "Precvičovanie školských predmetov pre deti základnej školy",
  appleWebApp: { capable: true, title: "Tréning", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#eef3fb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
