"use client";

import "@xyflow/react/dist/style.css";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Edge, EdgeChange, Node, NodeChange } from "@xyflow/react";
import { createGitOnboardingSeed, SEED_GRAPH_ID, SEED_GRAPH_NAME } from "@/data/seed-git-onboarding";
import { createEmptyNodeData } from "@/lib/default-node";
import {
  documentFromState,
  loadGraphDocument,
  saveGraphDocument,
} from "@/lib/services/graph-storage";
import type { OpenSeerEdgeData, OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";
import { OPEN_SEER_NODE_TYPES } from "@/lib/types/graph";
import { GraphSidebar } from "@/components/openseer/GraphSidebar";
import { InspectorPanel } from "@/components/openseer/InspectorPanel";
import { OpenSeerNode } from "@/components/openseer/OpenSeerNode";

const nodeTypes = { openSeer: OpenSeerNode };

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b", width: 18, height: 18 },
  style: { stroke: "#64748b", strokeWidth: 1.5 },
};

function minimapNodeColor(n: Node<OpenSeerNodeData>) {
  const t = n.data?.nodeType;
  const map: Partial<Record<OpenSeerNodeType, string>> = {
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
  };
  return map[t ?? "task"] ?? "#52525b";
}

function GraphWorkspaceInner() {
  const flowAreaRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [ready, setReady] = useState(false);
  const [graphMeta, setGraphMeta] = useState({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
  const [nodes, setNodes] = useState<Node<OpenSeerNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<OpenSeerEdgeData>[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<Set<OpenSeerNodeType>>(
    () => new Set(OPEN_SEER_NODE_TYPES)
  );
  const [selection, setSelection] = useState<{ nodeId: string | null; edgeId: string | null }>({
    nodeId: null,
    edgeId: null,
  });

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const saved = loadGraphDocument();
      if (saved) {
        setNodes(saved.nodes as Node<OpenSeerNodeData>[]);
        setEdges(saved.edges as Edge<OpenSeerEdgeData>[]);
        setGraphMeta({ id: saved.id, name: saved.name });
      } else {
        const seed = createGitOnboardingSeed();
        setNodes(seed.nodes);
        setEdges(seed.edges);
        setGraphMeta({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
        saveGraphDocument(
          documentFromState(SEED_GRAPH_NAME, SEED_GRAPH_ID, seed.nodes, seed.edges)
        );
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      saveGraphDocument(documentFromState(graphMeta.name, graphMeta.id, nodes, edges));
    }, 400);
    return () => window.clearTimeout(t);
  }, [nodes, edges, graphMeta, ready]);

  const initialFitDone = useRef(false);
  useEffect(() => {
    if (!ready || initialFitDone.current || nodes.length === 0) return;
    initialFitDone.current = true;
    const id = window.requestAnimationFrame(() => {
      fitView({ padding: 0.12, maxZoom: 1.15, duration: 200 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [ready, nodes.length, fitView]);

  const onNodesChange = useCallback((changes: NodeChange<Node<OpenSeerNodeData>>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge<OpenSeerEdgeData>>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID().slice(0, 8)}`;
    const next: Edge<OpenSeerEdgeData> = {
      ...connection,
      id,
      label: "relates_to",
      data: { label: "relates_to", relationshipType: "relates_to" },
    };
    setEdges((eds) => addEdge(next, eds));
  }, []);

  const onSelectionChange = useCallback(
    ({ nodes: sn, edges: se }: { nodes: Node[]; edges: Edge[] }) => {
      if (sn.length === 1) {
        setSelection({ nodeId: sn[0].id, edgeId: null });
      } else if (se.length === 1) {
        setSelection({ nodeId: null, edgeId: se[0].id });
      } else {
        setSelection({ nodeId: null, edgeId: null });
      }
    },
    []
  );

  const onNodesDelete = useCallback((deleted: Node<OpenSeerNodeData>[]) => {
    setSelection((s) =>
      s.nodeId && deleted.some((n) => n.id === s.nodeId)
        ? { nodeId: null, edgeId: null }
        : s
    );
  }, []);

  const onEdgesDelete = useCallback((deleted: Edge<OpenSeerEdgeData>[]) => {
    setSelection((s) =>
      s.edgeId && deleted.some((e) => e.id === s.edgeId)
        ? { nodeId: null, edgeId: null }
        : s
    );
  }, []);

  const flowNodes = useMemo(
    () => nodes.filter((n) => visibleTypes.has(n.data.nodeType)),
    [nodes, visibleTypes]
  );

  const flowEdges = useMemo(
    () =>
      edges.filter((e) => {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        return (
          !!s &&
          !!t &&
          visibleTypes.has(s.data.nodeType) &&
          visibleTypes.has(t.data.nodeType)
        );
      }),
    [edges, nodes, visibleTypes]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selection.nodeId) ?? null,
    [nodes, selection.nodeId]
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selection.edgeId) ?? null,
    [edges, selection.edgeId]
  );

  const onPatchNode = useCallback((id: string, patch: Partial<OpenSeerNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }, []);

  const onPatchEdge = useCallback((id: string, next: OpenSeerEdgeData) => {
    setEdges((eds) =>
      eds.map((e) => (e.id === id ? { ...e, label: next.label, data: next } : e))
    );
  }, []);

  const onDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelection({ nodeId: null, edgeId: null });
  }, []);

  const onDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelection({ nodeId: null, edgeId: null });
  }, []);

  const onToggleType = useCallback((t: OpenSeerNodeType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const onShowAllTypes = useCallback(() => {
    setVisibleTypes(new Set(OPEN_SEER_NODE_TYPES));
  }, []);

  const onLoadDemo = useCallback(() => {
    const seed = createGitOnboardingSeed();
    setNodes(seed.nodes);
    setEdges(seed.edges);
    setGraphMeta({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
    setSelection({ nodeId: null, edgeId: null });
    window.setTimeout(() => fitView({ padding: 0.12, maxZoom: 1.15, duration: 200 }), 60);
  }, [fitView]);

  const onNewBlank = useCallback(() => {
    const id = crypto.randomUUID();
    setNodes([]);
    setEdges([]);
    setGraphMeta({ id, name: "Untitled graph" });
    setSelection({ nodeId: null, edgeId: null });
  }, []);

  const onAddNode = useCallback(
    (nodeType: OpenSeerNodeType) => {
      const el = flowAreaRef.current;
      const rect = el?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const position = screenToFlowPosition({ x, y });
      const id = `n-${crypto.randomUUID()}`;
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "openSeer",
          position: {
            x: position.x + (Math.random() - 0.5) * 100,
            y: position.y + (Math.random() - 0.5) * 100,
          },
          data: createEmptyNodeData(nodeType),
        },
      ]);
    },
    [screenToFlowPosition]
  );

  return (
    <div className="flex h-full min-h-0 flex-1">
      <GraphSidebar
        graphName={graphMeta.name}
        visibleTypes={visibleTypes}
        onToggleType={onToggleType}
        onShowAllTypes={onShowAllTypes}
        onLoadDemo={onLoadDemo}
        onNewBlank={onNewBlank}
        onAddNode={onAddNode}
      />
      <div ref={flowAreaRef} className="relative min-h-0 min-w-0 flex-1 bg-[#0c0c0e]">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-[#0c0c0e]"
        >
          <Background
            id="os-grid"
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#27272a"
          />
          <Controls
            className="!m-3 !border !border-zinc-700 !bg-zinc-900/95 !shadow-lg [&_button]:!border-zinc-700 [&_button]:!bg-zinc-900 [&_button]:!text-zinc-200 [&_button:hover]:!bg-zinc-800"
            showInteractive={false}
          />
          <MiniMap
            className="!m-3 !rounded-md !border !border-zinc-700 !bg-zinc-900/90"
            nodeStrokeWidth={2}
            nodeColor={minimapNodeColor}
            maskColor="rgb(12, 12, 14, 0.85)"
          />
        </ReactFlow>
      </div>
      <InspectorPanel
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        onPatchNode={onPatchNode}
        onPatchEdge={onPatchEdge}
        onDeleteNode={onDeleteNode}
        onDeleteEdge={onDeleteEdge}
      />
    </div>
  );
}

export function GraphWorkspacePage() {
  return (
    <ReactFlowProvider>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <GraphWorkspaceInner />
      </div>
    </ReactFlowProvider>
  );
}
