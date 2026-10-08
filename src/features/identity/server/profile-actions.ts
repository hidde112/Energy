"use server";

import { cookies } from "next/headers";
import type {
  OnboardingInput,
  Profile,
  ProfileWriteClient,
} from "@/features/identity/contracts";
import { completeOnboardingWithClient } from "@/features/identity/server/profile-service";
import type { ActionResult } from "@/lib/actions/action-result";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  E2E_PROFILE_COOKIE,
  E2E_USER_COOKIE,
  encodeFixture,
  fixtureProfile,
  isE2EMode,
} from "@/lib/e2e/fixtures";

export async function completeOnboarding(
  input: OnboardingInput,
): Promise<ActionResult<Profile>> {
  if (isE2EMode()) {
    const store = await cookies();
    const userId = store.get(E2E_USER_COOKIE)?.value;
    const testClient = {
      auth: {
        getUser: async () => ({
          data: { user: userId ? { id: userId } : null },
          error: null,
        }),
      },
      from: () => ({
        update: (values: {
          username?: string | null;
          display_name?: string | null;
        }) => ({
          eq: () => ({
            select: () => ({
              single: async () => {
                if (!userId)
                  return {
                    data: null,
                    error: { message: "Missing test user" },
                  };
                const profile = fixtureProfile(
                  userId,
                  values.username ?? null,
                  values.display_name ?? null,
                );
                store.set(E2E_PROFILE_COOKIE, encodeFixture(profile), {
                  httpOnly: true,
                  sameSite: "lax",
                  path: "/",
                });
                return { data: profile, error: null };
              },
            }),
          }),
        }),
      }),
    } as unknown as ProfileWriteClient;
    return completeOnboardingWithClient(testClient, input);
  }
  const client =
    (await createServerSupabaseClient()) as unknown as ProfileWriteClient;
  return completeOnboardingWithClient(client, input);
}
