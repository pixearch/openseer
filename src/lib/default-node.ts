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
};

export function createEmptyNodeData(nodeType: OpenSeerNodeType): OpenSeerNodeData {
  return {
    nodeType,
    title: DEFAULT_TITLE_BY_TYPE[nodeType],
    shortDescription: "",
    status: "draft",
    owner: "",
    tags: [],
    notes: "",
  };
}
