import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/features/identity/components/onboarding-form";
import { completeOnboardingWithClient } from "@/features/identity/server/profile-service";
import type { ProfileWriteClient } from "@/features/identity/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function createWriteClient(result?: {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
}): ProfileWriteClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "8fca7e30-7c5f-4775-b61e-cd52a965f407",
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: "2026-10-08T12:00:00.000Z",
          },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              result ?? {
                data: {
                  user_id: "8fca7e30-7c5f-4775-b61e-cd52a965f407",
                  username: "pulse_fox",
                  display_name: "Énergie Vos 🦊",
                  avatar_path: null,
                  bio: null,
                  preferred_locale: "en",
                  onboarding_completed_at: "2026-10-08T12:05:00.000Z",
                  created_at: "2026-10-08T12:00:00.000Z",
                  updated_at: "2026-10-08T12:05:00.000Z",
                },
                error: null,
              },
            ),
          }),
        }),
      }),
    }),
  };
}

describe("profile onboarding", () => {
  it("normalizes usernames to lowercase and accepts Unicode display names", async () => {
    const client = createWriteClient();

    const result = await completeOnboardingWithClient(client, {
      username: "  Pulse_Fox  ",
      displayName: "  Énergie Vos 🦊  ",
    });

    expect(result).toMatchObject({
      ok: true,
      data: { username: "pulse_fox", display_name: "Énergie Vos 🦊" },
    });
    expect(client.from).toHaveBeenCalledWith("profiles");
    const update = vi.mocked(client.from).mock.results[0]?.value.update;
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "pulse_fox",
        display_name: "Énergie Vos 🦊",
      }),
    );
  });

  it("returns a stable conflict when the normalized username exists", async () => {
    const client = createWriteClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await completeOnboardingWithClient(client, {
      username: "Pulse_Fox",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", status: 409 },
    });
  });

  it("rejects control characters while keeping international names valid", async () => {
    const client = createWriteClient();

    const result = await completeOnboardingWithClient(client, {
      username: "pulse_fox",
      displayName: "Energy\u0000Fox",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", status: 400 },
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("submits values and announces an action conflict accessibly", async () => {
    const submit = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        type: "https://energydex.app/problems/conflict",
        status: 409,
        code: "CONFLICT",
        title: "That username is already taken.",
        correlationId: "identity-test",
      },
    });
    const user = userEvent.setup();
    render(<OnboardingForm onSubmit={submit} />);

    await user.type(screen.getByLabelText(/username/i), "Pulse_Fox");
    await user.type(screen.getByLabelText(/display name/i), "Énergie Vos 🦊");
    await user.click(screen.getByRole("button", { name: /create profile/i }));

    expect(submit).toHaveBeenCalledWith({
      username: "Pulse_Fox",
      displayName: "Énergie Vos 🦊",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That username is already taken.",
    );
  });
});
