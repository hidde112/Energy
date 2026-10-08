import "server-only";

import { cookies } from "next/headers";
import { AppError } from "@/lib/errors/app-error";
import {
  decodeFixture,
  E2E_PROFILE_COOKIE,
  E2E_USER_COOKIE,
  fixtureProfile,
  isE2EMode,
} from "@/lib/e2e/fixtures";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityClient, Profile } from "@/features/identity/contracts";

async function defaultClient(): Promise<IdentityClient> {
  return (await createServerSupabaseClient()) as unknown as IdentityClient;
}

export async function ensureAnonymousSession(providedClient?: IdentityClient) {
  if (isE2EMode() && !providedClient) {
    const userId = (await cookies()).get(E2E_USER_COOKIE)?.value;
    if (!userId) {
      throw new AppError(
        "UNAUTHENTICATED",
        "Unable to start a test guest session.",
      );
    }
    return { id: userId } as Awaited<
      ReturnType<IdentityClient["auth"]["getUser"]>
    >["data"]["user"] & { id: string };
  }
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
  if (isE2EMode() && !providedClient) {
    const store = await cookies();
    const userId = store.get(E2E_USER_COOKIE)?.value;
    if (!userId) return null;
    return (
      decodeFixture<Profile>(store.get(E2E_PROFILE_COOKIE)?.value) ??
      fixtureProfile(userId)
    );
  }
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
