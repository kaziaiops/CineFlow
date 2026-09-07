import type { Metadata } from "next";
import { Space_Grotesk, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineFlow — Blindside Effect",
  description: "Local production pipeline for faceless AI YouTube videos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <span className="index-badge h-8 w-8 rounded-lg text-sm">C</span>
            <span className="font-display font-semibold tracking-tight text-[var(--text-primary)]">
              CineFlow
              <span className="text-[var(--text-tertiary)] font-normal"> · Blindside Effect</span>
            </span>
          </a>
          <nav className="text-sm flex gap-6">
            <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Projects
            </a>
            <a href="/settings" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Settings
            </a>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
