import type { Metadata, Viewport } from "next";
import { BottomNav, TopNav } from "@/components/AppNav";
import { ChildFilterBar } from "@/components/ChildFilterBar";
import { FamilyProvider } from "@/components/FamilyProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Hub (Demo)",
  description: "One family dashboard for every school, child and update. Demo with fictional data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f3ef",
};

function DemoBanner() {
  return (
    <div
      role="note"
      className="sticky top-0 z-40 h-7 truncate bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold leading-4 text-amber-950"
    >
      DEMO · Fictional data<span className="hidden sm:inline"> · family and schools</span> · Nothing real is connected
    </div>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <DemoBanner />
        <div className="mx-auto max-w-2xl pb-28 md:pb-12">
          <header className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
                SH
              </span>
              <span className="text-lg font-semibold tracking-tight">School Hub</span>
            </div>
            <TopNav />
          </header>
          <FamilyProvider>
            <div className="sticky top-7 z-20 bg-[#f4f3ef]/90 backdrop-blur-md">
              <ChildFilterBar />
            </div>
            <main className="px-4">{children}</main>
          </FamilyProvider>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
