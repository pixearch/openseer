import type { OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";
import { DEFAULT_TITLE_BY_TYPE } from "@/lib/node-type-meta";

export { DEFAULT_TITLE_BY_TYPE } from "@/lib/node-type-meta";

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
