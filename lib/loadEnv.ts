// =============================================================================
// Carga de variables de entorno para los scripts (tsx).
// =============================================================================
// IMPORTA ESTE MÓDULO EL PRIMERO en cualquier script. Los imports de ESM se
// evalúan antes que el cuerpo del módulo, así que cargar dotenv aquí (como
// efecto de import) garantiza que las claves estén disponibles antes de que se
// evalúe lib/env.ts u otros módulos que leen process.env al importarse.
// =============================================================================

import { config } from "dotenv";

// .env.local (donde Next.js espera las claves) y, como respaldo, .env.
config({ path: ".env.local" });
config();
