"use client";

// =============================================================================
// Dashboard del día — única pantalla de la app.
// =============================================================================
// Muestra los partidos del día seleccionado (por defecto hoy, hora de España) y
// permite navegar a días anteriores/siguientes con el selector. Para arrancar
// con datos de ejemplo (sin backend) pon USE_MOCK = true.
// =============================================================================

import { useEffect, useState } from "react";
import type { DayResponse, ModelAccuracy } from "@/lib/types";
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
function Cabecera({ accuracy }: { accuracy?: ModelAccuracy }) {
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

/** Pill con el % de aciertos 1X2; al tocarlo despliega el detalle por partido. */
function BadgeAciertos({ accuracy }: { accuracy?: ModelAccuracy }) {
  const [abierto, setAbierto] = useState(false);
  if (!accuracy || accuracy.total === 0) return null;
  const p = Math.round((accuracy.hits / accuracy.total) * 100);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-baseline gap-1.5 rounded-full bg-accent px-3 py-1.5 font-bold text-[#04130c] shadow-lg shadow-black/40 transition-transform hover:scale-[1.03]"
      >
        <span className="text-sm leading-none">{p}%</span>
        <span className="text-[11px] font-semibold opacity-80">
          {accuracy.hits}/{accuracy.total}
        </span>
      </button>

      {abierto && (
        <>
          {/* Capa para cerrar al tocar fuera. */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute right-0 z-30 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-accent/30 bg-[#0a1714] p-2 shadow-2xl shadow-black/70 ring-1 ring-black/40">
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              Aciertos del modelo · {accuracy.hits}/{accuracy.total} ({p}%)
            </p>
            <ul className="flex flex-col">
              {accuracy.recent.map((m, i) => {
                const eti =
                  m.predicted === "home"
                    ? m.home
                    : m.predicted === "away"
                      ? m.away
                      : "Empate";
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/5"
                  >
                    <span
                      className={`shrink-0 text-sm font-bold ${m.hit ? "text-accent" : "text-red-400"}`}
                    >
                      {m.hit ? "✓" : "✗"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-text">
                      {m.home} <span className="font-semibold">{m.homeGoals}-{m.awayGoals}</span> {m.away}
                    </span>
                    <span className="shrink-0 text-muted">{eti}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
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
