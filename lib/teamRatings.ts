// =============================================================================
// Ratings Elo de las 48 selecciones del Mundial 2026 (escala eloratings.net).
// =============================================================================
// Los nombres COINCIDEN con teams.name (openfootball) para cruzar el seeding por
// nombre, sin teamId manual.
//
// PROCEDENCIA de los Elo:
//   • [REAL]  valores oficiales de eloratings.net a 12/06/2026 (los ~18 primeros,
//             obtenidos de eloratings.net / Wikipedia).
//   • [EST.]  estimación en la MISMA escala (no mezclar con otras tablas Elo, que
//             usan escalas distintas). Refínalos desde https://eloratings.net.
//
// `qual` (opcional): medias de goles a favor/en contra de clasificación; si es
// null se usa solo el Elo. Mezcla controlada por BLEND (lib/seeding.ts).
// =============================================================================

import type { QualificationStats } from "./seeding";

export interface TeamRating {
  /** Nombre EXACTO como aparece en teams.name (inglés, openfootball). */
  name: string;
  elo: number;
  qual?: QualificationStats | null;
}

/** Las 48 selecciones, ordenadas por Elo descendente. */
export const TEAM_RATINGS: TeamRating[] = [
  // --- [REAL] eloratings.net, 12/06/2026 ---
  { name: "Spain", elo: 2157 },
  { name: "Argentina", elo: 2115 },
  { name: "France", elo: 2063 },
  { name: "England", elo: 2024 },
  { name: "Brazil", elo: 1991 },
  { name: "Portugal", elo: 1989 },
  { name: "Colombia", elo: 1982 },
  { name: "Netherlands", elo: 1948 },
  { name: "Ecuador", elo: 1938 },
  { name: "Germany", elo: 1932 },
  { name: "Norway", elo: 1914 },
  { name: "Croatia", elo: 1912 },
  { name: "Turkey", elo: 1911 },
  { name: "Japan", elo: 1906 },
  { name: "Belgium", elo: 1894 },
  { name: "Uruguay", elo: 1892 },
  { name: "Switzerland", elo: 1891 },
  { name: "Mexico", elo: 1875 },
  // --- [EST.] estimaciones en la escala de eloratings.net (refinar) ---
  { name: "Morocco", elo: 1855 },
  { name: "Senegal", elo: 1800 },
  { name: "Austria", elo: 1790 },
  { name: "Scotland", elo: 1788 },
  { name: "Algeria", elo: 1765 },
  { name: "Sweden", elo: 1762 },
  { name: "Iran", elo: 1760 },
  { name: "Czech Republic", elo: 1758 },
  { name: "South Korea", elo: 1755 },
  { name: "Egypt", elo: 1745 },
  { name: "Ivory Coast", elo: 1740 },
  { name: "USA", elo: 1725 },
  { name: "Australia", elo: 1720 },
  { name: "Canada", elo: 1718 },
  { name: "Paraguay", elo: 1715 },
  { name: "Bosnia & Herzegovina", elo: 1710 },
  { name: "Tunisia", elo: 1692 },
  { name: "DR Congo", elo: 1690 },
  { name: "Qatar", elo: 1686 },
  { name: "Ghana", elo: 1684 },
  { name: "South Africa", elo: 1680 },
  { name: "Saudi Arabia", elo: 1665 },
  { name: "Panama", elo: 1660 },
  { name: "Uzbekistan", elo: 1655 },
  { name: "Iraq", elo: 1648 },
  { name: "Cape Verde", elo: 1630 },
  { name: "Jordan", elo: 1612 },
  { name: "Curaçao", elo: 1545 },
  { name: "Haiti", elo: 1530 },
  { name: "New Zealand", elo: 1510 },
];
