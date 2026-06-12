// =============================================================================
// Desglose de mercados: una barra de progreso por mercado. La del mercado más
// probable (top) se resalta en verde.
// =============================================================================

import type { PredictionResult } from "@/lib/types";
import { dec2, pct, pctValue } from "@/lib/format";

export function MarketBars({ prediction }: { prediction: PredictionResult }) {
  const { expected, markets, top } = prediction;

  return (
    <div className="animar-despliegue">
      {/* Goles esperados */}
      <p className="mb-4 text-sm text-muted">
        Goles esperados:{" "}
        <span className="font-semibold text-text">
          {dec2(expected.homeGoals)} – {dec2(expected.awayGoals)}
        </span>
      </p>

      <ul className="flex flex-col gap-3">
        {markets.map((m) => {
          const destacado = m.key === top.key;
          return (
            <li key={m.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
              <span className="text-sm leading-tight text-muted">{m.label}</span>

              <div className="h-2 overflow-hidden rounded-full bg-bar-track">
                <div
                  className={`h-full rounded-full ${
                    destacado ? "bg-accent" : "bg-bar"
                  }`}
                  style={{ width: `${pctValue(m.prob)}%` }}
                />
              </div>

              <span
                className={`text-right text-sm font-bold ${
                  destacado ? "text-accent" : "text-text"
                }`}
              >
                {pct(m.prob)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
