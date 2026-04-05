"use client";

import { useCallback, useRef, useState } from "react";
import type { OpenSeerNodeType } from "@/lib/types/graph";
import { OPEN_SEER_NODE_TYPES } from "@/lib/types/graph";

const TYPE_FILTER_LABEL: Record<OpenSeerNodeType, string> = {
  proposal: "Proposal",
  program: "Program",
  project: "Project",
  epic: "Epic",
  sprint: "Sprint",
  task: "Task",
  step: "Step",
  howto: "How-To",
  evidence: "Evidence",
  risk: "Risk",
  cost: "Cost",
  decision: "Decision",
  image: "Image",
  video: "Video",
  group: "Group",
};

interface GraphSidebarProps {
  graphName: string;
  visibleTypes: Set<OpenSeerNodeType>;
  onToggleType: (t: OpenSeerNodeType) => void;
  onShowAllTypes: () => void;
  onLoadDemo: () => void;
  onNewBlank: () => void;
  onAddNode: (t: OpenSeerNodeType) => void;
}

export function GraphSidebar({
  graphName,
  visibleTypes,
  onToggleType,
  onShowAllTypes,
  onLoadDemo,
  onNewBlank,
  onAddNode,
}: GraphSidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const addWrapRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/95">
      <div className="border-b border-zinc-800 px-3 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Graph</h2>
        <p className="mt-1 truncate text-sm font-medium text-zinc-200" title={graphName}>
          {graphName}
        </p>
      </div>

      <div className="border-b border-zinc-800 p-3 space-y-2">
        <div className="relative" ref={addWrapRef}>
          <button
            type="button"
            className="w-full rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
            onClick={() => setMenuOpen((o) => !o)}
          >
            + Add node
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default bg-transparent"
                aria-label="Close menu"
                onClick={closeMenu}
              />
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[min(70vh,320px)] overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                {OPEN_SEER_NODE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      onAddNode(t);
                      closeMenu();
                    }}
                  >
                    {TYPE_FILTER_LABEL[t]}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          onClick={onLoadDemo}
        >
          Load demo graph
        </button>
        <button
          type="button"
          className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          onClick={onNewBlank}
        >
          New blank graph
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Node types</h3>
          <button
            type="button"
            className="text-[11px] text-sky-500 hover:text-sky-400"
            onClick={onShowAllTypes}
          >
            Show all
          </button>
        </div>
        <p className="text-[11px] leading-snug text-zinc-600">
          Toggle types to focus the canvas. Hidden nodes and their connections are removed from view.
        </p>
        <ul className="space-y-1">
          {OPEN_SEER_NODE_TYPES.map((t) => {
            const on = visibleTypes.has(t);
            return (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-900/80">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggleType(t)}
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-600 focus:ring-sky-600"
                  />
                  <span className="text-sm text-zinc-300">{TYPE_FILTER_LABEL[t]}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
