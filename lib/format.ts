// =============================================================================
// Utilidades de formato para la UI (español, zona horaria de España).
// =============================================================================

import type { MarketKey, PredictionResult } from "./types";

// El kickoff se guarda como instante UTC real; lo mostramos en hora de España.
import { APP_TZ } from "./time";
const TZ = APP_TZ;

/** Probabilidad 0..1 → entero de porcentaje (0..100). */
export function pctValue(prob: number): number {
  return Math.round(prob * 100);
}

/** Probabilidad 0..1 → "69%". */
export function pct(prob: number): string {
  return `${pctValue(prob)}%`;
}

/** ISO → hora local "20:00". */
export function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
}

/** Pone en mayúscula la inicial de cada palabra. */
function titularizar(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** "YYYY-MM-DD" → "Jueves, 11 De Junio". */
export function fechaLarga(date: string): string {
  // Anclamos a mediodía UTC para que el día no se desplace por la zona horaria.
  const d = new Date(`${date}T12:00:00.000Z`);
  const texto = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(d);
  return titularizar(texto);
}

/** Número con 2 decimales para los goles esperados ("2.04"). */
export function dec2(n: number): string {
  return n.toFixed(2);
}

/** Cuota justa (1/p) formateada, p. ej. "2,13". */
function cuotaJusta(prob: number): string {
  if (prob <= 0) return "—";
  return (1 / prob).toFixed(2).replace(".", ",");
}

/**
 * Resumen en lenguaje claro de cómo leer los porcentajes 1X2 de un partido.
 * Se genera a partir de las propias probabilidades del modelo.
 */
export function interpretarResultado(
  prediction: PredictionResult,
  homeName: string,
  awayName: string,
): string {
  const p = (k: MarketKey) =>
    prediction.markets.find((m) => m.key === k)?.prob ?? 0;
  const pH = p("home");
  const pD = p("draw");
  const pA = p("away");

  const favWin = Math.max(pH, pA);
  const favTeam = pH >= pA ? homeName : awayName;
  const otherTeam = pH >= pA ? awayName : homeName;
  const otherWin = Math.min(pH, pA);

  // El empate es el resultado más probable.
  if (pD >= favWin) {
    return `El empate es el resultado más probable (${pct(pD)}). Partido muy parejo entre ${homeName} y ${awayName}: lo más sensato es esperar un duelo cerrado.`;
  }
  // Favorito muy claro.
  if (favWin >= 0.6) {
    return `${favTeam} es muy favorito (${pct(favWin)}), lo más probable con diferencia. Aun así, a partido único siempre cabe la sorpresa. Cuota justa ≈ ${cuotaJusta(favWin)}.`;
  }
  // Favorito.
  if (favWin >= 0.5) {
    return `${favTeam} parte como favorito (${pct(favWin)}), pero entre empate y sorpresa suman ${pct(1 - favWin)}: partido encarrilado, no sentenciado. Cuota justa ≈ ${cuotaJusta(favWin)}.`;
  }
  // Ligero favorito / abierto.
  if (favWin >= 0.42) {
    return `${favTeam} llega algo por delante (${pct(favWin)}), pero es un partido abierto: empate ${pct(pD)} y ${otherTeam} ${pct(otherWin)} suman más de la mitad. Cuota justa de ${favTeam} ≈ ${cuotaJusta(favWin)}.`;
  }
  // Muy igualado.
  return `Partido muy igualado, sin favorito claro (${homeName} ${pct(pH)} · empate ${pct(pD)} · ${awayName} ${pct(pA)}). Prácticamente una moneda al aire.`;
}
