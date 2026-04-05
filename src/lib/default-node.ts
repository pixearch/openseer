import type { OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";

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
  group: "New group",
};

export function createEmptyNodeData(nodeType: OpenSeerNodeType): OpenSeerNodeData {
  const base: OpenSeerNodeData = {
    nodeType,
    title: DEFAULT_TITLE_BY_TYPE[nodeType],
    shortDescription: "",
    status: "draft",
    owner: "",
    tags: [],
    notes: "",
  };
  if (nodeType === "group") {
    base.nestedGraph = { nodes: [], edges: [] };
  }
  return base;
}
