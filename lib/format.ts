// =============================================================================
// Utilidades de formato para la UI (español, zona horaria de España).
// =============================================================================

/**
 * Zona de formato. Usamos UTC porque guardamos el kickoff con la hora LOCAL de
 * la sede anclada al día oficial (ver lib/openFootball.parseKickoff): así la
 * hora mostrada es la local de la sede y el día cuadra con el calendario oficial.
 */
const TZ = "UTC";

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
