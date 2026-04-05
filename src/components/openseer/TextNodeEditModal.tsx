"use client";

import type { Node } from "@xyflow/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { OpenSeerNodeData } from "@/lib/types/graph";

export function TextNodeEditModal({
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
  const open = Boolean(nodeId && node?.data.nodeType === "text");
  const text = node?.data.nodeType === "text" ? (node.data.shortDescription ?? "") : "";

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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/80 p-6"
      role="dialog"
      aria-modal
      aria-label="Edit text"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">Edit text</h2>
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <textarea
          className="min-h-[min(70vh,480px)] w-full resize-y rounded border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          value={text}
          onChange={(e) => onPatchNode(nodeId!, { shortDescription: e.target.value })}
          placeholder="Enter text…"
          autoFocus
        />
      </div>
    </div>,
    document.body
  );
}
