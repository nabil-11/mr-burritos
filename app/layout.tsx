import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mr. Burritos — Tacos · Burritos · Snacks",
  description: "Restaurant Mr. Burritos — Tacos, Burritos & Snacks à Tunis. Commandez en ligne, livraison ou à emporter.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" dir="ltr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
