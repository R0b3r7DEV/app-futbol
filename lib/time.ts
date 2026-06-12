// =============================================================================
// Utilidades de zona horaria. Toda la app razona en hora de España peninsular.
// =============================================================================

/** Zona horaria de referencia (usuario en España). */
export const APP_TZ = "Europe/Madrid";

/**
 * Offset (en minutos) de una zona en un instante dado: hora_local − UTC.
 * Para Madrid: +60 en invierno, +120 en verano (DST). Se calcula con Intl, así
 * que el cambio de hora se respeta automáticamente.
 */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second,
  );
  return (asUTC - instant.getTime()) / 60000;
}

/** Instante UTC correspondiente a la medianoche (00:00) de `dateStr` en España. */
function appMidnightUtc(dateStr: string): Date {
  const naive = new Date(`${dateStr}T00:00:00.000Z`);
  const off = tzOffsetMinutes(naive, APP_TZ);
  return new Date(naive.getTime() - off * 60000);
}

/** Suma un día a una fecha "YYYY-MM-DD". */
function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Rango UTC [start, end) que cubre el día natural `dateStr` en España. Sirve
 * para filtrar los partidos "de ese día" según la hora española.
 */
export function appDayRangeUtc(dateStr: string): { start: string; end: string } {
  return {
    start: appMidnightUtc(dateStr).toISOString(),
    end: appMidnightUtc(nextDay(dateStr)).toISOString(),
  };
}

/** Fecha de hoy (YYYY-MM-DD) en hora de España. */
export function appToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(new Date());
}

/** Suma `n` días a una fecha "YYYY-MM-DD" (n puede ser negativo). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Diferencia en días naturales entre dos fechas "YYYY-MM-DD" (a − b). */
export function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00.000Z`);
  const db = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((da - db) / 86_400_000);
}
