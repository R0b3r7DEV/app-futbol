// =============================================================================
// Cliente de API-Football (api-sports.io).
// =============================================================================
// Cuota gratuita: 100 req/día → cacheamos respuestas (revalidate ~10 min) y
// agrupamos llamadas. La autenticación va en la cabecera x-apisports-key.
// =============================================================================

import { requireEnv } from "./env";

const BASE_URL = "https://v3.football.api-sports.io";

/** Segundos de revalidación de caché para las llamadas (10 min). */
const REVALIDATE_SECONDS = 600;

/** Realiza una petición GET a API-Football y devuelve el array `response`. */
async function apiGet<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T[]> {
  const key = requireEnv("API_FOOTBALL_KEY");
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    // En entorno Next esto cachea; en scripts (tsx) la opción se ignora.
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`API-Football ${path} respondió ${res.status}`);
  }

  const json = (await res.json()) as {
    errors?: unknown;
    response?: T[];
  };

  // API-Football devuelve 200 con un objeto `errors` no vacío cuando algo falla
  // (p. ej. cuota agotada o parámetros inválidos).
  if (json.errors && !Array.isArray(json.errors) && Object.keys(json.errors).length) {
    throw new Error(`API-Football ${path}: ${JSON.stringify(json.errors)}`);
  }
  return json.response ?? [];
}

// -----------------------------------------------------------------------------
// Tipos parciales de las respuestas (solo lo que usamos).
// -----------------------------------------------------------------------------

export interface ApiFixture {
  fixture: {
    id: number;
    date: string; // ISO
    status: { short: string };
  };
  league: { id: number; season: number };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

export interface ApiStatisticItem {
  type: string;
  value: number | string | null;
}

export interface ApiFixtureStatistics {
  team: { id: number };
  statistics: ApiStatisticItem[];
}

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------

/** Todos los partidos de una liga/temporada. */
export function getFixtures(leagueId: number, season: number): Promise<ApiFixture[]> {
  return apiGet<ApiFixture>("/fixtures", { league: leagueId, season });
}

/** Un partido por id. */
export async function getFixtureById(id: number): Promise<ApiFixture | null> {
  const list = await apiGet<ApiFixture>("/fixtures", { id });
  return list[0] ?? null;
}

/** Estadísticas detalladas de un partido (córners, disparos, posesión...). */
export function getFixtureStatistics(
  fixtureId: number,
): Promise<ApiFixtureStatistics[]> {
  return apiGet<ApiFixtureStatistics>("/fixtures/statistics", {
    fixture: fixtureId,
  });
}

/**
 * Estadísticas agregadas de un equipo en una liga/temporada (clasificación,
 * usado por el seeding para obtener medias de goles).
 */
export function getTeamStatistics(
  leagueId: number,
  season: number,
  teamId: number,
): Promise<unknown[]> {
  return apiGet("/teams/statistics", {
    league: leagueId,
    season,
    team: teamId,
  });
}

/**
 * Extrae un valor numérico de una lista de estadísticas por su `type`.
 * Maneja porcentajes ("57%") y nulos. Devuelve `null` si no aparece.
 */
export function readStat(
  stats: ApiStatisticItem[],
  type: string,
): number | null {
  const item = stats.find((s) => s.type === type);
  if (!item || item.value == null) return null;
  if (typeof item.value === "number") return item.value;
  // valores tipo "57%" o "12"
  const n = parseFloat(String(item.value).replace("%", ""));
  return Number.isNaN(n) ? null : n;
}
