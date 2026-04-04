"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { NavItem, NavSection } from "@/lib/nav/navigation";
import { NAV_SECTIONS } from "@/lib/nav/navigation";

function findCurrentItem(section: NavSection, pathname: string): NavItem | null {
  const sorted = [...section.items].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)) ?? null;
}

function graphCta(sectionId: string) {
  return ["graphs", "workspace", "projects", "knowledge", "documents", "proposals"].includes(sectionId);
}

export function SectionView({ sectionId }: { sectionId: string }) {
  const pathname = usePathname();
  const section = useMemo(
    () => NAV_SECTIONS.find((s) => s.id === sectionId) ?? null,
    [sectionId]
  );

  if (!section) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-zinc-500">
        Unknown section.
      </div>
    );
  }

  const current = findCurrentItem(section, pathname);
  const showGraphCta = graphCta(section.id);
  const isProfileSettings = section.id === "settings" && pathname === "/settings/profile";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 bg-zinc-950/80 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {section.label}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-100">
              {current?.label ?? section.label}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              {section.mvpWired
                ? "MVP area — use the links below or open the live graph workspace for connected operational data."
                : "Structured for enterprise scale. Full workflows ship in a later release; navigation is live today."}
            </p>
          </div>
          {showGraphCta ? (
            <Link
              href="/workspace/graph"
              className="shrink-0 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
            >
              Open graph workspace
            </Link>
          ) : null}
        </div>
      </div>

      {isProfileSettings ? (
        <div className="p-6">
          <SettingsProfilePanel />
        </div>
      ) : (
        <div className="grid flex-1 gap-4 p-6 lg:grid-cols-2">
          {section.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group rounded-lg border px-4 py-3 transition-colors",
                  active
                    ? "border-sky-800/80 bg-sky-950/20"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-200">{item.label}</span>
                  {item.wired ? (
                    <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                      MVP
                    </span>
                  ) : !section.mvpWired ? (
                    <span className="text-[10px] uppercase tracking-wide text-zinc-600">Planned</span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">View</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.href === "/workspace/graph"
                    ? "Primary node canvas — proposals through evidence on one graph."
                    : item.wired
                      ? "Available in this MVP build."
                      : "Placeholder route — structure reserved for V2."}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsProfilePanel() {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-semibold text-zinc-200">Profile (local MVP)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Display name is stored in this browser only. Replace with your identity provider in production.
      </p>
      <ProfileNameForm />
    </div>
  );
}

function ProfileNameForm() {
  const [name, setName] = useState("");
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        setName(localStorage.getItem("openseer-profile-name") ?? "");
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <label className="mt-4 block">
      <span className="text-xs font-medium text-zinc-500">Display name</span>
      <input
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        value={name}
        onChange={(e) => {
          const v = e.target.value;
          setName(v);
          try {
            localStorage.setItem("openseer-profile-name", v);
          } catch {
            /* ignore */
          }
        }}
        placeholder="Your name"
      />
    </label>
  );
}
