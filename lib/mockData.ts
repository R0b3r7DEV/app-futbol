// =============================================================================
// Datos de ejemplo para arrancar el frontend sin backend.
// =============================================================================
// Replican el diseño de referencia (preview_mobile.png). El dashboard usa estos
// datos cuando USE_MOCK = true en app/page.tsx; cambiando esa línea consume el
// endpoint real /api/predict/day.
// =============================================================================

import {
  MARKET_LABELS,
  MODEL_DISCLAIMER,
  type DayResponse,
  type MatchPrediction,
} from "./types";

/** Construye el array de mercados a partir de probabilidades sueltas. */
function markets(p: {
  home: number;
  draw: number;
  away: number;
  ch: number;
  ca: number;
  sh: number;
  sa: number;
}) {
  return [
    { key: "home" as const, label: MARKET_LABELS.home, prob: p.home },
    { key: "draw" as const, label: MARKET_LABELS.draw, prob: p.draw },
    { key: "away" as const, label: MARKET_LABELS.away, prob: p.away },
    { key: "corners_home" as const, label: MARKET_LABELS.corners_home, prob: p.ch },
    { key: "corners_away" as const, label: MARKET_LABELS.corners_away, prob: p.ca },
    { key: "shots_home" as const, label: MARKET_LABELS.shots_home, prob: p.sh },
    { key: "shots_away" as const, label: MARKET_LABELS.shots_away, prob: p.sa },
  ];
}

const mexSud = markets({
  home: 0.62,
  draw: 0.21,
  away: 0.17,
  ch: 0.69,
  ca: 0.13,
  sh: 0.58,
  sa: 0.21,
});

const korChe = markets({
  home: 0.52,
  draw: 0.27,
  away: 0.21,
  ch: 0.41,
  ca: 0.34,
  sh: 0.49,
  sa: 0.33,
});

const MOCK_MATCHES: MatchPrediction[] = [
  {
    fixtureId: 1,
    kickoff: "2026-06-11T18:00:00.000Z", // 20:00 en España (CEST)
    home: { id: 101, name: "México" },
    away: { id: 102, name: "Sudáfrica" },
    prediction: {
      expected: {
        homeGoals: 2.04,
        awayGoals: 0.97,
        homeCorners: 6.1,
        awayCorners: 3.8,
        homeShots: 14.2,
        awayShots: 9.1,
      },
      markets: mexSud,
      top: mexSud[3], // Más córners (local) 69%
    },
  },
  {
    fixtureId: 2,
    kickoff: "2026-06-11T21:00:00.000Z", // 23:00 en España (CEST)
    home: { id: 103, name: "Corea del Sur" },
    away: { id: 104, name: "Chequia" },
    prediction: {
      expected: {
        homeGoals: 1.48,
        awayGoals: 1.16,
        homeCorners: 5.2,
        awayCorners: 4.6,
        homeShots: 12.8,
        awayShots: 10.7,
      },
      markets: korChe,
      top: korChe[0], // Victoria local 52%
    },
  },
];

export const MOCK_DAY: DayResponse = {
  date: "2026-06-11",
  matches: MOCK_MATCHES,
  bestBetOfDay: MOCK_MATCHES[0],
  accuracy: { hits: 0, total: 0, recent: [] },
  disclaimer: MODEL_DISCLAIMER,
};
