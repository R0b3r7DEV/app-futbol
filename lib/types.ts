// =============================================================================
// Tipos base compartidos por toda la app (modelo, API, frontend).
// =============================================================================

/** Identificadores de los mercados que predice el modelo. */
export type MarketKey =
  | "home"          // victoria local (1)
  | "draw"          // empate (X)
  | "away"          // victoria visitante (2)
  | "corners_home"  // el local hace más córners
  | "corners_away"  // el visitante hace más córners
  | "shots_home"    // el local hace más disparos
  | "shots_away";   // el visitante hace más disparos

/** Etiquetas legibles (español) de cada mercado para la UI. */
export const MARKET_LABELS: Record<MarketKey, string> = {
  home: "Victoria local",
  draw: "Empate",
  away: "Victoria visitante",
  corners_home: "Más córners (local)",
  corners_away: "Más córners (visit.)",
  shots_home: "Más disparos (local)",
  shots_away: "Más disparos (visit.)",
};

/**
 * Fuerza de un equipo de cara al modelo. Son multiplicadores relativos a la
 * media de la competición: 1.0 = exactamente la media. Para cada proceso de
 * conteo (goles, córners, disparos) tenemos ataque y defensa.
 */
export interface TeamStrength {
  attackGoals: number;
  defenseGoals: number;
  attackCorners: number;
  defenseCorners: number;
  attackShots: number;
  defenseShots: number;
}

/** Medias de la competición usadas como base del modelo Poisson. */
export interface LeagueAverages {
  goals: number;    // media de goles por equipo y partido
  corners: number;  // media de córners por equipo y partido
  shots: number;    // media de disparos por equipo y partido
}

/** Datos mínimos de un equipo en un enfrentamiento. */
export interface MatchTeam {
  id: number;
  name: string;
  code?: string | null;
  logoUrl?: string | null;
}

/** Entrada del modelo para predecir un partido. */
export interface PredictionInput {
  home: TeamStrength;
  away: TeamStrength;
  league: LeagueAverages;
  /** Factor de ventaja de campo aplicado al lambda del local (≈1.15). */
  homeAdvantage?: number;
  /**
   * Mercados a incluir. Por defecto todos. Si la fuente de datos no tiene
   * córners/disparos (p. ej. openfootball), se desactivan y solo queda 1X2.
   */
  include?: { corners?: boolean; shots?: boolean };
}

/** Probabilidad de un mercado concreto (0..1). */
export interface MarketProbability {
  key: MarketKey;
  label: string;
  prob: number;
}

/** Salida del modelo para un partido. */
export interface PredictionResult {
  /** Goles esperados (lambda) de cada equipo. */
  expected: {
    homeGoals: number;
    awayGoals: number;
    homeCorners: number;
    awayCorners: number;
    homeShots: number;
    awayShots: number;
  };
  /** Probabilidad de cada mercado, sin ordenar. */
  markets: MarketProbability[];
  /** Mercado de mayor probabilidad (la "apuesta más sólida"). */
  top: MarketProbability;
}

/** Un partido con su predicción, tal como lo consume el frontend. */
export interface MatchPrediction {
  fixtureId: number;
  kickoff: string;       // ISO
  home: MatchTeam;
  away: MatchTeam;
  prediction: PredictionResult;
  /** Notas de ajustes manuales aplicados (bajas, etc.), si los hay. */
  adjustments?: { home?: string | null; away?: string | null };
  /** Resultado real si el partido ya se jugó (status FT). */
  result?: { homeGoals: number; awayGoals: number };
}

/** Un partido ya jugado evaluado contra la predicción pre-partido del modelo. */
export interface EvaluatedMatch {
  kickoff: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  predicted: "home" | "draw" | "away"; // 1X2 que daba el modelo como más probable
  hit: boolean;
}

/** Aciertos del modelo en el 1X2 sobre los partidos ya jugados. */
export interface ModelAccuracy {
  hits: number;
  total: number;
  /** Partidos evaluados, más recientes primero (limitado para no crecer sin fin). */
  recent: EvaluatedMatch[];
}

/** Respuesta del endpoint del día. */
export interface DayResponse {
  date: string;                 // YYYY-MM-DD
  matches: MatchPrediction[];   // ordenados de mayor a menor confianza
  bestBetOfDay: MatchPrediction | null;
  /** Acierto global del modelo (todos los partidos FT del torneo). */
  accuracy: ModelAccuracy;
  disclaimer: string;
}

/** Disclaimer estándar incluido en todas las respuestas. */
export const MODEL_DISCLAIMER =
  "Estimaciones de un modelo estadístico. Alta varianza: orientativo, no garantía.";
