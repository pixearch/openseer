"use client";

import { AppHeader } from "@/components/shell/AppHeader";
import { AppSidebar, useRailCollapsed } from "@/components/shell/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useRailCollapsed();

  return (
    <div className="flex h-screen flex-col bg-[#0c0c0e] text-zinc-100">
      <AppHeader onMenuClick={toggle} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar collapsed={collapsed} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0b0b0d]">
          {children}
        </main>
      </div>
    </div>
  );
}
