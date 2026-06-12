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

/**
 * Configuración del torneo. La temporada es configurable por entorno
 * (MUNDIAL_SEASON) para poder usar la demo de 2022 con el plan gratuito y
 * cambiar a 2026 con un plan de pago sin tocar código.
 */
export const MUNDIAL = {
  leagueId: Number(process.env.MUNDIAL_LEAGUE_ID ?? 1),
  season: Number(process.env.MUNDIAL_SEASON ?? 2026),
} as const;
