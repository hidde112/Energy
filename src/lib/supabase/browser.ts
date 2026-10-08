"use client";

import { createBrowserClient } from "@supabase/ssr";
import { parsePublicEnv } from "@/lib/env/public";

export function createBrowserSupabaseClient() {
  const configuration = parsePublicEnv(process.env);
  return createBrowserClient(
    configuration.NEXT_PUBLIC_SUPABASE_URL,
    configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
