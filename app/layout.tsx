import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NICHE YT Studio",
  description: "Remotion video production and AI voice workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}