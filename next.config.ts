import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fijamos la raíz del proyecto: hay un package-lock.json suelto en la carpeta
  // de usuario y, sin esto, Next infiere mal el directorio raíz.
  turbopack: {
    root: import.meta.dirname,
  },
  // Permitimos cargar los escudos de las selecciones desde API-Football.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
    ],
  },
};

export default nextConfig;
