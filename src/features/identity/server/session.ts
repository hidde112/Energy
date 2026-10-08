import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityClient, Profile } from "@/features/identity/contracts";

async function defaultClient(): Promise<IdentityClient> {
  return (await createServerSupabaseClient()) as unknown as IdentityClient;
}

export async function ensureAnonymousSession(providedClient?: IdentityClient) {
  const client = providedClient ?? (await defaultClient());
  const current = await client.auth.getUser();

  if (current.data.user) {
    return current.data.user;
  }

  const created = await client.auth.signInAnonymously();
  if (created.error || !created.data.user) {
    throw new AppError("UNAUTHENTICATED", "Unable to start a guest session.", {
      cause: created.error,
    });
  }

  return created.data.user;
}

export async function getCurrentProfile(
  providedClient?: IdentityClient,
): Promise<Profile | null> {
  const client = providedClient ?? (await defaultClient());
  const user = await ensureAnonymousSession(client);
  const result = await client.from("profiles").select("*").maybeSingle();

  if (result.error) {
    throw new AppError("UNEXPECTED", "Unable to load your profile.", {
      cause: result.error,
      metadata: { userId: user.id },
    });
  }

  return result.data;
}

export function needsOnboarding(profile: Profile | null) {
  return !profile?.username || !profile.onboarding_completed_at;
}
