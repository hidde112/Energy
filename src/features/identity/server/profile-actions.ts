"use server";

import type {
  OnboardingInput,
  Profile,
  ProfileWriteClient,
} from "@/features/identity/contracts";
import { completeOnboardingWithClient } from "@/features/identity/server/profile-service";
import type { ActionResult } from "@/lib/actions/action-result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function completeOnboarding(
  input: OnboardingInput,
): Promise<ActionResult<Profile>> {
  const client =
    (await createServerSupabaseClient()) as unknown as ProfileWriteClient;
  return completeOnboardingWithClient(client, input);
}
