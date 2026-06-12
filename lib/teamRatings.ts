// =============================================================================
// Ratings Elo de las 48 selecciones del Mundial 2026.
// =============================================================================
// Los nombres COINCIDEN con los de la fuente de datos (openfootball / teams.name)
// para poder cruzar el seeding por nombre, sin necesidad de teamId manual.
//
// Actualiza el `elo` desde https://eloratings.net unos días antes del torneo
// (los valores aquí son orientativos). `qual` (opcional): medias de goles a
// favor/en contra por partido en clasificación + amistosos; si es null, se usa
// solo el Elo. El peso de mezcla está en BLEND (lib/seeding.ts).
// =============================================================================

import type { QualificationStats } from "./seeding";

export interface TeamRating {
  /** Nombre EXACTO como aparece en teams.name (inglés, openfootball). */
  name: string;
  elo: number;
  qual?: QualificationStats | null;
}

/** Las 48 selecciones clasificadas (nombres de openfootball para el Mundial 2026). */
export const TEAM_RATINGS: TeamRating[] = [
  { name: "Argentina", elo: 2105 },
  { name: "France", elo: 2055 },
  { name: "Spain", elo: 2050 },
  { name: "Brazil", elo: 1995 },
  { name: "England", elo: 1985 },
  { name: "Portugal", elo: 1975 },
  { name: "Netherlands", elo: 1960 },
  { name: "Belgium", elo: 1935 },
  { name: "Germany", elo: 1930 },
  { name: "Croatia", elo: 1885 },
  { name: "Uruguay", elo: 1895 },
  { name: "Colombia", elo: 1865 },
  { name: "Norway", elo: 1845 },
  { name: "Morocco", elo: 1840 },
  { name: "Switzerland", elo: 1815 },
  { name: "Japan", elo: 1815 },
  { name: "Turkey", elo: 1815 },
  { name: "Scotland", elo: 1790 },
  { name: "Senegal", elo: 1800 },
  { name: "USA", elo: 1795 },
  { name: "Mexico", elo: 1790 },
  { name: "Austria", elo: 1790 },
  { name: "Ecuador", elo: 1780 },
  { name: "Sweden", elo: 1765 },
  { name: "Iran", elo: 1760 },
  { name: "South Korea", elo: 1760 },
  { name: "Algeria", elo: 1745 },
  { name: "Egypt", elo: 1740 },
  { name: "Czech Republic", elo: 1740 },
  { name: "Canada", elo: 1735 },
  { name: "Australia", elo: 1715 },
  { name: "Ivory Coast", elo: 1715 },
  { name: "Paraguay", elo: 1700 },
  { name: "Bosnia & Herzegovina", elo: 1700 },
  { name: "Tunisia", elo: 1685 },
  { name: "Ghana", elo: 1680 },
  { name: "DR Congo", elo: 1670 },
  { name: "Qatar", elo: 1660 },
  { name: "Saudi Arabia", elo: 1640 },
  { name: "Panama", elo: 1640 },
  { name: "South Africa", elo: 1620 },
  { name: "Iraq", elo: 1620 },
  { name: "Cape Verde", elo: 1610 },
  { name: "Uzbekistan", elo: 1605 },
  { name: "Jordan", elo: 1560 },
  { name: "Curaçao", elo: 1560 },
  { name: "New Zealand", elo: 1500 },
  { name: "Haiti", elo: 1500 },
];
