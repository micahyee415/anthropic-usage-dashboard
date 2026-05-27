import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anthropic Usage Dashboard — Example Corp",
  description: "API token usage and spend across Example Corp and Example Corp Developer Anthropic orgs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
