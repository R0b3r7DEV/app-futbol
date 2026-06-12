// =============================================================================
// Capa de predicción: lee Supabase, construye fuerzas y aplica el modelo.
// =============================================================================
// La usan los endpoints /api/predict y /api/predict/day. Mantiene una sola
// fuente de verdad para transformar filas de la BD en MatchPrediction.
// =============================================================================

import { supabaseAdmin } from "./supabase";
import { MUNDIAL } from "./env";
import { predictMatch } from "./poissonModel";
import {
  leagueAveragesFromStats,
  strengthFromStats,
  type TeamStatsRow,
} from "./strength";
import {
  MODEL_DISCLAIMER,
  type DayResponse,
  type LeagueAverages,
  type MatchPrediction,
  type MatchTeam,
} from "./types";

/** Fila de fixtures que necesitamos. */
interface FixtureRow {
  id: number;
  kickoff: string;
  home_team_id: number;
  away_team_id: number;
}

/**
 * Anfitriones del Mundial 2026: solo ellos juegan realmente en casa. El resto
 * de partidos son en campo neutral, así que no se les aplica ventaja de campo
 * (aplicarla a todos sesgaría las predicciones). Nombres como en teams.name.
 */
const HOST_TEAMS = new Set(["usa", "united states", "canada", "mexico"]);

/** Ventaja para el anfitrión jugando en casa; 1.0 = neutral (sin ventaja). */
const HOST_ADVANTAGE = 1.25;
const NEUTRAL_ADVANTAGE = 1.0;

function homeAdvantageFor(homeName: string): number {
  return HOST_TEAMS.has(homeName.trim().toLowerCase())
    ? HOST_ADVANTAGE
    : NEUTRAL_ADVANTAGE;
}

/** Carga el catálogo de equipos como mapa id → MatchTeam. */
async function loadTeams(ids: number[]): Promise<Map<number, MatchTeam>> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("teams")
    .select("id, name, code, logo_url")
    .in("id", ids);
  if (error) throw error;
  const map = new Map<number, MatchTeam>();
  for (const t of data ?? []) {
    map.set(t.id, {
      id: t.id,
      name: t.name,
      code: t.code,
      logoUrl: t.logo_url,
    });
  }
  return map;
}

/** Carga TODAS las team_stats del torneo (para medias de liga) y como mapa. */
async function loadStats(): Promise<{
  rows: TeamStatsRow[];
  byTeam: Map<number, TeamStatsRow>;
}> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("team_stats")
    .select(
      "team_id, matches_played, avg_goals_for, avg_goals_against, avg_corners_for, avg_corners_against, avg_shots_for, avg_shots_against, seed_attack, seed_defense",
    )
    .eq("league_id", MUNDIAL.leagueId)
    .eq("season", MUNDIAL.season);
  if (error) throw error;

  const byTeam = new Map<number, TeamStatsRow>();
  const rows: TeamStatsRow[] = [];
  for (const r of data ?? []) {
    const row = r as TeamStatsRow & { team_id: number };
    byTeam.set(row.team_id, row);
    rows.push(row);
  }
  return { rows, byTeam };
}

/**
 * Determina qué mercados tienen datos. Si ninguna selección tiene córners o
 * disparos registrados (p. ej. la fuente openfootball, o aún no hay partidos),
 * esos mercados se desactivan y solo se predice el 1X2.
 */
function availableMarkets(rows: TeamStatsRow[]): {
  corners: boolean;
  shots: boolean;
} {
  const corners = rows.some(
    (r) => (r.avg_corners_for ?? 0) > 0 || (r.avg_corners_against ?? 0) > 0,
  );
  const shots = rows.some(
    (r) => (r.avg_shots_for ?? 0) > 0 || (r.avg_shots_against ?? 0) > 0,
  );
  return { corners, shots };
}

/** Construye la predicción de un fixture concreto a partir de datos ya cargados. */
function buildPrediction(
  fx: FixtureRow,
  teams: Map<number, MatchTeam>,
  stats: Map<number, TeamStatsRow>,
  league: LeagueAverages,
  include: { corners: boolean; shots: boolean },
): MatchPrediction {
  const home =
    teams.get(fx.home_team_id) ?? unknownTeam(fx.home_team_id);
  const away =
    teams.get(fx.away_team_id) ?? unknownTeam(fx.away_team_id);

  const prediction = predictMatch({
    home: strengthFromStats(stats.get(fx.home_team_id), league),
    away: strengthFromStats(stats.get(fx.away_team_id), league),
    league,
    include,
    homeAdvantage: homeAdvantageFor(home.name),
  });

  return { fixtureId: fx.id, kickoff: fx.kickoff, home, away, prediction };
}

function unknownTeam(id: number): MatchTeam {
  return { id, name: `Equipo ${id}` };
}

/** Rango UTC [date, date+1) para filtrar partidos de un día. */
function dayRange(date: string): { start: string; end: string } {
  const start = `${date}T00:00:00.000Z`;
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: next.toISOString() };
}

/** Predicción de un único partido por id. */
export async function getFixturePrediction(
  fixtureId: number,
): Promise<MatchPrediction | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("fixtures")
    .select("id, kickoff, home_team_id, away_team_id")
    .eq("id", fixtureId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const fx = data as FixtureRow;
  const teams = await loadTeams([fx.home_team_id, fx.away_team_id]);
  const { rows, byTeam } = await loadStats();
  const league = leagueAveragesFromStats(rows);
  return buildPrediction(fx, teams, byTeam, league, availableMarkets(rows));
}

/**
 * Analiza TODOS los partidos de un día. Devuelve cada uno con su mercado más
 * probable, ordenados de mayor a menor confianza, más bestBetOfDay.
 */
export async function getDayPredictions(date: string): Promise<DayResponse> {
  const db = supabaseAdmin();
  const { start, end } = dayRange(date);

  const { data: fxData, error } = await db
    .from("fixtures")
    .select("id, kickoff, home_team_id, away_team_id")
    .eq("league_id", MUNDIAL.leagueId)
    .eq("season", MUNDIAL.season)
    .gte("kickoff", start)
    .lt("kickoff", end)
    .order("kickoff", { ascending: true });
  if (error) throw error;

  const fixtures = (fxData ?? []) as FixtureRow[];

  if (fixtures.length === 0) {
    return { date, matches: [], bestBetOfDay: null, disclaimer: MODEL_DISCLAIMER };
  }

  const teamIds = [
    ...new Set(fixtures.flatMap((f) => [f.home_team_id, f.away_team_id])),
  ];
  const teams = await loadTeams(teamIds);
  const { rows, byTeam } = await loadStats();
  const league = leagueAveragesFromStats(rows);
  const include = availableMarkets(rows);

  const matches = fixtures
    .map((fx) => buildPrediction(fx, teams, byTeam, league, include))
    // Mayor a menor confianza según la probabilidad del mercado destacado.
    .sort((a, b) => b.prediction.top.prob - a.prediction.top.prob);

  return {
    date,
    matches,
    bestBetOfDay: matches[0] ?? null,
    disclaimer: MODEL_DISCLAIMER,
  };
}
