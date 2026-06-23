import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slim Yet? / 瘦了么",
  description: "Fun group weight tracking with private baselines and public progress deltas.",
  icons: {
    icon: "/brand/thermal-jewel.png",
    apple: "/brand/thermal-jewel.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff4d3d"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
