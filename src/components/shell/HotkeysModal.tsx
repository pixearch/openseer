"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { chordFromKeydown, primaryZ, chordEquals, type Chord } from "@/lib/hotkeys/chord";
import { findDisplayConflictName, previewReassignAnyway } from "@/lib/hotkeys/conflict";
import { chordToKeycapLabels, formatChordText } from "@/lib/hotkeys/format-chord";
import {
  CATEGORY_ORDER,
  HOTKEY_ROWS,
  getDefaultChord,
  type EditableHotkey,
  type HotkeyRow,
} from "@/lib/hotkeys/registry";
import { useHotkeyBindings } from "@/components/shell/hotkey-bindings-provider";

const ROW_LABEL: Record<EditableHotkey, string> = {
  panUp: "Pan up",
  panDown: "Pan down",
  panLeft: "Pan left",
  panRight: "Pan right",
  panFaster: "Increase pan speed",
  panSlower: "Decrease pan speed",
  zoomToSelection: "Zoom to selected node",
  fitAll: "Zoom to fit all nodes",
  focusMode: "Focus mode",
  gridSnap: "Toggle grid snapping",
  overview: "Toggle overview window",
  radialFromSpace: "Open radial node menu",
  alignNodes: "Align nodes",
  evenSpacing: "Even spacing",
  proportionalMove: "Proportional move mode",
  grabControlPoint: "Grab selected control point",
  chainToggle: "Toggle chain mode",
  chainConnect: "Auto-chain selected nodes",
  breakFromChain: "Break node out of chain",
  duplicate: "Duplicate default node",
  duplicateExact: "Exact duplicate",
  undo: "Undo",
  redo: "Redo",
};

type HotkeysModalProps = { open: boolean; onClose: () => void };

function chordForCapture(
  e: KeyboardEvent,
  forId: EditableHotkey | null
): Chord | null {
  if (forId === "undo" || forId === "redo") {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      return primaryZ(!!e.shiftKey);
    }
  }
  const c = chordFromKeydown(e);
  if (c) e.preventDefault();
  return c;
}

function rowSearchText(r: HotkeyRow): string {
  if (r.kind === "static") {
    return `${r.category} ${r.label} ${r.rightLabel}`.toLowerCase();
  }
  return `${r.category} ${r.label} ${formatChordText(r.defaultChord)}`.toLowerCase();
}

