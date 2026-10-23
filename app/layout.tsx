import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emir Cell & Atin Group - WMS & Konter",
  description: "Business Control Center Integrated System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased bg-[#FDF8F9]">
        {children}
      </body>
    </html>
  );
}

