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
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Connection, Edge, EdgeChange, Node, NodeChange, NodeMouseHandler } from "@xyflow/react";
import { GraphSidebar } from "@/components/openseer/GraphSidebar";
import { InspectorPanel } from "@/components/openseer/InspectorPanel";
import { OpenSeerNode } from "@/components/openseer/OpenSeerNode";
import { createGitOnboardingSeed, SEED_GRAPH_ID, SEED_GRAPH_NAME } from "@/data/seed-git-onboarding";
import {
  createEmptyNodeData,
  GROUP_STANDARD_HEIGHT,
  GROUP_STANDARD_WIDTH,
  NODE_STANDARD_HEIGHT,
  NODE_STANDARD_WIDTH,
} from "@/lib/default-node";
import {
  clampFrameChildrenEverywhere,
  clampFrameChildrenPositions,
  getViewGraph,
  groupSelectedNodes,
  patchNestedGraph,
  titlesAlongPath,
  ungroupFrame,
  ungroupNodeFromFrame,
} from "@/lib/graph/nested-graph";
import { minimapColorForNodeType, NODE_TYPE_LABEL } from "@/lib/node-type-meta";
import {
  documentFromState,
  loadGraphDocument,
  saveGraphDocument,
} from "@/lib/services/graph-storage";
import { clampFixedMenuPosition } from "@/lib/ui/clamp-context-menu";
import type { OpenSeerEdgeData, OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";
import { OPEN_SEER_NODE_TYPES } from "@/lib/types/graph";

const nodeTypes = { openSeer: OpenSeerNode };

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b", width: 18, height: 18 },
  style: { stroke: "#64748b", strokeWidth: 1.5 },
};

const CTX_MENU_W = 208;
const CTX_MENU_H_PANE = 420;
const CTX_MENU_H_NODES = 220;

type CtxMenu =
  | {
      kind: "pane";
      clientX: number;
      clientY: number;
      flowX: number;
      flowY: number;
    }
  | {
      kind: "nodes";
      clientX: number;
      clientY: number;
      selectedIds: string[];
      /** Node that was right-clicked (or first of a multi-selection). */
      anchorNodeId: string;
    };

