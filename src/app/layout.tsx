import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory and reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable}`}>
      <body className="bg-[#0A0A0A] text-[#F0EDE8] antialiased">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-[#E8FF47] rounded-sm flex items-center justify-center">
                <span className="text-black font-mono font-bold text-sm">A</span>
              </div>
              <span className="font-syne font-bold text-xl tracking-tight">
                allo<span className="text-[#E8FF47]">.</span>inventory
              </span>
            </a>
            <div className="font-mono text-xs text-white/40 tracking-widest uppercase">
              Fulfillment Platform
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
