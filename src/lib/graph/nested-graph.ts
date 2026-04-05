import type { Edge, Node } from "@xyflow/react";
import {
  createEmptyNodeData,
  GROUP_STANDARD_HEIGHT,
  GROUP_STANDARD_WIDTH,
  NODE_STANDARD_HEIGHT,
  NODE_STANDARD_WIDTH,
} from "@/lib/default-node";
import type { OpenSeerEdgeData, OpenSeerNodeData } from "@/lib/types/graph";

export function getViewGraph(
  rootNodes: Node<OpenSeerNodeData>[],
  rootEdges: Edge<OpenSeerEdgeData>[],
  path: string[]
): { nodes: Node<OpenSeerNodeData>[]; edges: Edge<OpenSeerEdgeData>[] } {
  if (path.length === 0) return { nodes: rootNodes, edges: rootEdges };
  let nodes = rootNodes;
  let edges = rootEdges;
  for (const id of path) {
    const gn = nodes.find((x) => x.id === id);
    if (!gn || gn.data.nodeType !== "group") return { nodes: [], edges: [] };
    const ng = gn.data.nestedGraph ?? { nodes: [], edges: [] };
    nodes = ng.nodes as Node<OpenSeerNodeData>[];
    edges = ng.edges as Edge<OpenSeerEdgeData>[];
  }
  return { nodes, edges };
}

export function patchNestedGraph(
  nodes: Node<OpenSeerNodeData>[],
  path: string[],
  nextNodes: Node<OpenSeerNodeData>[],
  nextEdges: Edge<OpenSeerEdgeData>[]
): Node<OpenSeerNodeData>[] {
  if (path.length === 0) return nextNodes;
  const [head, ...tail] = path;
  return nodes.map((n) => {
    if (n.id !== head) return n;
    const ng = (n.data.nestedGraph ?? { nodes: [], edges: [] }) as {
      nodes: Node<OpenSeerNodeData>[];
      edges: Edge<OpenSeerEdgeData>[];
    };
    if (tail.length === 0) {
      return {
        ...n,
        data: {
          ...n.data,
          nestedGraph: { nodes: nextNodes, edges: nextEdges },
        },
      };
    }
    return {
      ...n,
      data: {
        ...n.data,
        nestedGraph: {
          nodes: patchNestedGraph(ng.nodes, tail, nextNodes, nextEdges),
          edges: ng.edges,
        },
      },
    };
  });
}

export function titlesAlongPath(
  rootNodes: Node<OpenSeerNodeData>[],
  path: string[]
): string[] {
  const titles: string[] = [];
  let nodes = rootNodes;
  for (const id of path) {
    const n = nodes.find((x) => x.id === id);
    if (!n) break;
    titles.push(n.data.title);
    if (n.data.nodeType === "group" && n.data.nestedGraph) {
      nodes = n.data.nestedGraph.nodes as Node<OpenSeerNodeData>[];
    }
  }
  return titles;
}

function sizeOf(n: Node<OpenSeerNodeData>): { w: number; h: number } {
  const w =
    typeof n.width === "number"
      ? n.width
      : n.data.nodeType === "group"
        ? GROUP_STANDARD_WIDTH
        : NODE_STANDARD_WIDTH;
  const h =
    typeof n.height === "number"
      ? n.height
      : n.data.nodeType === "group"
        ? GROUP_STANDARD_HEIGHT
        : NODE_STANDARD_HEIGHT;
  return { w, h };
}

function absPos(
  nodes: Node<OpenSeerNodeData>[],
  n: Node<OpenSeerNodeData>
): { x: number; y: number } {
  if (!n.parentId) return { x: n.position.x, y: n.position.y };
  const p = nodes.find((x) => x.id === n.parentId);
  if (!p) return { x: n.position.x, y: n.position.y };
  const pb = absPos(nodes, p);
  return { x: pb.x + n.position.x, y: pb.y + n.position.y };
}

