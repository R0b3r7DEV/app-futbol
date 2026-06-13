"use client";

// =============================================================================
// Tarjeta de partido. Colapsada muestra hora, enfrentamiento y la mayor
// probabilidad en grande. Al tocarla se despliega el desglose completo.
// =============================================================================

import { useState } from "react";
import { MARKET_LABELS, type MarketKey, type MatchPrediction } from "@/lib/types";
import { hora, pct, interpretarResultado } from "@/lib/format";
import { MarketBars } from "./MarketBars";

interface Props {
  match: MatchPrediction;
  /** La "apuesta más sólida del día": borde verde y desplegada por defecto. */
  destacada?: boolean;
}

/** Para un partido finalizado: marcador, si el modelo acertó el 1X2 y su pronóstico. */
function analisisResultado(match: MatchPrediction) {
  if (!match.result) return null;
  const { homeGoals: hg, awayGoals: ag } = match.result;
  const real: MarketKey = hg > ag ? "home" : hg === ag ? "draw" : "away";
  const mejor = (["home", "draw", "away"] as const)
    .map((k) => ({ k, prob: match.prediction.markets.find((m) => m.key === k)?.prob ?? 0 }))
    .reduce((a, b) => (b.prob > a.prob ? b : a));
  return { hg, ag, acierto: real === mejor.k, modeloLabel: MARKET_LABELS[mejor.k] };
}

export function MatchCard({ match, destacada = false }: Props) {
  const [abierta, setAbierta] = useState(destacada);
  const { home, away, prediction } = match;
  const { top } = prediction;
  const res = analisisResultado(match);

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
          {res ? (
            <>
              <p className="font-heading text-3xl font-bold text-text">
                {res.hg}
                <span className="px-1.5 text-muted">–</span>
                {res.ag}
              </p>
              <p className="text-sm text-muted">Final</p>
            </>
          ) : (
            <>
              <p className="font-heading text-3xl font-bold text-accent">
                {pct(top.prob)}
              </p>
              <p className="text-sm text-muted">{top.label}</p>
            </>
          )}
        </div>
      </button>

      {abierta && (
        <div className="mt-5 border-t border-border pt-5">
          {res && (
            <p className="mb-4 rounded-xl bg-surface-2/60 p-3 text-xs leading-relaxed">
              <span className="font-semibold text-text">
                Resultado final: {res.hg}–{res.ag}.
              </span>{" "}
              <span className="text-muted">Pronóstico del modelo: {res.modeloLabel}</span>{" "}
              <span className={res.acierto ? "font-semibold text-accent" : "font-semibold text-red-400"}>
                {res.acierto ? "✓ acertado" : "✗ fallado"}
              </span>
            </p>
          )}
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
