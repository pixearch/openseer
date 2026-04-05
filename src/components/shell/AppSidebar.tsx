"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { NavSection } from "@/lib/nav/navigation";
import { NAV_SECTIONS } from "@/lib/nav/navigation";
import { NavIcon } from "@/components/shell/NavIcons";

const RAIL_COLLAPSED_KEY = "openseer-rail-collapsed";

function sectionIsActive(section: NavSection, pathname: string) {
  if (section.href === "/") {
    return pathname === "/" || pathname.startsWith("/home");
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of NAV_SECTIONS) init[s.id] = s.mvpWired;
    return init;
  });

  const toggleSection = useCallback((id: string) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }, []);

  return (
    <aside
      className={[
        "flex h-full shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 ease-out",
        collapsed ? "w-[72px]" : "w-[268px]",
      ].join(" ")}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV_SECTIONS.map((section) => {
            const active = sectionIsActive(section, pathname);
            const isOpen = expanded[section.id] && !collapsed;

            return (
              <div key={section.id} className="rounded-md">
                <div className="flex items-center">
                  <Link
                    href={section.href}
                    title={collapsed ? section.label : undefined}
                    className={[
                      "group flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm",
                      active
                        ? "bg-zinc-800/90 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                    ].join(" ")}
                  >
                    <NavIcon name={section.icon} />
                    {!collapsed ? (
                      <span className="truncate font-medium">{section.label}</span>
                    ) : null}
                  </Link>
                  {!collapsed ? (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                      aria-expanded={isOpen}
                      aria-label={`Toggle ${section.label} submenu`}
                    >
                      <svg
                        className={["h-4 w-4 transition-transform", isOpen ? "rotate-180" : ""].join(" ")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                {!collapsed && isOpen ? (
                  <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-2">
                    {section.items.map((item) => {
                      const itemActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={[
                              "block truncate rounded px-2 py-1.5 text-xs",
                              itemActive
                                ? "bg-sky-950/50 text-sky-200"
                                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300",
                            ].join(" ")}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
      {!collapsed ? (
        <div className="border-t border-zinc-800 p-3 text-[10px] leading-snug text-zinc-600">
          Open graph:{" "}
          <Link href="/workspace/graph" className="text-sky-600 hover:text-sky-400">
            Workspace graph
          </Link>
        </div>
      ) : null}
    </aside>
  );
}

export function useRailCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setCollapsed(localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const n = !c;
      localStorage.setItem(RAIL_COLLAPSED_KEY, n ? "1" : "0");
      return n;
    });
  }, []);

  return { collapsed, toggle };
}
