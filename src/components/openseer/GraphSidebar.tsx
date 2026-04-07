"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NODE_TYPE_LABEL } from "@/lib/node-type-meta";
import type { OpenSeerNodeType } from "@/lib/types/graph";
import { GRAPH_WORKSPACE_NODE_TYPE_LIST } from "@/lib/types/graph";

interface GraphSidebarProps {
  graphName: string;
  onGraphNameChange: (name: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  showNodeTypeHeadings: boolean;
  onToggleShowNodeTypeHeadings: () => void;
  visibleTypes: Set<OpenSeerNodeType>;
  onToggleType: (t: OpenSeerNodeType) => void;
  onShowAllTypes: () => void;
  onLoadDemo: () => void;
  onNewBlank: () => void;
  onAddNode: (t: OpenSeerNodeType) => void;
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function GraphSidebar({
  graphName,
  onGraphNameChange,
  collapsed,
  onToggleCollapsed,
  showNodeTypeHeadings,
  onToggleShowNodeTypeHeadings,
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

  useEffect(() => {
    if (collapsed) setMenuOpen(false);
  }, [collapsed]);

  if (collapsed) {
    return (
      <aside
        className="flex h-full w-[52px] shrink-0 flex-col items-center gap-2 border-r border-zinc-800 bg-zinc-950/95 py-2 transition-[width] duration-200 ease-out"
        aria-label="Graph tools (collapsed)"
      >
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          onClick={onToggleCollapsed}
          title="Expand graph panel"
          aria-label="Expand graph panel"
        >
          <ChevronRightIcon />
        </button>
        <div className="relative w-full px-1" ref={addWrapRef}>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-700 text-white hover:bg-sky-600 mx-auto"
            title="Add node"
            aria-label="Add node"
            onClick={() => setMenuOpen((o) => !o)}
          >
            +
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default bg-transparent"
                aria-label="Close menu"
                onClick={closeMenu}
              />
              <div className="absolute left-full top-0 z-20 ml-1 max-h-[min(70vh,320px)] w-44 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                {GRAPH_WORKSPACE_NODE_TYPE_LIST.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      onAddNode(t);
                      closeMenu();
                    }}
                  >
                    {NODE_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/95 transition-[width] duration-200 ease-out">
      <div className="border-b border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Graph</h2>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            onClick={onToggleCollapsed}
            title="Collapse graph panel"
            aria-label="Collapse graph panel"
          >
            <ChevronLeftIcon />
          </button>
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Graph name</span>
          <input
            type="text"
            value={graphName}
            onChange={(e) => onGraphNameChange(e.target.value)}
            placeholder="Graph name"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showNodeTypeHeadings}
            onChange={onToggleShowNodeTypeHeadings}
            className="rounded border-zinc-600 bg-zinc-900 text-sky-600 focus:ring-sky-600"
          />
          <span className="text-[11px] leading-snug text-zinc-400">Show node type headings</span>
        </label>
      </div>

      <div className="space-y-2 border-b border-zinc-800 p-3">
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
                {GRAPH_WORKSPACE_NODE_TYPE_LIST.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      onAddNode(t);
                      closeMenu();
                    }}
                  >
                    {NODE_TYPE_LABEL[t]}
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
          {GRAPH_WORKSPACE_NODE_TYPE_LIST.map((t) => {
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
                  <span className="text-sm text-zinc-300">{NODE_TYPE_LABEL[t]}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
