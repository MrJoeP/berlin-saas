// Supabase-Client-Factory für Edge Functions.
// Service-Role-Key kommt aus Supabase Vault oder Env, wird in den Functions injected.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let cachedClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) throw new Error("SUPABASE_URL nicht gesetzt.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY nicht gesetzt. Vault prüfen.");

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

export function getAnonClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url) throw new Error("SUPABASE_URL nicht gesetzt.");
  if (!key) throw new Error("SUPABASE_ANON_KEY nicht gesetzt.");

  return createClient(url, key);
}
