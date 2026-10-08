import Link from "next/link";
import { UserRound } from "lucide-react";
import type { Profile } from "@/features/identity/contracts";

export function ProfileMenu({ profile }: { profile: Profile }) {
  return (
    <Link
      className="profile-menu"
      href="/profile"
      aria-label="Open your profile"
    >
      <span className="profile-avatar" aria-hidden="true">
        <UserRound size={20} />
      </span>
      <span>
        <strong>{profile.display_name || profile.username}</strong>
        <small>@{profile.username}</small>
      </span>
    </Link>
  );
}
