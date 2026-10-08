import "server-only";

import { createClient } from "@supabase/supabase-js";
import { parseServerEnv } from "@/lib/env/server";

export function createAdminSupabaseClient() {
  const configuration = parseServerEnv(process.env);

  return createClient(
    configuration.NEXT_PUBLIC_SUPABASE_URL,
    configuration.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
