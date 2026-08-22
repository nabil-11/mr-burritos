import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const TITLE = "Mr. Burritos — Tacos · Burritos · Snacks";
const DESCRIPTION =
  "Restaurant Mr. Burritos — Tacos, Burritos & Snacks à Tunis. Composez votre tacos : taille M, XL ou XXL, vos viandes, vos sauces. Livraison ou à emporter.";

/**
 * `metadataBase` is what turns the relative image path below into the absolute
 * URL that WhatsApp, Messenger and Facebook require to render a preview. Set
 * NEXT_PUBLIC_SITE_URL in production or shared links will point at localhost.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "fr_TN",
    siteName: "Mr. Burritos",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/hero-banner.jpg",
        width: 1600,
        height: 843,
        alt: "Mr. Burritos — burritos, tacos, burgers, nachos et frites",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/hero-banner.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      dir="ltr"
      suppressHydrationWarning
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
