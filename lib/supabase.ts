// =============================================================================
// Clientes de Supabase.
// =============================================================================
// - supabaseAdmin(): usa la clave service_role. SOLO en backend (rutas /api,
//   scripts). Omite RLS, por eso nunca debe llegar al navegador.
// - El frontend no accede directo a Supabase: consume los endpoints /api.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

let _admin: SupabaseClient | null = null;

/** Cliente con privilegios de servidor (service_role). Reutilizado entre llamadas. */
export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_KEY");
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
