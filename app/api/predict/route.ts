// =============================================================================
// GET /api/predict?fixture=<id> — predicción de un partido concreto.
// =============================================================================

import { NextResponse } from "next/server";
import { getFixturePrediction } from "@/lib/predict";
import { MODEL_DISCLAIMER } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixtureParam = searchParams.get("fixture");

  if (!fixtureParam) {
    return NextResponse.json(
      { error: "Falta el parámetro 'fixture'.", disclaimer: MODEL_DISCLAIMER },
      { status: 400 },
    );
  }

  const fixtureId = Number(fixtureParam);
  if (!Number.isInteger(fixtureId)) {
    return NextResponse.json(
      { error: "'fixture' debe ser un id numérico.", disclaimer: MODEL_DISCLAIMER },
      { status: 400 },
    );
  }

  try {
    const match = await getFixturePrediction(fixtureId);
    if (!match) {
      return NextResponse.json(
        { error: "Partido no encontrado.", disclaimer: MODEL_DISCLAIMER },
        { status: 404 },
      );
    }
    return NextResponse.json({ match, disclaimer: MODEL_DISCLAIMER });
  } catch (e) {
    console.error("Error en /api/predict:", e);
    return NextResponse.json(
      { error: "Error al calcular la predicción.", disclaimer: MODEL_DISCLAIMER },
      { status: 500 },
    );
  }
}
