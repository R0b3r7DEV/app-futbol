// =============================================================================
// Capa de predicción: lee Supabase, construye fuerzas y aplica el modelo.
// =============================================================================
// La usan los endpoints /api/predict y /api/predict/day. Mantiene una sola
// fuente de verdad para transformar filas de la BD en MatchPrediction.
// =============================================================================

import { supabaseAdmin } from "./supabase";
import { MUNDIAL } from "./env";
import { predictMatch } from "./poissonModel";
import { adjustStrength, adjustmentFor, mergeAdjustments } from "./adjustments";
import { lineupAdjustmentFor } from "./lineups";
import { appDayRangeUtc } from "./time";
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
  type ModelAccuracy,
  type EvaluatedMatch,
} from "./types";

/** Fila de fixtures que necesitamos. */
interface FixtureRow {
  id: number;
  kickoff: string;
  status: string;
  home_team_id: number;
  away_team_id: number;
  home_goals: number | null;
  away_goals: number | null;
}

/** Columnas de fixtures a pedir. */
const FIXTURE_COLS =
  "id, kickoff, status, home_team_id, away_team_id, home_goals, away_goals";

/**
 * Anfitriones del Mundial 2026: solo ellos juegan realmente en casa. El resto
 * de partidos son en campo neutral, así que no se les aplica ventaja de campo
 * (aplicarla a todos sesgaría las predicciones). Nombres como en teams.name.
 */
const HOST_TEAMS = new Set(["usa", "united states", "canada", "mexico"]);

/**
 * Ventaja para el anfitrión jugando en casa (1.0 = neutral). Un Mundial en casa
 * pesa más que una ventaja de campo normal: afición, morale, sin viaje. Por eso
 * va alta (≈+35% sobre el lambda del local anfitrión).
 */
const HOST_ADVANTAGE = 1.35;
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

/**
 * Quita un partido de los agregados de un equipo (leave-one-out). Sirve para,
 * en un partido YA JUGADO, predecirlo como lo habría hecho el modelo ANTES (sin
 * que su propio resultado contamine la fuerza del equipo).
 */
function withoutMatch(
  row: TeamStatsRow | undefined,
  goalsFor: number,
  goalsAgainst: number,
): TeamStatsRow | undefined {
  if (!row) return row;
  const mp = row.matches_played;
  if (mp <= 1) {
    // Era su único partido: vuelve a "sin datos" (manda el seeding/Elo).
    return {
      ...row,
      matches_played: 0,
      avg_goals_for: 0,
      avg_goals_against: 0,
      avg_corners_for: 0,
      avg_corners_against: 0,
      avg_shots_for: 0,
      avg_shots_against: 0,
    };
  }
  const nmp = mp - 1;
  const rem = (avg: number, sub: number) => Math.max(0, avg * mp - sub) / nmp;
  return {
    ...row,
    matches_played: nmp,
    avg_goals_for: rem(row.avg_goals_for, goalsFor),
    avg_goals_against: rem(row.avg_goals_against, goalsAgainst),
  };
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

  // Ajustes por disponibilidad: a largo plazo (por selección) + por alineación
  // del día (los 11 titulares de ESE partido). Se combinan.
  const homeAdj = mergeAdjustments(
    adjustmentFor(home.name),
    lineupAdjustmentFor(home.name, fx.kickoff),
  );
  const awayAdj = mergeAdjustments(
    adjustmentFor(away.name),
    lineupAdjustmentFor(away.name, fx.kickoff),
  );

  // En partidos ya jugados, excluimos su propio resultado para reflejar la
  // predicción PRE-partido (lo que el modelo habría dicho antes de jugarse).
  const finished =
    fx.status === "FT" && fx.home_goals != null && fx.away_goals != null;
  let homeStats = stats.get(fx.home_team_id);
  let awayStats = stats.get(fx.away_team_id);
  if (finished) {
    homeStats = withoutMatch(homeStats, fx.home_goals!, fx.away_goals!);
    awayStats = withoutMatch(awayStats, fx.away_goals!, fx.home_goals!);
  }

  const prediction = predictMatch({
    home: adjustStrength(strengthFromStats(homeStats, league), homeAdj),
    away: adjustStrength(strengthFromStats(awayStats, league), awayAdj),
    league,
    include,
    homeAdvantage: homeAdvantageFor(home.name),
  });

  const adjustments =
    homeAdj?.note || awayAdj?.note
      ? { home: homeAdj?.note ?? null, away: awayAdj?.note ?? null }
      : undefined;

  // Resultado real si el partido ya finalizó (FT) y tiene goles.
  const result =
    fx.status === "FT" && fx.home_goals != null && fx.away_goals != null
      ? { homeGoals: fx.home_goals, awayGoals: fx.away_goals }
      : undefined;

  return {
    fixtureId: fx.id,
    kickoff: fx.kickoff,
    home,
    away,
    prediction,
    adjustments,
    result,
  };
}

