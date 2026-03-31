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
      <body className="bg-background text-foreground">
        <main className="min-h-screen">
          <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 text-sm">
              <div className="flex flex-col">
                <Link href="/" className="text-lg font-semibold text-white">
                  Simulator Studio
                </Link>
                <span className="text-xs text-slate-400">
                  Standalone teacher builder and FTC simulator
                </span>
              </div>
              <div className="flex items-center gap-4 text-slate-300">
                <Link href="/simulator-builder" className="hover:text-white">
                  Builder
                </Link>
                <Link href="/simulator-test" className="hover:text-white">
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
