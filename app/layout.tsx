import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Simulator Studio",
  description:
    "Standalone FTC simulator and teacher builder for designing lesson-ready robots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.className} dark`} suppressHydrationWarning>
      <body className="bg-black text-white">
        <main className="min-h-screen">
          <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl">
            <div className="flex h-16 w-full items-center justify-between px-5 text-sm">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="rounded-full border border-white/10 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-black"
                >
                  Simulator Studio
                </Link>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <Link
                  href="/simulator-builder"
                  className="rounded-full px-3 py-2 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Builder
                </Link>
                <Link
                  href="/simulator-test"
                  className="rounded-full px-3 py-2 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Simulator
                </Link>
              </div>
            </div>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
