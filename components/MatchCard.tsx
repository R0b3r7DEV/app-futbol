"use client";

// =============================================================================
// Tarjeta de partido. Colapsada muestra hora, enfrentamiento y la mayor
// probabilidad en grande. Al tocarla se despliega el desglose completo.
// =============================================================================

import { useState } from "react";
import type { MatchPrediction } from "@/lib/types";
import { hora, pct, interpretarResultado } from "@/lib/format";
import { MarketBars } from "./MarketBars";

interface Props {
  match: MatchPrediction;
  /** La "apuesta más sólida del día": borde verde y desplegada por defecto. */
  destacada?: boolean;
}

export function MatchCard({ match, destacada = false }: Props) {
  const [abierta, setAbierta] = useState(destacada);
  const { home, away, prediction } = match;
  const { top } = prediction;

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors ${
        destacada
          ? "border-accent/60 bg-surface shadow-[0_0_0_1px_rgba(52,211,153,0.15)]"
          : "border-border bg-surface/70"
      }`}
    >
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm text-muted">{hora(match.kickoff)}</p>
          <h3 className="font-heading text-xl font-semibold leading-tight text-text">
            {home.name} <span className="text-muted">vs</span> {away.name}
          </h3>
          {match.adjustments?.home && (
            <p className="mt-1 text-xs text-amber-400/90">
              ⚠ {home.name}: {match.adjustments.home}
            </p>
          )}
          {match.adjustments?.away && (
            <p className="mt-1 text-xs text-amber-400/90">
              ⚠ {away.name}: {match.adjustments.away}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-heading text-3xl font-bold text-accent">
            {pct(top.prob)}
          </p>
          <p className="text-sm text-muted">{top.label}</p>
        </div>
      </button>

      {abierta && (
        <div className="mt-5 border-t border-border pt-5">
          <MarketBars prediction={prediction} />
          <p className="mt-4 rounded-xl bg-surface-2/60 p-3 text-xs leading-relaxed text-muted">
            <span className="mr-1 font-semibold text-accent/90">Cómo leerlo:</span>
            {interpretarResultado(prediction, home.name, away.name)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="mt-4 w-full text-center text-sm text-muted transition-colors hover:text-text"
      >
        {abierta ? "▲ ocultar" : "▼ ver desglose"}
      </button>
    </article>
  );
}
