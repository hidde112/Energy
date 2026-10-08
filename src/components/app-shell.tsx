import type { PropsWithChildren } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <DesktopSidebar />
      <div className="app-canvas">
        <main className="app-content">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