function unknownTeam(id: number): MatchTeam {
  return { id, name: `Equipo ${id}` };
}


/** Predicción de un único partido por id. */
export async function getFixturePrediction(
  fixtureId: number,
): Promise<MatchPrediction | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("fixtures")
    .select(FIXTURE_COLS)
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

/** Nº máximo de partidos en el detalle de aciertos (para que la lista no crezca sin fin). */
const ACCURACY_RECENT_LIMIT = 25;

/** 1X2 más probable del modelo para un partido. */
function mejor1x2(mp: MatchPrediction): "home" | "draw" | "away" {
  return (["home", "draw", "away"] as const)
    .map((k) => ({
      k,
      prob: mp.prediction.markets.find((m) => m.key === k)?.prob ?? 0,
    }))
    .reduce((a, b) => (b.prob > a.prob ? b : a)).k;
}

/**
 * Aciertos del modelo en el 1X2 sobre TODOS los partidos jugados del torneo,
 * usando la predicción pre-partido (leave-one-out, ya aplicado en buildPrediction).
 * Incluye el detalle de los partidos más recientes (limitado).
 */
export async function getModelAccuracy(): Promise<ModelAccuracy> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("fixtures")
    .select(FIXTURE_COLS)
    .eq("league_id", MUNDIAL.leagueId)
    .eq("season", MUNDIAL.season)
    .eq("status", "FT")
    .not("home_goals", "is", null);
  if (error) throw error;
  const fixtures = (data ?? []) as FixtureRow[];
  if (fixtures.length === 0) return { hits: 0, total: 0, recent: [] };

  const teamIds = [
    ...new Set(fixtures.flatMap((f) => [f.home_team_id, f.away_team_id])),
  ];
  const teams = await loadTeams(teamIds);
  const { rows, byTeam } = await loadStats();
  const league = leagueAveragesFromStats(rows);
  const include = availableMarkets(rows);

  let hits = 0;
  const evaluated: EvaluatedMatch[] = [];
  for (const fx of fixtures) {
    const mp = buildPrediction(fx, teams, byTeam, league, include);
    if (!mp.result) continue;
    const { homeGoals: hg, awayGoals: ag } = mp.result;
    const real = hg > ag ? "home" : hg === ag ? "draw" : "away";
    const predicted = mejor1x2(mp);
    const hit = predicted === real;
    if (hit) hits++;
    evaluated.push({
      kickoff: mp.kickoff,
      home: mp.home.name,
      away: mp.away.name,
      homeGoals: hg,
      awayGoals: ag,
      predicted,
      hit,
    });
  }

  // Más recientes primero, limitado.
  evaluated.sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  return {
    hits,
    total: evaluated.length,
    recent: evaluated.slice(0, ACCURACY_RECENT_LIMIT),
  };
}

/**
 * Analiza TODOS los partidos de un día. Devuelve cada uno con su mercado más
 * probable, ordenados de mayor a menor confianza, más bestBetOfDay.
 */
export async function getDayPredictions(date: string): Promise<DayResponse> {
  const db = supabaseAdmin();
  const { start, end } = appDayRangeUtc(date);

  const { data: fxData, error } = await db
    .from("fixtures")
    .select(FIXTURE_COLS)
    .eq("league_id", MUNDIAL.leagueId)
    .eq("season", MUNDIAL.season)
    .gte("kickoff", start)
    .lt("kickoff", end)
    .order("kickoff", { ascending: true });
  if (error) throw error;

  const fixtures = (fxData ?? []) as FixtureRow[];
  const accuracy = await getModelAccuracy();

  if (fixtures.length === 0) {
    return {
      date,
      matches: [],
      bestBetOfDay: null,
      accuracy,
      disclaimer: MODEL_DISCLAIMER,
    };
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
    accuracy,
    disclaimer: MODEL_DISCLAIMER,
  };
}
