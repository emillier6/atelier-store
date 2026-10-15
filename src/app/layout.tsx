import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter_Tight } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCategories } from "@/lib/products";
import "./globals.css";

// UI and body copy: tight grotesque with a light-to-bold weight range
const sans = Inter_Tight({
  variable: "--font-sans-face",
  subsets: ["latin"],
});

// Display headlines only: high-contrast serif
const display = Bodoni_Moda({
  variable: "--font-display-face",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Atelier Store", template: "%s | Atelier Store" },
  description: "Atelier Store",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The menu lists the real categories, so it follows edits in /admin.
  const categories = await getCategories();

  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader categories={categories} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
