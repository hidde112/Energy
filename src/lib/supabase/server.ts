import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parsePublicEnv } from "@/lib/env/public";

export async function createServerSupabaseClient() {
  const configuration = parsePublicEnv(process.env);
  const cookieStore = await cookies();

  return createServerClient(
    configuration.NEXT_PUBLIC_SUPABASE_URL,
    configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; the request proxy refreshes sessions.
          }
        },
      },
    },
  );
}
