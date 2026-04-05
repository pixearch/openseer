import type { Edge, Node } from "@xyflow/react";
import {
  createEmptyNodeData,
  GROUP_STANDARD_HEIGHT,
  GROUP_STANDARD_WIDTH,
  NODE_STANDARD_HEIGHT,
  NODE_STANDARD_WIDTH,
} from "@/lib/default-node";
import { FRAME_HEADER_RESERVE_PX } from "@/lib/graph/frame-chrome";
import type { OpenSeerEdgeData, OpenSeerNodeData } from "@/lib/types/graph";

/**
 * @xyflow requires each parent before its children in `nodes`. Also stabilizes drag/resize updates.
 */
export function sortParentsBeforeChildren(
  nodes: Node<OpenSeerNodeData>[]
): Node<OpenSeerNodeData>[] {
  if (nodes.length <= 1) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();

  function depthOf(id: string, visiting: Set<string>): number {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) {
      memo.set(id, 0);
      return 0;
    }
    const n = byId.get(id);
    if (!n?.parentId || !byId.has(n.parentId)) {
      memo.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const d = 1 + depthOf(n.parentId, visiting);
    visiting.delete(id);
    memo.set(id, d);
    return d;
  }

  for (const n of nodes) {
    depthOf(n.id, new Set());
  }

  const orig = new Map(nodes.map((n, i) => [n.id, i]));
  const sorted = [...nodes].sort((a, b) => {
    const da = memo.get(a.id) ?? 0;
    const db = memo.get(b.id) ?? 0;
    if (da !== db) return da - db;
    return (orig.get(a.id) ?? 0) - (orig.get(b.id) ?? 0);
  });
  if (sorted.every((n, i) => n === nodes[i])) return nodes;
  return sorted;
}

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

function clampScalar(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** Keeps nodes parented under a frame below the header and inside the frame bounds. */
export function clampFrameChildrenPositions(
  nodes: Node<OpenSeerNodeData>[]
): Node<OpenSeerNodeData>[] {
  let changed = false;
  const out = nodes.map((node) => {
    if (!node.parentId) return node;
    const parent = nodes.find((p) => p.id === node.parentId);
    if (!parent || parent.data.nodeType !== "frame") return node;
    const { w: pw, h: ph } = sizeOf(parent);
    const { w: nw, h: nh } = sizeOf(node);
    const minY = FRAME_HEADER_RESERVE_PX;
    const maxX = Math.max(0, pw - nw);
    const maxY = Math.max(minY, ph - nh);
    const x = clampScalar(node.position.x, 0, maxX);
    const y = clampScalar(node.position.y, minY, maxY);
    if (x === node.position.x && y === node.position.y) return node;
    changed = true;
    return { ...node, position: { x, y } };
  });
  return changed ? out : nodes;
}

/** Applies {@link clampFrameChildrenPositions} at every graph level (root and inside group subgraphs). */
export function clampFrameChildrenEverywhere(
  nodes: Node<OpenSeerNodeData>[]
): Node<OpenSeerNodeData>[] {
  const clamped = clampFrameChildrenPositions(nodes);
  const top = sortParentsBeforeChildren(clamped);
  let any = top !== nodes;
  const mapped = top.map((n) => {
    if (n.data.nodeType !== "group" || !n.data.nestedGraph?.nodes?.length) return n;
    const inner = n.data.nestedGraph.nodes as Node<OpenSeerNodeData>[];
    const nextInner = clampFrameChildrenEverywhere(inner);
    if (nextInner === inner) return n;
    any = true;
    return {
      ...n,
      data: {
        ...n.data,
        nestedGraph: { ...n.data.nestedGraph!, nodes: nextInner },
      },
    };
  });
  return any ? mapped : nodes;
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
      title: "Group",
    },
  };

  const fr = { x: framePos.x, y: framePos.y, w: frameW, h: frameH };
  const others = viewNodes.filter((n) => !set.has(n.id));
  const pushed = others.map((n) => pushNodeOutsideFrame(viewNodes, n, fr, 16));

  const reparented = selected.map((n) => {
    const a = absPos(viewNodes, n);
    const { w: nw, h: nh } = sizeOf(n);
    const relX = a.x - framePos.x;
    let relY = a.y - framePos.y;
    relY = Math.max(relY, FRAME_HEADER_RESERVE_PX);
    const maxX = Math.max(0, frameW - nw);
    const maxY = Math.max(FRAME_HEADER_RESERVE_PX, frameH - nh);
    return {
      ...n,
      parentId: frameId,
      extent: "parent" as const,
      zIndex: 1,
      position: {
        x: clampScalar(relX, 0, maxX),
        y: clampScalar(relY, FRAME_HEADER_RESERVE_PX, maxY),
      },
    };
  });

  const merged = [...pushed, frameNode, ...reparented];
  return {
    nodes: sortParentsBeforeChildren(clampFrameChildrenPositions(merged)),
    edges: viewEdges,
  };
}

/** Removes a frame node and places its children at absolute positions on the canvas. */
export function ungroupFrame(
  viewNodes: Node<OpenSeerNodeData>[],
  viewEdges: Edge<OpenSeerEdgeData>[],
  frameId: string
): { nodes: Node<OpenSeerNodeData>[]; edges: Edge<OpenSeerEdgeData>[] } | null {
  const frame = viewNodes.find((n) => n.id === frameId);
  if (!frame || frame.data.nodeType !== "frame") return null;

  const children = viewNodes.filter((n) => n.parentId === frameId);
  const without = viewNodes.filter((n) => n.id !== frameId && n.parentId !== frameId);
  const freed = children.map((n) => {
    const a = absPos(viewNodes, n);
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      zIndex: undefined,
      position: { x: a.x, y: a.y },
    };
  });

  return { nodes: sortParentsBeforeChildren([...without, ...freed]), edges: viewEdges };
}

/** Moves one node out of its frame to absolute coordinates; removes an empty frame. */
export function ungroupNodeFromFrame(
  viewNodes: Node<OpenSeerNodeData>[],
  viewEdges: Edge<OpenSeerEdgeData>[],
  nodeId: string
): { nodes: Node<OpenSeerNodeData>[]; edges: Edge<OpenSeerEdgeData>[] } | null {
  const n = viewNodes.find((x) => x.id === nodeId);
  if (!n?.parentId) return null;
  const parent = viewNodes.find((x) => x.id === n.parentId);
  if (!parent || parent.data.nodeType !== "frame") return null;

  const a = absPos(viewNodes, n);
  const siblings = viewNodes.filter((x) => x.parentId === parent.id && x.id !== nodeId);

  const updated: Node<OpenSeerNodeData> = {
    ...n,
    parentId: undefined,
    extent: undefined,
    zIndex: undefined,
    position: { x: a.x, y: a.y },
  };

  let nodes = viewNodes.map((x) => (x.id === nodeId ? updated : x));
  if (siblings.length === 0) {
    nodes = nodes.filter((x) => x.id !== parent.id);
  }

  return { nodes: sortParentsBeforeChildren(nodes), edges: viewEdges };
}
