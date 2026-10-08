import "server-only";

import { createClient } from "@supabase/supabase-js";
import { parseServerEnv } from "@/lib/env/server";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminSupabaseClient() {
  const configuration = parseServerEnv(process.env);

  return createClient<Database>(
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
