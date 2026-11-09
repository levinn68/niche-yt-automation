import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Studio",
  description: "A multi-platform content production and publishing studio"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}