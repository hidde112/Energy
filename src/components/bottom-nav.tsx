import Link from "next/link";
import { Compass, Home, Library, ScanLine, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

const navigationItems: readonly NavigationItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/scan", label: "Scan", icon: ScanLine, primary: true },
  { href: "/collection", label: "Collection", icon: Library },
  { href: "/friends", label: "Friends", icon: Users },
];

export function BottomNav() {
  return (
    <nav aria-label="Mobile navigation" className="mobile-navigation">
      {navigationItems.map(({ href, label, icon: Icon, primary }) => (
        <Link
          aria-label={label}
          className={primary ? "nav-link nav-link-primary" : "nav-link"}
          data-primary-action={primary ? "true" : undefined}
          href={href}
          key={href}
        >
          <Icon aria-hidden="true" size={primary ? 26 : 21} strokeWidth={2.2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
