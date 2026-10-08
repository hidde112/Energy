import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/identity/components/onboarding-form";
import {
  getCurrentProfile,
  needsOnboarding,
} from "@/features/identity/server/session";

export const metadata = { title: "Create your profile" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();

  if (!needsOnboarding(profile)) {
    redirect("/profile");
  }

  return (
    <section className="identity-layout">
      <div className="identity-copy">
        <p className="eyebrow">Guest profile</p>
        <h1>Claim your spot in the Dex.</h1>
        <p>
          Pick a handle for your collection, ratings, and future account
          upgrade. No email is required.
        </p>
      </div>
      <OnboardingForm />
    </section>
  );
}
