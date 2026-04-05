"use client";

import type { Node } from "@xyflow/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CodeEditorTextarea } from "@/components/openseer/CodeEditorTextarea";
import {
  copyAllCodeBlocks,
  newCodeBlockId,
  normalizeCodeBlocksForDisplay,
} from "@/lib/code-blocks";
import type { CodeBlockEntry, OpenSeerNodeData } from "@/lib/types/graph";

export function CodeNodeEditModal({
  nodeId,
  nodes,
  onPatchNode,
  onClose,
}: {
  nodeId: string | null;
  nodes: Node<OpenSeerNodeData>[];
  onPatchNode: (id: string, patch: Partial<OpenSeerNodeData>) => void;
  onClose: () => void;
}) {
  const node = nodeId ? nodes.find((n) => n.id === nodeId) : undefined;
  const open = Boolean(nodeId && node?.data.nodeType === "code");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !nodeId || !node) return null;

  const blocks = normalizeCodeBlocksForDisplay(node.id, node.data.codeBlocks);

  const updateBlocks = (next: CodeBlockEntry[]) => {
    onPatchNode(nodeId, { codeBlocks: next });
  };

  const reorderBefore = (dragId: string, beforeId: string) => {
    const b = [...blocks];
    const item = b.find((x) => x.id === dragId);
    if (!item) return;
    const filtered = b.filter((x) => x.id !== dragId);
    const idx = filtered.findIndex((x) => x.id === beforeId);
    if (idx === -1) filtered.push(item);
    else filtered.splice(idx, 0, item);
    updateBlocks(filtered);
  };

  const reorderToEnd = (dragId: string) => {
    const b = [...blocks];
    const item = b.find((x) => x.id === dragId);
    if (!item) return;
    updateBlocks([...b.filter((x) => x.id !== dragId), item]);
  };

  const copyAll = () => void navigator.clipboard.writeText(copyAllCodeBlocks(blocks));

  return createPortal(
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/80 p-6"
      role="dialog"
      aria-modal
      aria-label="Edit code"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(92vh,860px)] w-full max-w-4xl flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">Edit code</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              onClick={() => void copyAll()}
            >
              Copy all
            </button>
            <button
              type="button"
              className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {blocks.map((block) => (
            <div
              key={block.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dragId = e.dataTransfer.getData("text/cb-id");
                if (!dragId || dragId === block.id) return;
                reorderBefore(dragId, block.id);
              }}
              className="flex gap-2 rounded-md border border-zinc-800 bg-zinc-950/80 p-2"
            >
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/cb-id", block.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="mt-1 h-8 w-6 shrink-0 cursor-grab rounded border border-zinc-700 bg-zinc-900 text-[10px] leading-none text-zinc-500 hover:bg-zinc-800 active:cursor-grabbing"
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                ⋮
                <br />
                ⋮
              </button>
              <div className="min-w-0 flex-1">
                <CodeEditorTextarea
                  value={block.content}
                  onChange={(content) => {
                    const next = blocks.map((b) =>
                      b.id === block.id ? { ...b, content } : b
                    );
                    updateBlocks(next);
                  }}
                  className="min-h-[120px] w-full resize-y rounded border border-zinc-700 bg-zinc-950/90 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="Code…"
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  className="rounded border border-zinc-600 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Copy block"
                  aria-label="Copy block"
                  onClick={() => void navigator.clipboard.writeText(block.content)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-600 p-1.5 text-zinc-400 hover:bg-rose-950/60 hover:text-rose-200 disabled:opacity-40"
                  title="Delete block"
                  aria-label="Delete block"
                  disabled={blocks.length <= 1}
                  onClick={() => {
                    if (blocks.length <= 1) return;
                    updateBlocks(blocks.filter((b) => b.id !== block.id));
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <div
            className="rounded border border-dashed border-transparent py-2 text-center text-[10px] text-zinc-600 hover:border-zinc-700"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dragId = e.dataTransfer.getData("text/cb-id");
              if (!dragId) return;
              reorderToEnd(dragId);
            }}
          >
            Drop here to move to end
          </div>
        </div>
        <button
          type="button"
          className="w-full rounded border border-dashed border-zinc-600 py-2 text-xs font-medium text-zinc-400 hover:border-emerald-700 hover:bg-zinc-800/50 hover:text-zinc-200"
          onClick={() => updateBlocks([...blocks, { id: newCodeBlockId(), content: "" }])}
        >
          + Add block
        </button>
      </div>
    </div>,
    document.body
  );
}
