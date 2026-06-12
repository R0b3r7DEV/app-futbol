// =============================================================================
// Lectura centralizada de variables de entorno (con mensajes claros si faltan).
// =============================================================================

/** Devuelve una variable de entorno obligatoria o lanza un error explicativo. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa tu .env.local (ver .env.example).`,
    );
  }
  return value;
}

/** Configuración de la liga del Mundial 2026. */
export const MUNDIAL = {
  leagueId: 1,
  season: 2026,
} as const;