function nodeBounds(
  nodes: Node<OpenSeerNodeData>[],
  n: Node<OpenSeerNodeData>
): { x: number; y: number; x2: number; y2: number } {
  const { x, y } = absPos(nodes, n);
  const { w, h } = sizeOf(n);
  return { x, y, x2: x + w, y2: y + h };
}

function rectOverlapsFrame(
  b: { x: number; y: number; x2: number; y2: number },
  fr: { x: number; y: number; w: number; h: number }
): boolean {
  const fx2 = fr.x + fr.w;
  const fy2 = fr.y + fr.h;
  return !(b.x2 <= fr.x || b.x >= fx2 || b.y2 <= fr.y || b.y >= fy2);
}

function pushNodeOutsideFrame(
  all: Node<OpenSeerNodeData>[],
  n: Node<OpenSeerNodeData>,
  fr: { x: number; y: number; w: number; h: number },
  pad: number
): Node<OpenSeerNodeData> {
  const b = nodeBounds(all, n);
  if (!rectOverlapsFrame(b, fr)) return n;
  const fx2 = fr.x + fr.w;
  const fy2 = fr.y + fr.h;
  const deltas = [
    { dx: fx2 + pad - b.x, dy: 0 },
    { dx: fr.x - pad - b.x2, dy: 0 },
    { dx: 0, dy: fy2 + pad - b.y },
    { dx: 0, dy: fr.y - pad - b.y2 },
  ];
  let best = deltas[0];
  let bestM = Math.hypot(best.dx, best.dy);
  for (const d of deltas) {
    const m = Math.hypot(d.dx, d.dy);
    if (m < bestM) {
      best = d;
      bestM = m;
    }
  }
  const a = absPos(all, n);
  const nextAbs = { x: a.x + best.dx, y: a.y + best.dy };
  if (!n.parentId) {
    return { ...n, position: nextAbs };
  }
  const p = all.find((x) => x.id === n.parentId);
  if (!p) {
    return { ...n, position: nextAbs };
  }
  const pAbs = absPos(all, p);
  return {
    ...n,
    position: { x: nextAbs.x - pAbs.x, y: nextAbs.y - pAbs.y },
  };
}

/**
 * Wraps the selection in a `frame` parent so nodes stay visible and move together.
 * Overlapping nodes that are not selected are nudged outside the frame bounds.
 */
export function groupSelectedNodes(
  viewNodes: Node<OpenSeerNodeData>[],
  viewEdges: Edge<OpenSeerEdgeData>[],
  selectedIds: string[]
): { nodes: Node<OpenSeerNodeData>[]; edges: Edge<OpenSeerEdgeData>[] } | null {
  if (selectedIds.length < 2) return null;
  const set = new Set(selectedIds);
  const selected = viewNodes.filter((n) => set.has(n.id));
  if (selected.length < 2) return null;

  const pad = 32;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of selected) {
    const b = nodeBounds(viewNodes, n);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x2);
    maxY = Math.max(maxY, b.y2);
  }
  const framePos = { x: minX - pad, y: minY - pad };
  const frameW = maxX - minX + pad * 2;
  const frameH = maxY - minY + pad * 2;
  const frameId = `n-${crypto.randomUUID()}`;

  const frameNode: Node<OpenSeerNodeData> = {
    id: frameId,
    type: "openSeer",
    position: framePos,
    width: frameW,
    height: frameH,
    zIndex: 0,
    style: { width: frameW, height: frameH },
    data: {
      ...createEmptyNodeData("frame"),
      title: "Frame",
    },
  };

  const fr = { x: framePos.x, y: framePos.y, w: frameW, h: frameH };
  const others = viewNodes.filter((n) => !set.has(n.id));
  const pushed = others.map((n) => pushNodeOutsideFrame(viewNodes, n, fr, 16));

  const reparented = selected.map((n) => {
    const a = absPos(viewNodes, n);
    return {
      ...n,
      parentId: frameId,
      extent: "parent" as const,
      zIndex: 1,
      position: { x: a.x - framePos.x, y: a.y - framePos.y },
    };
  });

  return { nodes: [...pushed, frameNode, ...reparented], edges: viewEdges };
}
