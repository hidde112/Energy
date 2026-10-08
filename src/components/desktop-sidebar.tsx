import Link from "next/link";
import {
  BatteryCharging,
  Compass,
  Home,
  Library,
  ScanLine,
  Users,
} from "lucide-react";
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

export function DesktopSidebar() {
  return (
    <aside className="desktop-sidebar">
      <Link aria-label="ENERGYDEX home" className="brand-mark" href="/">
        <span className="brand-icon">
          <BatteryCharging aria-hidden="true" size={22} />
        </span>
        <span>ENERGYDEX</span>
      </Link>

      <nav aria-label="Desktop navigation" className="desktop-navigation">
        {navigationItems.map(({ href, label, icon: Icon, primary }) => (
          <Link
            aria-label={label}
            className={
              primary ? "sidebar-link sidebar-link-primary" : "sidebar-link"
            }
            data-primary-action={primary ? "true" : undefined}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
            {label === "Friends" ? <small>Coming later</small> : null}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
