// =============================================================================
// Plantilla de ratings de las selecciones del Mundial 2026.
// =============================================================================
// RELLENAR MANUALMENTE ANTES DEL TORNEO:
//   - `teamId`: id de la selección en API-Football. Búscalo con el endpoint
//     /teams?search=<nombre> o míralo en una fixture ya ingestada (tabla teams).
//     Mientras valga 0, el script de seed lo IGNORA y avisa.
//   - `elo`: rating actualizado de https://eloratings.net (cópialo unos días
//     antes del 11 de junio; los valores de aquí son orientativos).
//   - `qual` (opcional): medias de goles a favor/en contra por partido en la
//     clasificación + amistosos. Si lo dejas en null, se usa solo el Elo.
//
// El peso de mezcla Elo/datos reales se controla con BLEND en lib/seeding.ts.
// =============================================================================

import type { QualificationStats } from "./seeding";

export interface TeamRating {
  name: string;
  teamId: number; // 0 = pendiente de rellenar
  elo: number;
  qual?: QualificationStats | null;
}

/**
 * Las 48 selecciones (provisional). Actualiza Elo y rellena teamId antes del
 * torneo. Ordenadas aproximadamente por fuerza para facilitar la revisión.
 */
export const TEAM_RATINGS: TeamRating[] = [
  { name: "Argentina", teamId: 0, elo: 2105, qual: null },
  { name: "Francia", teamId: 0, elo: 2055, qual: null },
  { name: "España", teamId: 0, elo: 2045, qual: null },
  { name: "Brasil", teamId: 0, elo: 1995, qual: null },
  { name: "Inglaterra", teamId: 0, elo: 1985, qual: null },
  { name: "Portugal", teamId: 0, elo: 1975, qual: null },
  { name: "Países Bajos", teamId: 0, elo: 1960, qual: null },
  { name: "Bélgica", teamId: 0, elo: 1940, qual: null },
  { name: "Alemania", teamId: 0, elo: 1930, qual: null },
  { name: "Croacia", teamId: 0, elo: 1885, qual: null },
  { name: "Uruguay", teamId: 0, elo: 1900, qual: null },
  { name: "Colombia", teamId: 0, elo: 1865, qual: null },
  { name: "Noruega", teamId: 0, elo: 1845, qual: null },
  { name: "Marruecos", teamId: 0, elo: 1840, qual: null },
  { name: "Suiza", teamId: 0, elo: 1820, qual: null },
  { name: "Japón", teamId: 0, elo: 1820, qual: null },
  { name: "Turquía", teamId: 0, elo: 1815, qual: null },
  { name: "Dinamarca", teamId: 0, elo: 1810, qual: null },
  { name: "Senegal", teamId: 0, elo: 1800, qual: null },
  { name: "Estados Unidos", teamId: 0, elo: 1800, qual: null },
  { name: "México", teamId: 0, elo: 1790, qual: null },
  { name: "Austria", teamId: 0, elo: 1790, qual: null },
  { name: "Ecuador", teamId: 0, elo: 1780, qual: null },
  { name: "Grecia", teamId: 0, elo: 1780, qual: null },
  { name: "Serbia", teamId: 0, elo: 1770, qual: null },
  { name: "Ucrania", teamId: 0, elo: 1770, qual: null },
  { name: "Irán", teamId: 0, elo: 1760, qual: null },
  { name: "Corea del Sur", teamId: 0, elo: 1760, qual: null },
  { name: "Polonia", teamId: 0, elo: 1750, qual: null },
  { name: "Nigeria", teamId: 0, elo: 1750, qual: null },
  { name: "Argelia", teamId: 0, elo: 1750, qual: null },
  { name: "Canadá", teamId: 0, elo: 1740, qual: null },
  { name: "Egipto", teamId: 0, elo: 1740, qual: null },
  { name: "Australia", teamId: 0, elo: 1720, qual: null },
  { name: "Costa de Marfil", teamId: 0, elo: 1720, qual: null },
  { name: "Perú", teamId: 0, elo: 1715, qual: null },
  { name: "Chile", teamId: 0, elo: 1715, qual: null },
  { name: "Paraguay", teamId: 0, elo: 1700, qual: null },
  { name: "Camerún", teamId: 0, elo: 1700, qual: null },
  { name: "Túnez", teamId: 0, elo: 1685, qual: null },
  { name: "Ghana", teamId: 0, elo: 1680, qual: null },
  { name: "Catar", teamId: 0, elo: 1660, qual: null },
  { name: "Costa Rica", teamId: 0, elo: 1660, qual: null },
  { name: "Arabia Saudí", teamId: 0, elo: 1640, qual: null },
  { name: "Panamá", teamId: 0, elo: 1640, qual: null },
  { name: "Sudáfrica", teamId: 0, elo: 1620, qual: null },
  { name: "Uzbekistán", teamId: 0, elo: 1600, qual: null },
  { name: "Nueva Zelanda", teamId: 0, elo: 1500, qual: null },
];
