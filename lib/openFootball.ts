// =============================================================================
// Cliente de openfootball (worldcup.json) — fuente GRATIS y sin límites.
// =============================================================================
// Datos públicos del Mundial 2026: calendario + resultados (goles). NO trae
// córners ni disparos, así que con esta fuente solo se predice el mercado 1X2
// (los de córners/disparos se desactivan solos al no haber datos).
// Sin clave, sin límites de peticiones.
// =============================================================================

const SOURCE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

/** Partido ya normalizado para la ingesta. */
export interface OpenFootballFixture {
  id: number;
  kickoff: string; // ISO UTC
  status: "FT" | "NS";
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface OpenFootballData {
  teams: { id: number; name: string }[];
  fixtures: OpenFootballFixture[];
}

// -----------------------------------------------------------------------------
// Estructura cruda del JSON (solo lo que usamos).
// -----------------------------------------------------------------------------
interface RawMatch {
  date: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  score?: { ft?: [number, number] };
}
interface RawJson {
  name: string;
  matches: RawMatch[];
}

/** Hash estable (djb2) → entero positivo, para generar ids deterministas. */
function stableId(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  // Acotamos a un entero seguro y positivo.
  return h % 2_000_000_000;
}

/**
 * Construye el kickoff como ISO. Guardamos la HORA LOCAL de la sede tal cual,
 * anclando el componente de fecha UTC al DÍA OFICIAL del partido (el de
 * openfootball). Así "partidos de hoy" coincide con el calendario oficial de la
 * FIFA en lugar de descuadrarse por la zona horaria, y la hora mostrada (en UTC)
 * es la hora local de la sede que publican los horarios. Ej: "13:00 UTC-6" en
 * Ciudad de México → se muestra 13:00.
 */
export function parseKickoff(date: string, time?: string): string {
  if (!time) return `${date}T12:00:00.000Z`;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return `${date}T12:00:00.000Z`;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  return `${date}T${hh}:${mm}:00.000Z`;
}

/**
 * Descarga y normaliza el Mundial 2026. Solo se quedan los partidos entre las
 * 48 selecciones de la fase de grupos (se descartan los cruces de eliminatorias,
 * que todavía referencian plazas sin definir: "Winner Group A", etc.).
 */
export async function fetchOpenFootball(): Promise<OpenFootballData> {
  const res = await fetch(SOURCE_URL, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`openfootball respondió ${res.status}`);
  }
  const json = (await res.json()) as RawJson;

  // 1) Selecciones reales = las que aparecen en partidos con grupo asignado.
  const realNames = new Set<string>();
  for (const m of json.matches) {
    if (m.group) {
      realNames.add(m.team1);
      realNames.add(m.team2);
    }
  }

  const teams = [...realNames]
    .sort()
    .map((name) => ({ id: stableId("team:" + name), name }));
  const idOf = (name: string) => stableId("team:" + name);

  // 2) Fixtures entre selecciones reales.
  const fixtures: OpenFootballFixture[] = [];
  for (const m of json.matches) {
    if (!realNames.has(m.team1) || !realNames.has(m.team2)) continue;
    const ft = m.score?.ft;
    fixtures.push({
      id: stableId(`match:${m.date}:${m.team1}:${m.team2}`),
      kickoff: parseKickoff(m.date, m.time),
      status: ft ? "FT" : "NS",
      homeId: idOf(m.team1),
      homeName: m.team1,
      awayId: idOf(m.team2),
      awayName: m.team2,
      homeGoals: ft ? ft[0] : null,
      awayGoals: ft ? ft[1] : null,
    });
  }

  return { teams, fixtures };
}
