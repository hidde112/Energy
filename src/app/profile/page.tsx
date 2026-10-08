import { redirect } from "next/navigation";
import { ProfileMenu } from "@/features/identity/components/profile-menu";
import {
  getCurrentProfile,
  needsOnboarding,
} from "@/features/identity/server/session";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  if (!profile || needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  return (
    <section className="state-card profile-card">
      <p className="eyebrow">Your identity</p>
      <h1>{profile.display_name || profile.username}</h1>
      <ProfileMenu profile={profile} />
      <p>
        Your anonymous account keeps its Supabase user ID across refreshes.
        Account linking will upgrade this same identity in a later release.
      </p>
    </section>
  );
}
