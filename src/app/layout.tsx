import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Department of Mathematics, OAU",
  description: "Department of Mathematics, Obafemi Awolowo University, Ile-Ife",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${plexSans.variable} ${plexSerif.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
