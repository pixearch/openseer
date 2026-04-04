"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";

const TYPE_LABEL: Record<OpenSeerNodeType, string> = {
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
};

const ACCENT: Record<OpenSeerNodeType, string> = {
  proposal: "border-l-violet-500",
  program: "border-l-blue-500",
  project: "border-l-cyan-500",
  epic: "border-l-teal-500",
  sprint: "border-l-emerald-500",
  task: "border-l-green-500",
  step: "border-l-amber-500",
  howto: "border-l-sky-500",
  evidence: "border-l-orange-500",
  risk: "border-l-rose-500",
  cost: "border-l-yellow-600",
  decision: "border-l-indigo-500",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-zinc-500",
  active: "bg-emerald-500",
  blocked: "bg-rose-500",
  done: "bg-sky-500",
  archived: "bg-zinc-600",
};

function OpenSeerNodeInner({ data, selected }: NodeProps<Node<OpenSeerNodeData>>) {
  const accent = ACCENT[data.nodeType];
  const typeLabel = TYPE_LABEL[data.nodeType];
  const statusClass = STATUS_DOT[data.status] ?? "bg-zinc-500";

  const previewTags = data.tags.slice(0, 2);
  const moreTags = data.tags.length > 2 ? data.tags.length - 2 : 0;

  return (
    <div
      className={[
        "min-w-[220px] max-w-[280px] rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg backdrop-blur-sm",
        "border-l-[3px]",
        accent,
        selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
      />
      <div className="border-b border-zinc-800/80 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {typeLabel}
          </span>
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusClass}`}
            title={data.status}
          />
        </div>
        <div className="mt-1 font-medium leading-snug text-zinc-100">{data.title}</div>
      </div>
      <div className="space-y-2 px-3 py-2">
        {data.shortDescription ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">{data.shortDescription}</p>
        ) : (
          <p className="text-xs italic text-zinc-600">No description</p>
        )}
        {data.owner ? (
          <p className="text-[11px] text-zinc-500">
            <span className="text-zinc-600">Owner</span> {data.owner}
          </p>
        ) : null}
        {previewTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {previewTags.map((t) => (
              <span
                key={t}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                {t}
              </span>
            ))}
            {moreTags > 0 ? (
              <span className="text-[10px] text-zinc-600">+{moreTags}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
      />
    </div>
  );
}

export const OpenSeerNode = memo(OpenSeerNodeInner);
