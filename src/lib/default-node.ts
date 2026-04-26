import type { OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";
import { DEFAULT_TITLE_BY_TYPE } from "@/lib/node-type-meta";

export { DEFAULT_TITLE_BY_TYPE } from "@/lib/node-type-meta";

/** Default node box size (also minimum when resizing). */
export const NODE_STANDARD_WIDTH = 260;
export const NODE_STANDARD_HEIGHT = 180;

export const GROUP_STANDARD_WIDTH = 320;
export const GROUP_STANDARD_HEIGHT = 200;

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
  if (nodeType === "code") {
    base.codeBlocks = [{ id: crypto.randomUUID(), content: "" }];
  }
  if (nodeType === "hub") {
    base.hubSides = 6;
  }
  if (nodeType === "circle") {
    base.circlePointCount = 1;
    base.circleRotationDeg = 0;
  }
  return base;
}
