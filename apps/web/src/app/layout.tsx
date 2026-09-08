import type { Metadata, Viewport } from "next";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Between Words",
    template: "%s — Between Words",
  },
  description:
    "A party game of related secret words and social deduction. Play face-to-face or in a private online room.",
};

export const viewport: Viewport = {
  themeColor: "#f7f4ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-teal focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20 pt-4">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
