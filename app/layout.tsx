import type { Metadata } from "next";
import { Permanent_Marker, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SITE } from "@/lib/site";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * The hand-lettered voice of the brand — the brush "MR BURRITOS" on the sign and
 * the banners. Headlines only, a few words at a time; body text stays Jakarta.
 */
const marker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marker",
  display: "swap",
});

/**
 * Le titre et la description que Google montre : le quartier y figure, c'est
 * ce que tapent les gens (« tacos Ennasr », « burritos Ariana »). Le quartier
 * vient de lib/site, comme sur la page.
 */
const TITLE = `Mr. Burritos — Tacos, Burritos & Burgers à ${SITE.neighbourhood}, ${SITE.city} | Livraison`;
const DESCRIPTION = `Tacos, burritos, burgers et bowls à ${SITE.neighbourhood} (${SITE.city}). Commandez en ligne : −15 %, paiement à la livraison, prêt en ~25 min. Livraison dans l'Ariana ou à emporter.`;

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
      className={`${jakarta.variable} ${marker.variable} h-full antialiased`}
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
