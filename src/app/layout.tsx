import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-ext-400.css";
import "@fontsource/ibm-plex-sans/latin-ext-500.css";
import "@fontsource/ibm-plex-sans/latin-ext-600.css";
import "@fontsource/ibm-plex-sans/vietnamese-400.css";
import "@fontsource/ibm-plex-sans/vietnamese-500.css";
import "@fontsource/ibm-plex-sans/vietnamese-600.css";
import "@fontsource/ibm-plex-serif/latin-500.css";
import "@fontsource/ibm-plex-serif/latin-600.css";
import "@fontsource/ibm-plex-serif/latin-ext-500.css";
import "@fontsource/ibm-plex-serif/latin-ext-600.css";
import "@fontsource/ibm-plex-serif/vietnamese-500.css";
import "@fontsource/ibm-plex-serif/vietnamese-600.css";
import "./globals.css";

// Fonts are self-hosted through @fontsource (no request to Google at build
// or run time). latin-ext and vietnamese carry the diacritics Yoruba
// orthography needs (e.g. Ọ, Ẹ, Ṣ); each file has a unicode-range so the
// browser only downloads the subsets a page uses. The --font-sans and
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