function GraphWorkspaceInner() {
  const flowAreaRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();

  const [ready, setReady] = useState(false);
  const [graphMeta, setGraphMeta] = useState({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
  const [doc, setDoc] = useState<{
    nodes: Node<OpenSeerNodeData>[];
    edges: Edge<OpenSeerEdgeData>[];
  }>({ nodes: [], edges: [] });
  const [groupPath, setGroupPath] = useState<string[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<OpenSeerNodeType>>(
    () => new Set(OPEN_SEER_NODE_TYPES)
  );
  const [selection, setSelection] = useState<{ nodeId: string | null; edgeId: string | null }>({
    nodeId: null,
    edgeId: null,
  });

  const groupPathKey = groupPath.join("|");

  const view = useMemo(
    () => getViewGraph(doc.nodes, doc.edges, groupPath),
    [doc.nodes, doc.edges, groupPath]
  );

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const saved = loadGraphDocument();
      if (saved) {
        setDoc({
          nodes: clampFrameChildrenEverywhere(saved.nodes as Node<OpenSeerNodeData>[]),
          edges: saved.edges as Edge<OpenSeerEdgeData>[],
        });
        setGraphMeta({ id: saved.id, name: saved.name });
      } else {
        const seed = createGitOnboardingSeed();
        setDoc({
          nodes: clampFrameChildrenEverywhere(seed.nodes),
          edges: seed.edges,
        });
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
      saveGraphDocument(documentFromState(graphMeta.name, graphMeta.id, doc.nodes, doc.edges));
    }, 400);
    return () => window.clearTimeout(t);
  }, [doc.nodes, doc.edges, graphMeta, ready]);

  const initialFitDone = useRef(false);
  useEffect(() => {
    initialFitDone.current = false;
  }, [groupPathKey]);

  useEffect(() => {
    if (!ready || initialFitDone.current || view.nodes.length === 0) return;
    initialFitDone.current = true;
    const id = window.requestAnimationFrame(() => {
      fitView({ padding: 0.12, maxZoom: 1.15, duration: 200 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [ready, view.nodes.length, fitView, groupPathKey]);

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<OpenSeerNodeData>>[]) => {
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const nn = applyNodeChanges(changes, v.nodes);
        const clamped = clampFrameChildrenPositions(nn);
        if (groupPath.length === 0) return { nodes: clamped, edges: d.edges };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, clamped, v.edges),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge<OpenSeerEdgeData>>[]) => {
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const ne = applyEdgeChanges(changes, v.edges);
        if (groupPath.length === 0) return { nodes: d.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, v.nodes, ne),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID().slice(0, 8)}`;
      const next: Edge<OpenSeerEdgeData> = {
        ...connection,
        id,
        label: "relates_to",
        data: { label: "relates_to", relationshipType: "relates_to" },
      };
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const ne = addEdge(next, v.edges);
        if (groupPath.length === 0) return { nodes: d.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, v.nodes, ne),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

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
    () => view.nodes.filter((n) => visibleTypes.has(n.data.nodeType)),
    [view.nodes, visibleTypes]
  );

  const flowEdges = useMemo(() => {
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    return view.edges.filter((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      return (
        s !== undefined &&
        t !== undefined &&
        visibleTypes.has(s.data.nodeType) &&
        visibleTypes.has(t.data.nodeType)
      );
    });
  }, [view.edges, view.nodes, visibleTypes]);

  const selectedNode = useMemo(
    () => view.nodes.find((n) => n.id === selection.nodeId) ?? null,
    [view.nodes, selection.nodeId]
  );

  const selectedEdge = useMemo(
    () => view.edges.find((e) => e.id === selection.edgeId) ?? null,
    [view.edges, selection.edgeId]
  );

  const onPatchNode = useCallback(
    (id: string, patch: Partial<OpenSeerNodeData>) => {
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const nn = v.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        );
        if (groupPath.length === 0) return { nodes: nn, edges: d.edges };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, nn, v.edges),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

  const onPatchEdge = useCallback(
    (id: string, next: OpenSeerEdgeData) => {
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const ne = v.edges.map((e) => (e.id === id ? { ...e, label: next.label, data: next } : e));
        if (groupPath.length === 0) return { nodes: d.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, v.nodes, ne),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const nn = v.nodes.filter((n) => n.id !== id);
        const ne = v.edges.filter((e) => e.source !== id && e.target !== id);
        if (groupPath.length === 0) return { nodes: nn, edges: ne };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, nn, ne),
          edges: d.edges,
        };
      });
      setSelection({ nodeId: null, edgeId: null });
    },
    [groupPath]
  );

  const onDeleteEdge = useCallback(
    (id: string) => {
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const ne = v.edges.filter((e) => e.id !== id);
        if (groupPath.length === 0) return { nodes: d.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, v.nodes, ne),
          edges: d.edges,
        };
      });
      setSelection({ nodeId: null, edgeId: null });
    },
    [groupPath]
  );

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
    setDoc({ nodes: clampFrameChildrenEverywhere(seed.nodes), edges: seed.edges });
    setGraphMeta({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
    setGroupPath([]);
    setSelection({ nodeId: null, edgeId: null });
    initialFitDone.current = false;
    window.setTimeout(() => fitView({ padding: 0.12, maxZoom: 1.15, duration: 200 }), 60);
  }, [fitView]);

  const onNewBlank = useCallback(() => {
    const id = crypto.randomUUID();
    setDoc({ nodes: [], edges: [] });
    setGraphMeta({ id, name: "Untitled graph" });
    setGroupPath([]);
    setSelection({ nodeId: null, edgeId: null });
  }, []);

  const onAddNodeAt = useCallback(
    (nodeType: OpenSeerNodeType, position: { x: number; y: number }) => {
      const id = `n-${crypto.randomUUID()}`;
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const isGroup = nodeType === "group";
        const nextNodes = [
          ...v.nodes,
          {
            id,
            type: "openSeer" as const,
            position: {
              x: position.x + (Math.random() - 0.5) * 80,
              y: position.y + (Math.random() - 0.5) * 80,
            },
            data: createEmptyNodeData(nodeType),
            width: isGroup ? GROUP_STANDARD_WIDTH : NODE_STANDARD_WIDTH,
            height: isGroup ? GROUP_STANDARD_HEIGHT : NODE_STANDARD_HEIGHT,
          },
        ];
        if (groupPath.length === 0) return { nodes: nextNodes, edges: d.edges };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, nextNodes, v.edges),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

  const onAddNode = useCallback(
    (nodeType: OpenSeerNodeType) => {
      const el = flowAreaRef.current;
      const rect = el?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const position = screenToFlowPosition({ x, y });
      onAddNodeAt(nodeType, position);
    },
    [screenToFlowPosition, onAddNodeAt]
  );

  const openPaneContextMenu = useCallback(
    (e: ReactMouseEvent<Element> | globalThis.MouseEvent) => {
      e.preventDefault();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCtxMenu({
        kind: "pane",
        clientX: e.clientX,
        clientY: e.clientY,
        flowX: p.x,
        flowY: p.y,
      });
    },
    [screenToFlowPosition]
  );

  const onFlowContextMenuCapture = useCallback((e: ReactMouseEvent<Element>) => {
    e.preventDefault();
  }, []);

  const onFlowContextMenu = useCallback(
    (e: ReactMouseEvent<Element>) => {
      const t = e.target as Element;
      if (t.closest(".react-flow__node")) return;
      if (t.closest(".react-flow__nodesselection-rect")) return;
      if (t.closest(".react-flow__edge")) return;
      if (t.closest(".react-flow__pane")) {
        openPaneContextMenu(e);
      }
    },
    [openPaneContextMenu]
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (e, node) => {
      e.preventDefault();
      const sel = getNodes().filter((n) => n.selected);
      const selectedIds =
        sel.length > 0 ? sel.map((n) => n.id) : [node.id];
      setCtxMenu({
        kind: "nodes",
        clientX: e.clientX,
        clientY: e.clientY,
        selectedIds,
        anchorNodeId: node.id,
      });
    },
    [getNodes]
  );

  const onSelectionContextMenu = useCallback(
    (e: ReactMouseEvent<Element>, nodes: Node<OpenSeerNodeData>[]) => {
      e.preventDefault();
      const selectedIds = nodes.map((n) => n.id);
      setCtxMenu({
        kind: "nodes",
        clientX: e.clientX,
        clientY: e.clientY,
        selectedIds,
        anchorNodeId: selectedIds[0] ?? "",
      });
    },
    []
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      if (node.data.nodeType === "group") {
        setGroupPath((p) => [...p, node.id]);
        setSelection({ nodeId: null, edgeId: null });
        initialFitDone.current = false;
      }
    },
    []
  );

  const runGroupSelection = useCallback(() => {
    if (!ctxMenu || ctxMenu.kind !== "nodes") return;
    const ids = ctxMenu.selectedIds;
    setCtxMenu(null);
    setDoc((d) => {
      const v = getViewGraph(d.nodes, d.edges, groupPath);
      const g = groupSelectedNodes(v.nodes, v.edges, ids);
      if (!g) return d;
      if (groupPath.length === 0) return { nodes: g.nodes, edges: g.edges };
      return {
        nodes: patchNestedGraph(d.nodes, groupPath, g.nodes, g.edges),
        edges: d.edges,
      };
    });
  }, [ctxMenu, groupPath]);

  const runUngroupAll = useCallback(() => {
    if (!ctxMenu || ctxMenu.kind !== "nodes") return;
    const frameId = ctxMenu.anchorNodeId;
    setCtxMenu(null);
    setDoc((d) => {
      const v = getViewGraph(d.nodes, d.edges, groupPath);
      const u = ungroupFrame(v.nodes, v.edges, frameId);
      if (!u) return d;
      if (groupPath.length === 0) return { nodes: u.nodes, edges: u.edges };
      return {
        nodes: patchNestedGraph(d.nodes, groupPath, u.nodes, u.edges),
        edges: d.edges,
      };
    });
  }, [ctxMenu, groupPath]);

  const runUngroupNode = useCallback(() => {
    if (!ctxMenu || ctxMenu.kind !== "nodes") return;
    const nodeId = ctxMenu.anchorNodeId;
    setCtxMenu(null);
    setDoc((d) => {
      const v = getViewGraph(d.nodes, d.edges, groupPath);
      const u = ungroupNodeFromFrame(v.nodes, v.edges, nodeId);
      if (!u) return d;
      if (groupPath.length === 0) return { nodes: u.nodes, edges: u.edges };
      return {
        nodes: patchNestedGraph(d.nodes, groupPath, u.nodes, u.edges),
        edges: d.edges,
      };
    });
  }, [ctxMenu, groupPath]);

  const ctxMenuAnchorNode = useMemo(() => {
    if (!ctxMenu || ctxMenu.kind !== "nodes") return null;
    return view.nodes.find((n) => n.id === ctxMenu.anchorNodeId) ?? null;
  }, [ctxMenu, view.nodes]);

  const ctxParentIsFrame =
    ctxMenuAnchorNode?.parentId != null &&
    view.nodes.find((p) => p.id === ctxMenuAnchorNode.parentId)?.data.nodeType === "frame";

  const crumbTitles = useMemo(() => titlesAlongPath(doc.nodes, groupPath), [doc.nodes, groupPath]);

  const flowColumn = (
    <div
      ref={flowAreaRef}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0c0c0e]"
      onContextMenuCapture={onFlowContextMenuCapture}
      onContextMenu={onFlowContextMenu}
    >
      {focusMode ? (
        <div className="flex shrink-0 items-center justify-end border-b border-zinc-800 bg-zinc-950 px-2 py-1">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => setFocusMode(false)}
          >
            Minimize
          </button>
        </div>
      ) : null}
      {groupPath.length > 0 ? (
        <div className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-zinc-400">
            <button
              type="button"
              className="font-medium text-sky-400 hover:text-sky-300"
              onClick={() => {
                setGroupPath([]);
                initialFitDone.current = false;
              }}
            >
              Main
            </button>
            {crumbTitles.map((t, i) => (
              <span key={`${groupPath[i]}-${i}`} className="flex items-center gap-1">
                <span className="text-zinc-600">/</span>
                <button
                  type="button"
                  className="truncate text-zinc-200 hover:text-white"
                  onClick={() => {
                    setGroupPath(groupPath.slice(0, i + 1));
                    initialFitDone.current = false;
                  }}
                >
                  {t}
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => {
              setGroupPath([]);
              initialFitDone.current = false;
            }}
          >
            Exit
          </button>
        </div>
      ) : null}
      <ReactFlow
        className={`min-h-0 flex-1 bg-[#0c0c0e] ${groupPath.length > 0 && !focusMode ? "pt-0" : ""}`}
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onSelectionContextMenu={onSelectionContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        selectionOnDrag
        panOnDrag={[1, 2]}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
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
        <Panel position="bottom-left" className="!m-3 mb-14 ml-3">
          <button
            type="button"
            onClick={() => setFocusMode(true)}
            className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200 shadow hover:bg-zinc-800"
          >
            Focus
          </button>
        </Panel>
        <MiniMap
          className="!m-3 !rounded-md !border !border-zinc-700 !bg-zinc-900/90"
          nodeStrokeWidth={2}
          nodeColor={(n) => minimapColorForNodeType((n as Node<OpenSeerNodeData>).data?.nodeType)}
          maskColor="rgb(12, 12, 14, 0.85)"
        />
      </ReactFlow>
      {ctxMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close menu"
            onClick={() => setCtxMenu(null)}
          />
          <div
            className="fixed z-50 max-h-[min(70vh,360px)] w-52 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            style={(() => {
              const h = ctxMenu.kind === "pane" ? CTX_MENU_H_PANE : CTX_MENU_H_NODES;
              const { left, top } = clampFixedMenuPosition(
                ctxMenu.clientX,
                ctxMenu.clientY,
                CTX_MENU_W,
                h
              );
              return { left, top };
            })()}
          >
            {ctxMenu.kind === "pane" ? (
              OPEN_SEER_NODE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm capitalize text-zinc-200 hover:bg-zinc-800"
                  onClick={() => {
                    onAddNodeAt(t, { x: ctxMenu.flowX, y: ctxMenu.flowY });
                    setCtxMenu(null);
                  }}
                >
                  {NODE_TYPE_LABEL[t]}
                </button>
              ))
            ) : (
              <>
                {ctxMenuAnchorNode?.data.nodeType === "frame" ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={runUngroupAll}
                  >
                    Ungroup all
                  </button>
                ) : null}
                {ctxMenuAnchorNode && ctxParentIsFrame ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={runUngroupNode}
                  >
                    Ungroup node
                  </button>
                ) : null}
                {ctxMenu.selectedIds.length >= 2 &&
                ctxMenuAnchorNode?.data.nodeType !== "frame" ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={runGroupSelection}
                  >
                    Group nodes
                  </button>
                ) : null}
                <p className="px-3 py-1 text-[11px] text-zinc-600">
                  {ctxMenu.selectedIds.length < 2
                    ? "Select 2+ nodes (Shift-click) to group nodes together."
                    : ""}
                </p>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1">
      {!focusMode ? (
        <GraphSidebar
          graphName={graphMeta.name}
          visibleTypes={visibleTypes}
          onToggleType={onToggleType}
          onShowAllTypes={onShowAllTypes}
          onLoadDemo={onLoadDemo}
          onNewBlank={onNewBlank}
          onAddNode={onAddNode}
        />
      ) : null}
      <div
        className={
          focusMode
            ? "fixed inset-0 z-[200] flex min-h-0 flex-1 flex-col bg-[#0c0c0e]"
            : "relative flex min-h-0 min-w-0 flex-1 flex-col"
        }
      >
        {flowColumn}
      </div>
      {!focusMode ? (
        <InspectorPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onPatchNode={onPatchNode}
          onPatchEdge={onPatchEdge}
          onDeleteNode={onDeleteNode}
          onDeleteEdge={onDeleteEdge}
        />
      ) : null}
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
