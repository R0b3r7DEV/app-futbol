// =============================================================================
// Tests del motor Poisson. Verificación obligatoria: 1X2 suma ~100%.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  poissonPmf,
  compareCounts,
  predictMatch,
  expectedCount,
  DEFAULT_RHO,
} from "./poissonModel";
import type { PredictionInput, TeamStrength } from "./types";

/** Equipo "medio" (todos los multiplicadores a 1.0). */
const mediaTeam: TeamStrength = {
  attackGoals: 1,
  defenseGoals: 1,
  attackCorners: 1,
  defenseCorners: 1,
  attackShots: 1,
  defenseShots: 1,
};

const liga = { goals: 1.4, corners: 5, shots: 12 };

describe("poissonPmf", () => {
  it("la distribución suma ~1 sobre un rango amplio (lambda=2.3)", () => {
    let total = 0;
    for (let k = 0; k <= 30; k++) total += poissonPmf(k, 2.3);
    expect(total).toBeCloseTo(1, 5);
  });

  it("P(X=0) con lambda=0 es 1", () => {
    expect(poissonPmf(0, 0)).toBe(1);
  });

  it("coincide con el valor analítico conocido P(X=2|λ=2)=0.2707", () => {
    expect(poissonPmf(2, 2)).toBeCloseTo(0.27067, 4);
  });
});

describe("compareCounts", () => {
  it("home + draw + away suma exactamente 1", () => {
    const r = compareCounts(1.6, 1.2);
    expect(r.home + r.draw + r.away).toBeCloseTo(1, 6);
  });

  it("dos lambdas iguales dan probabilidades simétricas (home == away)", () => {
    const r = compareCounts(1.4, 1.4);
    expect(r.home).toBeCloseTo(r.away, 6);
  });

  it("un lambda mayor implica mayor probabilidad de ganar", () => {
    const r = compareCounts(2.5, 0.8);
    expect(r.home).toBeGreaterThan(r.away);
  });

  it("con Dixon-Coles (rho<0) sigue sumando 1", () => {
    const r = compareCounts(1.5, 1.3, DEFAULT_RHO);
    expect(r.home + r.draw + r.away).toBeCloseTo(1, 6);
  });

  it("Dixon-Coles (rho<0) aumenta la probabilidad de empate", () => {
    const sin = compareCounts(1.3, 1.3);
    const con = compareCounts(1.3, 1.3, DEFAULT_RHO);
    expect(con.draw).toBeGreaterThan(sin.draw);
  });
});

describe("expectedCount", () => {
  it("equipos medios producen la media de la liga", () => {
    expect(expectedCount(1, 1, 1.4)).toBeCloseTo(1.4, 6);
  });
});

describe("predictMatch — verificación obligatoria", () => {
  const input: PredictionInput = {
    home: mediaTeam,
    away: mediaTeam,
    league: liga,
  };

  it("las probabilidades de 1X2 suman ~100%", () => {
    const { markets } = predictMatch(input);
    const home = markets.find((m) => m.key === "home")!.prob;
    const draw = markets.find((m) => m.key === "draw")!.prob;
    const away = markets.find((m) => m.key === "away")!.prob;
    expect(home + draw + away).toBeCloseTo(1, 6);
  });

  it("córners y disparos: 'más local' + 'más visit.' < 1 (queda hueco del empate)", () => {
    const { markets } = predictMatch(input);
    const ch = markets.find((m) => m.key === "corners_home")!.prob;
    const ca = markets.find((m) => m.key === "corners_away")!.prob;
    const sh = markets.find((m) => m.key === "shots_home")!.prob;
    const sa = markets.find((m) => m.key === "shots_away")!.prob;
    // No incluimos el empate exacto como mercado, así que la suma deja un hueco.
    expect(ch + ca).toBeGreaterThan(0);
    expect(ch + ca).toBeLessThan(1);
    expect(sh + sa).toBeGreaterThan(0);
    expect(sh + sa).toBeLessThan(1);
  });

  it("la ventaja de campo hace al local favorito entre dos equipos iguales", () => {
    const { markets } = predictMatch(input);
    const home = markets.find((m) => m.key === "home")!.prob;
    const away = markets.find((m) => m.key === "away")!.prob;
    expect(home).toBeGreaterThan(away);
  });

  it("selecciona como 'top' el mercado de mayor probabilidad", () => {
    const { markets, top } = predictMatch(input);
    const maxProb = Math.max(...markets.map((m) => m.prob));
    expect(top.prob).toBeCloseTo(maxProb, 10);
  });

  it("todas las probabilidades están en [0,1]", () => {
    const { markets } = predictMatch(input);
    for (const m of markets) {
      expect(m.prob).toBeGreaterThanOrEqual(0);
      expect(m.prob).toBeLessThanOrEqual(1);
    }
  });
});
