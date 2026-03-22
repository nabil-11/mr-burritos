import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mr. Burritos — Tacos · Burritos · Snacks",
  description: "Restaurant Mr. Burritos — Tacos, Burritos & Snacks à Tunis. Commandez en ligne, livraison ou à emporter.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" dir="ltr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
