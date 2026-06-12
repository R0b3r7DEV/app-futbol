import type { Metadata, Viewport } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";

// Tipografías con carácter (NO Inter ni Arial): Fraunces (serif display) para
// titulares y Sora (sans geométrica) para el cuerpo.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fraunces",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Mundial Predictor 2026",
  description:
    "Predicciones estadísticas de los partidos del Mundial 2026 (herramienta de análisis personal).",
};

export const viewport: Viewport = {
  themeColor: "#050d0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} ${sora.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
