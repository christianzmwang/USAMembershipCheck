import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BAFC USA Fencing Membership Dashboard",
  description: "Bay Area Fencing Club USA Fencing Membership Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-full w-full bg-gray-50`}>
  <Analytics/>
  {children}
      </body>
    </html>
  );
}
