"use client";

// =============================================================================
// Dashboard del día — única pantalla de la app.
// =============================================================================
// Por defecto arranca con datos de ejemplo (MOCK_DAY). Para consumir el endpoint
// real cambia USE_MOCK a false: pedirá GET /api/predict/day.
// =============================================================================

import { useEffect, useState } from "react";
import type { DayResponse } from "@/lib/types";
import { MOCK_DAY } from "@/lib/mockData";
import { fechaLarga } from "@/lib/format";
import { MatchCard } from "@/components/MatchCard";

/** ← Cambia a false para consumir el endpoint real en lugar de los datos mock. */
const USE_MOCK = true;

export default function Page() {
  const [data, setData] = useState<DayResponse | null>(USE_MOCK ? MOCK_DAY : null);
  const [cargando, setCargando] = useState(!USE_MOCK);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MOCK) return;
    let activo = true;
    fetch("/api/predict/day")
      .then((r) => r.json())
      .then((json: DayResponse & { error?: string }) => {
        if (!activo) return;
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => activo && setError("No se pudo cargar el día."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
      <Cabecera fecha={data?.date} />

      <section className="mt-6 flex flex-1 flex-col gap-4">
        {cargando && <Cargando />}
        {!cargando && error && <Mensaje texto={error} />}
        {!cargando && !error && data && data.matches.length === 0 && (
          <Mensaje texto="No hay partidos hoy. Vuelve mañana ⚽" />
        )}
        {!cargando && !error && data && data.matches.length > 0 && (
          <Partidos data={data} />
        )}
      </section>

      <footer className="mt-10 text-center text-xs leading-relaxed text-muted">
        {data?.disclaimer ??
          "Estimaciones de un modelo estadístico. Alta varianza: orientativo, no garantía."}
      </footer>
    </main>
  );
}

/** Cabecera con eyebrow, título y fecha. */
function Cabecera({ fecha }: { fecha?: string }) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
        Copa del Mundo 2026
      </p>
      <h1 className="mt-1 font-heading text-4xl font-bold leading-none text-text">
        Predicciones de hoy
      </h1>
      {fecha && <p className="mt-2 text-sm text-muted">{fechaLarga(fecha)}</p>}
    </header>
  );
}

/** Renderiza la apuesta más sólida destacada + el resto de partidos. */
function Partidos({ data }: { data: DayResponse }) {
  const best = data.bestBetOfDay ?? data.matches[0];
  const resto = data.matches.filter((m) => m.fixtureId !== best.fixtureId);

  return (
    <>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent/80">
          ★ Apuesta más sólida del día
        </p>
        <MatchCard match={best} destacada />
      </div>
      {resto.map((m) => (
        <MatchCard key={m.fixtureId} match={m} />
      ))}
    </>
  );
}

function Cargando() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-border bg-surface/60"
        />
      ))}
    </div>
  );
}

function Mensaje({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center text-muted">
      {texto}
    </div>
  );
}
