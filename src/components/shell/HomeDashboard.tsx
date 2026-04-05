"use client";

import Link from "next/link";

const cards = [
  {
    title: "Graph workspace",
    desc: "Node canvas for proposals, programs, steps, evidence, risks, costs, and decisions.",
    href: "/workspace/graph",
    tag: "Core",
  },
  {
    title: "Graphs",
    desc: "Browse graph entry points, templates, and shared canvases.",
    href: "/graphs",
    tag: "Navigate",
  },
  {
    title: "Documents",
    desc: "Written artifacts, evidence attachments, and references.",
    href: "/documents",
    tag: "Navigate",
  },
  {
    title: "Teams",
    desc: "Ownership, roles, and collaboration scaffolding.",
    href: "/teams",
    tag: "Navigate",
  },
  {
    title: "Settings",
    desc: "Profile and workspace preferences (local MVP).",
    href: "/settings",
    tag: "Navigate",
  },
];

const quick = [
  { label: "Recent Work", href: "/home/recent" },
  { label: "Favorites", href: "/home/favorites" },
  { label: "Quick Start", href: "/home/quick-start" },
];

export function HomeDashboard() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 bg-zinc-950/80 px-6 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Home</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Operational intelligence graph: map how work runs, why decisions were made, and what evidence
          supports delivery — from front line to executives.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Start here</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-100">{c.title}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
                  {c.tag}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{c.desc}</p>
              <span className="mt-3 inline-block text-xs font-medium text-sky-500 group-hover:text-sky-400">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
