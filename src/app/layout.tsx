import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource-variable/source-serif-4/wght.css";
import "@fontsource-variable/source-serif-4/wght-italic.css";
import "./globals.css";

// Fonts are self-hosted through @fontsource-variable (no request to Google
// at build or run time). Each file has a unicode-range, so a page only
// downloads the subsets it uses; latin-ext and vietnamese carry the
// diacritics Yoruba orthography needs (e.g. Ọ, Ẹ, Ṣ). The --font-sans and
// --font-heading variables are defined in globals.css.

export const metadata: Metadata = {
  title: "Department of Mathematics, OAU",
  description: "Department of Mathematics, Obafemi Awolowo University, Ile-Ife",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased `}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
