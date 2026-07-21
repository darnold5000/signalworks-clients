import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { AuthTokenHandler } from "@/components/auth-token-handler";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.productName} | ${siteConfig.name}`,
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Manage your Signal Works website, billing, and update requests.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthTokenHandler />
        {children}
      </body>
    </html>
  );
}
