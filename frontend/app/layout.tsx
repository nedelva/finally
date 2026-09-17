import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinAlly — AI Trading Workstation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-bg)] text-gray-100">{children}</body>
    </html>
  );
}
