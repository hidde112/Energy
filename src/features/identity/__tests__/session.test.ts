import { describe, expect, it, vi } from "vitest";
import {
  ensureAnonymousSession,
  getCurrentProfile,
  needsOnboarding,
} from "@/features/identity/server/session";
import type { IdentityClient } from "@/features/identity/contracts";

const existingUser = {
  id: "8fca7e30-7c5f-4775-b61e-cd52a965f407",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-10-08T12:00:00.000Z",
};

function createClient(options?: {
  user?: typeof existingUser | null;
  profile?: Record<string, unknown> | null;
}): IdentityClient {
  const user = options?.user === undefined ? null : options.user;
  const profile = options?.profile ?? null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { user: existingUser },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
      }),
    }),
  };
}

describe("anonymous identity", () => {
  it("signs in anonymously exactly once when there is no session", async () => {
    const client = createClient();

    await expect(ensureAnonymousSession(client)).resolves.toEqual(existingUser);
    expect(client.auth.getUser).toHaveBeenCalledOnce();
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it("preserves the existing user ID instead of replacing the session", async () => {
    const client = createClient({ user: existingUser });

    const user = await ensureAnonymousSession(client);

    expect(user.id).toBe(existingUser.id);
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("redirects to onboarding only while the profile is incomplete", async () => {
    const incomplete = createClient({
      user: existingUser,
      profile: { user_id: existingUser.id, username: null },
    });
    const complete = createClient({
      user: existingUser,
      profile: {
        user_id: existingUser.id,
        username: "pulse_fox",
        onboarding_completed_at: "2026-10-08T12:05:00.000Z",
      },
    });

    await expect(getCurrentProfile(incomplete)).resolves.toMatchObject({
      username: null,
    });
    expect(needsOnboarding(await getCurrentProfile(incomplete))).toBe(true);
    expect(needsOnboarding(await getCurrentProfile(complete))).toBe(false);
  });
});
