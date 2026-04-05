import type { Edge, Node } from "@xyflow/react";
import { createEmptyNodeData } from "@/lib/default-node";
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

export function groupSelectedNodes(
  viewNodes: Node<OpenSeerNodeData>[],
  viewEdges: Edge<OpenSeerEdgeData>[],
  selectedIds: string[]
): { nodes: Node<OpenSeerNodeData>[]; edges: Edge<OpenSeerEdgeData>[] } | null {
  if (selectedIds.length < 2) return null;
  const set = new Set(selectedIds);
  const selected = viewNodes.filter((n) => set.has(n.id));
  if (selected.length < 2) return null;
  const xs = selected.map((n) => n.position.x);
  const ys = selected.map((n) => n.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const padX = 48;
  const padY = 56;
  const innerW = maxX - minX + 240;
  const innerH = maxY - minY + 120;
  const gid = `n-${crypto.randomUUID()}`;
  const nestedNodes = selected.map((n) => ({
    ...n,
    position: { x: n.position.x - minX + padX, y: n.position.y - minY + padY },
  }));
  const nestedEdges = viewEdges
    .filter((e) => set.has(e.source) && set.has(e.target))
    .map((e) => ({ ...e, id: `e-${crypto.randomUUID().slice(0, 12)}` }));
  const groupNode: Node<OpenSeerNodeData> = {
    id: gid,
    type: "openSeer",
    position: { x: minX - padX, y: minY - padY },
    style: { width: Math.max(innerW + padX * 2, 320), height: Math.max(innerH + padY, 200) },
    data: {
      ...createEmptyNodeData("group"),
      title: "Group",
      nestedGraph: { nodes: nestedNodes, edges: nestedEdges },
    },
  };
  const remainingNodes = viewNodes.filter((n) => !set.has(n.id));
  const remainingEdges = viewEdges.filter((e) => !set.has(e.source) && !set.has(e.target));
  return { nodes: [...remainingNodes, groupNode], edges: remainingEdges };
}
