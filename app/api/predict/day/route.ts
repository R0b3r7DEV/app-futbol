// =============================================================================
// GET /api/predict/day?date=YYYY-MM-DD — analiza todos los partidos del día.
// =============================================================================
// Sin `date` usa la fecha de hoy. Devuelve los partidos ordenados de mayor a
// menor confianza, cada uno con el desglose completo, más bestBetOfDay.
// =============================================================================

import { NextResponse } from "next/server";
import { getDayPredictions } from "@/lib/predict";
import { MODEL_DISCLAIMER } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Fecha de hoy en formato YYYY-MM-DD (UTC). */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? hoy();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "'date' debe tener formato YYYY-MM-DD.", disclaimer: MODEL_DISCLAIMER },
      { status: 400 },
    );
  }

  try {
    const day = await getDayPredictions(date);
    return NextResponse.json(day);
  } catch (e) {
    console.error("Error en /api/predict/day:", e);
    return NextResponse.json(
      { error: "Error al calcular las predicciones del día.", disclaimer: MODEL_DISCLAIMER },
      { status: 500 },
    );
  }
}
