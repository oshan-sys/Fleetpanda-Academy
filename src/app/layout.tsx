import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetPanda Academy",
  description: "Internal training platform for FleetPanda teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 font-sans text-neutral-950 antialiased">
        {children}
      </body>
    </html>
  );
}