export function HotkeysModal({ open, onClose }: HotkeysModalProps) {
  const id = useId();
  const ctx = useHotkeyBindings();
  const [q, setQ] = useState("");
  const [cap, setCap] = useState<EditableHotkey | null>(null);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    newChord: Chord;
    target: EditableHotkey;
    owner: EditableHotkey;
  } | null>(null);
  const [pending, setPending] = useState<Chord | null>(null);

  const eff = useMemo(
    () => (ctx ? ctx.chord : (id0: EditableHotkey) => getDefaultChord(id0)),
    [ctx]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [...HOTKEY_ROWS];
    return HOTKEY_ROWS.filter((r) => rowSearchText(r).includes(qq));
  }, [q]);

  const byCat = useMemo(() => {
    const m = new Map<string, HotkeyRow[]>();
    for (const r of filtered) {
      const a = m.get(r.category) ?? [];
      a.push(r);
      m.set(r.category, a);
    }
    return m;
  }, [filtered]);

  const applyOrConflict = useCallback(
    (target: EditableHotkey, c: Chord) => {
      if (!ctx) return;
      const owner = findDisplayConflictName(target, c, ctx.overrides);
      if (owner) {
        setPending(c);
        setConflict({ newChord: c, target, owner });
        return;
      }
      if (chordEquals(c, getDefaultChord(target))) {
        ctx.applyOverrides({ [target]: undefined });
        return;
      }
      ctx.applyOverrides({ [target]: c });
    },
    [ctx]
  );

  const confirmReassign = useCallback(() => {
    if (!ctx || !conflict) return;
    const r = previewReassignAnyway(conflict.target, conflict.newChord, ctx.overrides);
    if (r.status === "ok") {
      ctx.applyOverrides(r.nextOverrides);
      setConflict(null);
      setPending(null);
    } else {
      setBlockMsg(r.message);
      setConflict(null);
    }
  }, [ctx, conflict]);

  const cancelConflict = useCallback(() => {
    setConflict(null);
    setPending(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onK = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cap) {
          e.stopPropagation();
          e.preventDefault();
          setCap(null);
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onK, true);
    return () => window.removeEventListener("keydown", onK, true);
  }, [open, onClose, cap]);

  useEffect(() => {
    if (!open || !cap) return;
    const onC = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setCap(null);
        return;
      }
      const c = chordForCapture(e, cap);
      if (!c) return;
      applyOrConflict(cap, c);
      setCap(null);
    };
    window.addEventListener("keydown", onC, true);
    return () => window.removeEventListener("keydown", onC, true);
  }, [open, cap, applyOrConflict]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      id="openseer-hotkeys-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100" id={`${id}-title`}>
            Hotkeys
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {blockMsg ? (
          <div className="border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
            {blockMsg}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setBlockMsg(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {conflict && pending ? (
          <div className="border-b border-sky-900/40 bg-sky-950/30 px-4 py-3 text-xs text-sky-100">
            <p>
              {formatChordText(pending)} is already used by {ROW_LABEL[conflict.owner] ?? conflict.owner}.
            </p>
            <p className="mt-1 text-sky-200/90">Cancel or reassign: the other action reverts to its default when safe.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-zinc-200"
                onClick={cancelConflict}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-sky-600 bg-sky-900/60 px-2.5 py-1 text-sky-100"
                onClick={confirmReassign}
              >
                Reassign anyway
              </button>
            </div>
          </div>
        ) : null}

        <div className="shrink-0 border-b border-zinc-800 px-4 py-2">
          <input
            type="search"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-sky-600 focus:outline-none"
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {CATEGORY_ORDER.map((cat) => {
            const rows = byCat.get(cat);
            if (!rows?.length) return null;
            return (
              <div key={cat} className="mb-4">
                <h3 className="sticky top-0 z-[1] bg-zinc-900/95 py-1.5 pl-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {cat}
                </h3>
                <ul className="space-y-0.5">
                  {rows.map((r) => {
                    if (r.kind === "static") {
                      return (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-xs text-zinc-300"
                        >
                          <span className="min-w-0">{r.label}</span>
                          <span className="shrink-0 text-right text-zinc-400">
                            {r.rightLabel}
                          </span>
                        </li>
                      );
                    }
                    const cur = eff(r.id);
                    const capping = cap === r.id;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-xs text-zinc-300"
                      >
                        <span className="min-w-0">{r.label}</span>
                        {r.editable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCap(r.id);
                              setBlockMsg(null);
                            }}
                            className="inline-flex shrink-0 items-center justify-end gap-0.5 rounded border border-zinc-700/80 bg-zinc-950/80 px-1.5 py-0.5 text-left hover:border-zinc-500"
                            title="Click to change"
                          >
                            {capping ? (
                              <span className="text-amber-300/90">Press a key…</span>
                            ) : (
                              chordToKeycapLabels(cur).map((k) => (
                                <kbd
                                  key={k + r.id}
                                  className="rounded border border-zinc-600 bg-zinc-800 px-1.5 font-mono text-[10px] text-zinc-200"
                                >
                                  {k}
                                </kbd>
                              ))
                            )}
                          </button>
                        ) : (
                          <KeycapList c={cur} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-zinc-800 px-4 py-2.5">
          {ctx ? (
            <button
              type="button"
              onClick={() => {
                ctx.clearAllOverrides();
                setBlockMsg(null);
                setConflict(null);
                setCap(null);
              }}
              className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
            >
              Reset defaults
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KeycapList({ c }: { c: Chord }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-end gap-0.5">
      {chordToKeycapLabels(c).map((k) => (
        <kbd
          key={k + c.code + (c.usePrimary ? "p" : "")}
          className="rounded border border-zinc-600 bg-zinc-800 px-1.5 font-mono text-[10px] text-zinc-200"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
