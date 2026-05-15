import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key.
// Uses the HTTPS REST API — works even when the direct PostgreSQL
// connection (pooler or direct host) is unreachable.
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
