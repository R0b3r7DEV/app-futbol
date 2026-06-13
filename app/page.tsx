"use client";

// =============================================================================
// Dashboard del día — única pantalla de la app.
// =============================================================================
// Muestra los partidos del día seleccionado (por defecto hoy, hora de España) y
// permite navegar a días anteriores/siguientes con el selector. Para arrancar
// con datos de ejemplo (sin backend) pon USE_MOCK = true.
// =============================================================================

import { useEffect, useState } from "react";
import type { DayResponse } from "@/lib/types";
import { MOCK_DAY } from "@/lib/mockData";
import { fechaLarga } from "@/lib/format";
import { appToday, addDays, dayDiff } from "@/lib/time";
import { MatchCard } from "@/components/MatchCard";

/** ← Cambia a true para volver a los datos de ejemplo (sin backend). */
const USE_MOCK = false;

export default function Page() {
  const [hoy] = useState(() => appToday());
  const [date, setDate] = useState<string>(() => (USE_MOCK ? MOCK_DAY.date : hoy));
  const [data, setData] = useState<DayResponse | null>(USE_MOCK ? MOCK_DAY : null);
  const [cargando, setCargando] = useState(!USE_MOCK);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MOCK) return;
    let activo = true;
    setCargando(true);
    setError(null);
    fetch(`/api/predict/day?date=${date}`)
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
  }, [date]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
      <Cabecera accuracy={data?.accuracy} />

      <SelectorDia
        date={date}
        hoy={hoy}
        onPrev={() => setDate((d) => addDays(d, -1))}
        onNext={() => setDate((d) => addDays(d, 1))}
        onHoy={() => setDate(hoy)}
      />

      <section className="mt-6 flex flex-1 flex-col gap-4">
        {cargando && <Cargando />}
        {!cargando && error && <Mensaje texto={error} />}
        {!cargando && !error && data && data.matches.length === 0 && (
          <Mensaje texto="No hay partidos este día. Prueba otro ⚽" />
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

/** Cabecera con eyebrow, título y el badge de aciertos del modelo. */
function Cabecera({ accuracy }: { accuracy?: { hits: number; total: number } }) {
  return (
    <header>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Copa del Mundo 2026
        </p>
        <BadgeAciertos accuracy={accuracy} />
      </div>
      <h1 className="mt-1 font-heading text-4xl font-bold leading-none text-text">
        Predicciones
      </h1>
    </header>
  );
}

/** Pill con el % de aciertos 1X2 del modelo en los partidos jugados. */
function BadgeAciertos({
  accuracy,
}: {
  accuracy?: { hits: number; total: number };
}) {
  if (!accuracy || accuracy.total === 0) return null;
  const p = Math.round((accuracy.hits / accuracy.total) * 100);
  return (
    <div className="shrink-0 rounded-full border border-accent/40 bg-surface/70 px-3 py-1.5 text-center">
      <p className="text-base font-bold leading-none text-accent">{p}%</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
        {accuracy.hits}/{accuracy.total} aciertos
      </p>
    </div>
  );
}

/** Etiqueta relativa del día (Hoy/Mañana/…) o null si está lejos. */
function etiquetaRelativa(date: string, hoy: string): string | null {
  switch (dayDiff(date, hoy)) {
    case 0:
      return "Hoy";
    case 1:
      return "Mañana";
    case 2:
      return "Pasado mañana";
    case -1:
      return "Ayer";
    default:
      return null;
  }
}

/** Selector de día: flechas ‹ ›, etiqueta y atajo a "Hoy". */
function SelectorDia({
  date,
  hoy,
  onPrev,
  onNext,
  onHoy,
}: {
  date: string;
  hoy: string;
  onPrev: () => void;
  onNext: () => void;
  onHoy: () => void;
}) {
  const rel = etiquetaRelativa(date, hoy);
  const esHoy = date === hoy;

  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <FlechaDia dir="prev" onClick={onPrev} />

      <button
        type="button"
        onClick={onHoy}
        disabled={esHoy}
        className="flex-1 text-center disabled:cursor-default"
        title={esHoy ? undefined : "Volver a hoy"}
      >
        <span className="block font-heading text-lg font-semibold leading-tight text-text">
          {rel ?? fechaLarga(date)}
        </span>
        <span className="block text-xs text-muted">
          {rel ? fechaLarga(date) : "Toca las flechas para cambiar de día"}
        </span>
      </button>

      <FlechaDia dir="next" onClick={onNext} />
    </div>
  );
}

function FlechaDia({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Día anterior" : "Día siguiente"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/70 text-xl text-text transition-colors hover:border-accent/60 hover:text-accent"
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
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
