import type { OpenSeerNodeType } from "@/lib/types/graph";

/** Human-readable labels for filters, sidebars, and node chrome */
export const NODE_TYPE_LABEL: Record<OpenSeerNodeType, string> = {
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
  frame: "Frame",
  group: "Group",
};

/** Left border accent (Tailwind classes) on canvas nodes */
export const NODE_TYPE_ACCENT_CLASS: Record<OpenSeerNodeType, string> = {
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
  image: "border-l-fuchsia-500",
  video: "border-l-cyan-400",
  frame: "border-l-slate-400",
  group: "border-l-teal-400",
};

/** MiniMap node fill colors */
export const NODE_TYPE_MINIMAP_COLOR: Record<OpenSeerNodeType, string> = {
  proposal: "#8b5cf6",
  program: "#3b82f6",
  project: "#06b6d4",
  epic: "#14b8a6",
  sprint: "#10b981",
  task: "#22c55e",
  step: "#f59e0b",
  howto: "#0ea5e9",
  evidence: "#f97316",
  risk: "#f43f5e",
  cost: "#ca8a04",
  decision: "#6366f1",
  image: "#a78bfa",
  video: "#38bdf8",
  frame: "#94a3b8",
  group: "#22d3ee",
};

export const DEFAULT_TITLE_BY_TYPE: Record<OpenSeerNodeType, string> = {
  proposal: "New proposal",
  program: "New program",
  project: "New project",
  epic: "New epic",
  sprint: "New sprint",
  task: "New task",
  step: "New step",
  howto: "New how-to",
  evidence: "New evidence",
  risk: "New risk",
  cost: "New cost",
  decision: "New decision",
  image: "New image",
  video: "New video",
  frame: "New frame",
  group: "New group",
};

export function minimapColorForNodeType(t: OpenSeerNodeType | undefined): string {
  return NODE_TYPE_MINIMAP_COLOR[t ?? "task"] ?? "#52525b";
}
