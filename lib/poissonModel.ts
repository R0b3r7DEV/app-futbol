// =============================================================================
// Motor predictivo: Poisson ajustado (núcleo del proyecto).
// =============================================================================
// Cada equipo tiene una fuerza de ataque y defensa relativas a la media de la
// competición. Los goles esperados (lambda) salen de combinarlas con la media
// de la liga. Con dos Poisson independientes construimos la matriz de marcadores
// y de ahí derivamos 1X2. El mismo procedimiento se aplica a córners y disparos.
// =============================================================================

import {
  MARKET_LABELS,
  type MarketKey,
  type MarketProbability,
  type PredictionInput,
  type PredictionResult,
} from "./types";

/** Ventaja de campo por defecto aplicada al lambda del equipo local. */
export const DEFAULT_HOME_ADVANTAGE = 1.15;

/** Truncado de la matriz de marcadores (goles 0..MAX_GOALS por equipo). */
const MAX_GOALS = 10;

/** Identificador de versión del modelo (para cachear predicciones). */
export const MODEL_VERSION = "poisson-v1";

/**
 * Función de masa de probabilidad de Poisson: P(X=k) = (λ^k · e^-λ) / k!
 * Calculada en escala logarítmica para evitar overflow de λ^k y de k!.
 */
export function poissonPmf(k: number, lambda: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // ln P = k·ln(λ) − λ − ln(k!)
  const logP = k * Math.log(lambda) - lambda - logFactorial(k);
  return Math.exp(logP);
}

/** ln(k!) mediante suma de logaritmos (suficiente para k pequeños). */
function logFactorial(k: number): number {
  let acc = 0;
  for (let i = 2; i <= k; i++) acc += Math.log(i);
  return acc;
}

/**
 * Lambda (valor esperado) de un proceso de conteo para un equipo, según la
 * especificación del proyecto:
 *
 *   fuerza_ataque  = media_a_favor_equipo  / media_competición
 *   fuerza_defensa = media_en_contra_rival / media_competición
 *   lambda         = fuerza_ataque · fuerza_defensa · media_competición
 *
 * Aquí `attack` y `defense` ya llegan normalizados (multiplicadores ~1.0),
 * por lo que: lambda = attack · defenseRival · mediaCompetición.
 */
export function expectedCount(
  attack: number,
  defenseRival: number,
  leagueAverage: number,
): number {
  return attack * defenseRival * leagueAverage;
}

/**
 * Corrección de dependencia de Dixon-Coles para marcadores bajos. El Poisson
 * independiente infravalora los empates de pocos goles (0-0, 1-1) y sobrevalora
 * 1-0/0-1. Con rho<0 se ajustan esas cuatro celdas. Devuelve el factor τ.
 */
function dixonColesTau(
  h: number,
  a: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (h === 0 && a === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (h === 0 && a === 1) return 1 + lambdaHome * rho;
  if (h === 1 && a === 0) return 1 + lambdaAway * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

/** Valor por defecto de rho (Dixon-Coles). Negativo ⇒ más empates de pocos goles. */
export const DEFAULT_RHO = -0.1;

/**
 * Dadas las lambdas de dos equipos en un proceso de conteo, devuelve la
 * probabilidad de que el "local" tenga más, empate, o el "visitante" tenga más.
 * Se construye la matriz producto de dos Poisson truncada a MAX_GOALS. Con
 * `rho` ≠ 0 se aplica la corrección de Dixon-Coles (solo tiene sentido para
 * goles; córners/disparos usan rho=0).
 */
export function compareCounts(
  lambdaHome: number,
  lambdaAway: number,
  rho = 0,
): { home: number; draw: number; away: number } {
  const homePmf = pmfVector(lambdaHome);
  const awayPmf = pmfVector(lambdaAway);

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      let p = homePmf[h] * awayPmf[a];
      if (rho !== 0) {
        p *= dixonColesTau(h, a, lambdaHome, lambdaAway, rho);
        if (p < 0) p = 0; // τ no debería negativizar con rho pequeño; por seguridad
      }
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }

  // Renormalizamos: el truncado a MAX_GOALS pierde una fracción ínfima de masa.
  const total = pHome + pDraw + pAway;
  return { home: pHome / total, draw: pDraw / total, away: pAway / total };
}

/** Vector [P(X=0), …, P(X=MAX_GOALS)] para un lambda dado. */
function pmfVector(lambda: number): number[] {
  const v: number[] = new Array(MAX_GOALS + 1);
  for (let k = 0; k <= MAX_GOALS; k++) v[k] = poissonPmf(k, lambda);
  return v;
}

/**
 * Predice todos los mercados de un partido y selecciona el más probable.
 */
export function predictMatch(input: PredictionInput): PredictionResult {
  const { home, away, league } = input;
  const homeAdv = input.homeAdvantage ?? DEFAULT_HOME_ADVANTAGE;

  // --- Goles: aplicamos ventaja de campo al lambda del local ---
  const homeGoals =
    expectedCount(home.attackGoals, away.defenseGoals, league.goals) * homeAdv;
  const awayGoals = expectedCount(
    away.attackGoals,
    home.defenseGoals,
    league.goals,
  );

  // --- Córners ---
  const homeCorners =
    expectedCount(home.attackCorners, away.defenseCorners, league.corners) *
    homeAdv;
  const awayCorners = expectedCount(
    away.attackCorners,
    home.defenseCorners,
    league.corners,
  );

  // --- Disparos ---
  const homeShots =
    expectedCount(home.attackShots, away.defenseShots, league.shots) * homeAdv;
  const awayShots = expectedCount(
    away.attackShots,
    home.defenseShots,
    league.shots,
  );

  const incCorners = input.include?.corners ?? true;
  const incShots = input.include?.shots ?? true;

  // --- 1X2 a partir de la matriz de goles (con corrección Dixon-Coles) ---
  const result1x2 = compareCounts(homeGoals, awayGoals, DEFAULT_RHO);

  const markets: MarketProbability[] = [
    market("home", result1x2.home),
    market("draw", result1x2.draw),
    market("away", result1x2.away),
  ];

  // --- Córners: solo nos interesa quién hace más (sin "empate" como mercado) ---
  if (incCorners) {
    const cornersCmp = compareCounts(homeCorners, awayCorners);
    markets.push(market("corners_home", cornersCmp.home));
    markets.push(market("corners_away", cornersCmp.away));
  }

  // --- Disparos ---
  if (incShots) {
    const shotsCmp = compareCounts(homeShots, awayShots);
    markets.push(market("shots_home", shotsCmp.home));
    markets.push(market("shots_away", shotsCmp.away));
  }

  // Mercado de mayor probabilidad: la "apuesta más sólida".
  const top = markets.reduce((best, m) => (m.prob > best.prob ? m : best));

  return {
    expected: {
      homeGoals,
      awayGoals,
      homeCorners,
      awayCorners,
      homeShots,
      awayShots,
    },
    markets,
    top,
  };
}

/** Helper para construir un MarketProbability con su etiqueta. */
function market(key: MarketKey, prob: number): MarketProbability {
  return { key, label: MARKET_LABELS[key], prob };
}
