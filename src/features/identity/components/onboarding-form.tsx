"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { completeOnboarding } from "@/features/identity/server/profile-actions";
import type { OnboardingInput, Profile } from "@/features/identity/contracts";
import type { ActionResult } from "@/lib/actions/action-result";

type OnboardingFormProps = {
  onSubmit?: (input: OnboardingInput) => Promise<ActionResult<Profile>>;
};

export function OnboardingForm({
  onSubmit = completeOnboarding,
}: OnboardingFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await onSubmit({
      username: String(form.get("username") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
    });

    if (!result.ok) {
      setError(result.error.title);
      setPending(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <form className="identity-form" onSubmit={handleSubmit}>
      <label htmlFor="username">Username</label>
      <div className="field-prefix">
        <span aria-hidden="true">@</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          id="username"
          maxLength={30}
          minLength={3}
          name="username"
          pattern="[A-Za-z0-9][A-Za-z0-9_]{2,29}"
          placeholder="pulse_fox"
          required
        />
      </div>
      <p className="field-hint">
        Letters, numbers, and underscores. You can change this later.
      </p>

      <label htmlFor="displayName">
        Display name <span>(optional)</span>
      </label>
      <input
        autoComplete="name"
        id="displayName"
        maxLength={60}
        name="displayName"
        placeholder="Énergie Vos"
      />

      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}

      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Create profile"}
      </button>
      <p className="privacy-note">
        Your guest profile is tied to this browser until account linking is
        available.
      </p>
    </form>
  );
}
