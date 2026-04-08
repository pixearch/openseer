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
  useStoreApi,
} from "@xyflow/react";
import { getEdgePosition } from "@xyflow/system";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  Connection,
  Edge,
  EdgeChange,
  EdgeMouseHandler,
  Node,
  NodeChange,
  NodeMouseHandler,
  OnNodeDrag,
  SelectionDragHandler,
} from "@xyflow/react";
import { EdgeControlContext, OpenSeerFlowEdge } from "@/components/openseer/OpenSeerFlowEdge";
import { GraphSidebar } from "@/components/openseer/GraphSidebar";
import { ShowNodeTypeHeadingContext } from "@/components/openseer/graph-workspace-ui-context";
import { InspectorPanel } from "@/components/openseer/InspectorPanel";
import { OpenSeerNode } from "@/components/openseer/OpenSeerNode";
import { NodeStyleColorPanel } from "@/components/openseer/NodeStyleColorPanel";
import { RadialCreateNodeMenu } from "@/components/openseer/RadialCreateNodeMenu";
import { CodeNodeEditModal } from "@/components/openseer/CodeNodeEditModal";
import { TextNodeEditModal } from "@/components/openseer/TextNodeEditModal";
import { createGitOnboardingSeed, SEED_GRAPH_ID, SEED_GRAPH_NAME } from "@/data/seed-git-onboarding";
import { openDocumentUrl } from "@/lib/document-open";
import {
  createEmptyNodeData,
  GROUP_STANDARD_HEIGHT,
  GROUP_STANDARD_WIDTH,
  NODE_STANDARD_HEIGHT,
  NODE_STANDARD_WIDTH,
} from "@/lib/default-node";
import {
  applyMultiNodeAlign,
  applyMultiNodeDistribute,
  buildProportionalLayoutState,
  computeProportionalPositions,
  type AlignDirection,
} from "@/lib/graph/multi-node-layout";
import {
  getBaselinePathD,
  getOpenSeerEdgePathResult,
  normalizeControlPoints,
  sortControlPointsAlongPath,
  snapFlowPosition,
} from "@/lib/graph/edge-control-path";
import {
  clampFrameChildrenEverywhere,
  clampFrameChildrenPositions,
  getViewGraph,
  groupSelectedNodes,
  patchNestedGraph,
  sanitizeHubEdgesForLevel,
  sanitizeHubHandlesInDoc,
  sortParentsBeforeChildren,
  titlesAlongPath,
  ungroupFrame,
  ungroupNodeFromFrame,
} from "@/lib/graph/nested-graph";
import { minimapColorForNodeType } from "@/lib/node-type-meta";
import {
  documentFromState,
  loadGraphDocument,
  saveGraphDocument,
} from "@/lib/services/graph-storage";
import { clampFixedMenuPosition } from "@/lib/ui/clamp-context-menu";
import type {
  OpenSeerControlPointType,
  OpenSeerEdgeData,
  OpenSeerNodeData,
  OpenSeerNodeType,
} from "@/lib/types/graph";
import { GRAPH_WORKSPACE_NODE_TYPE_LIST } from "@/lib/types/graph";

const nodeTypes = { openSeer: OpenSeerNode };

const edgeTypes = { openSeerEdge: OpenSeerFlowEdge };

const defaultEdgeOptions = {
  type: "openSeerEdge" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b", width: 18, height: 18 },
  style: { stroke: "#64748b", strokeWidth: 1.5 },
  selectable: true,
  interactionWidth: 24,
};

const CTX_MENU_W = 208;
const CTX_MENU_H_NODES = 300;
const CTX_MENU_H_EDGE = 228;
const STYLE_PANEL_W = 248;
const STYLE_PANEL_H = 420;

const ARROW_PAN_STEP_DEFAULT = 32;
const ARROW_PAN_STEP_MIN = 4;
const ARROW_PAN_STEP_MAX = 320;
const ARROW_PAN_SPEED_STEP = 12;

const WORKSPACE_TYPE_SET = new Set<OpenSeerNodeType>(GRAPH_WORKSPACE_NODE_TYPE_LIST);

const SESSION_GRAPH_PANEL_COLLAPSED_KEY = "openseer-graph-panel-collapsed";
const LOCAL_SHOW_NODE_TYPE_HEADINGS_KEY = "openseer-show-node-type-headings-v1";

/** Max distance (flow coordinates) from pointer to edge path to allow insert-on-drop. */
const EDGE_INSERT_HIT_FLOW = 36;

function distancePointToSvgPath(flowX: number, flowY: number, pathD: string): number {
  if (typeof document === "undefined") return Number.POSITIVE_INFINITY;
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", pathD);
  try {
    const len = p.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return Number.POSITIVE_INFINITY;
    const steps = Math.min(64, Math.max(12, Math.ceil(len / 6)));
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= steps; i++) {
      const pt = p.getPointAtLength((len * i) / steps);
      const dx = pt.x - flowX;
      const dy = pt.y - flowY;
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function clampRadialMenuCenter(clientX: number, clientY: number): { left: number; top: number } {
  const m = 16;
  const halfW = 110;
  const halfH = 150;
  if (typeof window === "undefined") {
    return { left: clientX, top: clientY };
  }
  return {
    left: Math.min(Math.max(halfW + m, clientX), window.innerWidth - halfW - m),
    top: Math.min(Math.max(halfH + m, clientY), window.innerHeight - halfH - m),
  };
}

function isVisibleOnCanvas(
  node: Node<OpenSeerNodeData>,
  visibleTypes: Set<OpenSeerNodeType>
): boolean {
  const t = node.data.nodeType;
  if (!WORKSPACE_TYPE_SET.has(t)) return true;
  return visibleTypes.has(t);
}

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
      anchorNodeId: string;
    }
  | {
      kind: "edge";
      clientX: number;
      clientY: number;
      flowX: number;
      flowY: number;
      edgeId: string;
    };

type NodeStylePickerState = {
  mode: "header" | "body";
  targetIds: string[];
  anchorData: OpenSeerNodeData;
  position: { left: number; top: number };
};

function GraphWorkspaceInner() {
  const flowAreaRef = useRef<HTMLDivElement>(null);
  const graphPointerInside = useRef(false);
  const lastGraphPointer = useRef({ x: 0, y: 0 });
  const arrowPanStepRef = useRef(ARROW_PAN_STEP_DEFAULT);
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  const store = useStoreApi();

  const [ready, setReady] = useState(false);
  const [graphMeta, setGraphMeta] = useState({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
  const [doc, setDoc] = useState<{
    nodes: Node<OpenSeerNodeData>[];
    edges: Edge<OpenSeerEdgeData>[];
  }>({ nodes: [], edges: [] });
  const [groupPath, setGroupPath] = useState<string[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [nodeStylePicker, setNodeStylePicker] = useState<NodeStylePickerState | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<OpenSeerNodeType>>(
    () => new Set(GRAPH_WORKSPACE_NODE_TYPE_LIST)
  );
  const [selection, setSelection] = useState<{
    nodeId: string | null;
    edgeId: string | null;
    multiNodeIds: string[] | null;
  }>({ nodeId: null, edgeId: null, multiNodeIds: null });
  const [selectedControlPoint, setSelectedControlPoint] = useState<{
    edgeId: string;
    pointId: string;
  } | null>(null);
  const [textEditNodeId, setTextEditNodeId] = useState<string | null>(null);
  const [codeEditNodeId, setCodeEditNodeId] = useState<string | null>(null);
  const [overviewVisible, setOverviewVisible] = useState(true);
  const [graphPanelCollapsed, setGraphPanelCollapsed] = useState(false);
  const [showNodeTypeHeadings, setShowNodeTypeHeadings] = useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [alignOverlay, setAlignOverlay] = useState<null | "align" | "distribute">(null);
  const [proportionalMoveUi, setProportionalMoveUi] = useState(false);
  const [controlPointGrab, setControlPointGrab] = useState<{
    edgeId: string;
    pointId: string;
    originX: number;
    originY: number;
    anchorFlowX: number;
    anchorFlowY: number;
  } | null>(null);

  const selectionRef = useRef(selection);
  useLayoutEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const selectedControlPointRef = useRef(selectedControlPoint);
  useLayoutEffect(() => {
    selectedControlPointRef.current = selectedControlPoint;
  }, [selectedControlPoint]);

  const controlPointGrabRef = useRef(controlPointGrab);
  useLayoutEffect(() => {
    controlPointGrabRef.current = controlPointGrab;
  }, [controlPointGrab]);

  const docRef = useRef(doc);
  useLayoutEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const groupPathRef = useRef(groupPath);
  useLayoutEffect(() => {
    groupPathRef.current = groupPath;
  }, [groupPath]);

  const alignOverlayRef = useRef<null | "align" | "distribute">(null);
  useLayoutEffect(() => {
    alignOverlayRef.current = alignOverlay;
  }, [alignOverlay]);

  const proportionalLayoutRef = useRef<ReturnType<typeof buildProportionalLayoutState> | null>(
    null
  );
  const proportionalDragLeaderRef = useRef<string | null>(null);

  const edgeInsertEligibleRef = useRef(false);
  const edgeInsertGrabNodeIdRef = useRef<string | null>(null);
  const edgeInsertHoverIdRef = useRef<string | null>(null);
  const [edgeInsertHoverId, setEdgeInsertHoverId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const alignOverlayContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!alignOverlay) return;
    alignOverlayContainerRef.current?.focus();
  }, [alignOverlay]);

  const applyAlignOverlayChoice = useCallback((dir: AlignDirection, mode: "align" | "distribute") => {
    setAlignOverlay(null);
    setDoc((d) => {
      const ids = selectionRef.current.multiNodeIds;
      if (!ids || ids.length < 2) return d;
      const path = groupPathRef.current;
      const v = getViewGraph(d.nodes, d.edges, path);
      const raw =
        mode === "distribute"
          ? applyMultiNodeDistribute(v.nodes, ids, dir)
          : applyMultiNodeAlign(v.nodes, ids, dir);
      const clamped = clampFrameChildrenPositions(raw);
      const ordered = sortParentsBeforeChildren(clamped);
      if (path.length === 0) return { nodes: ordered, edges: d.edges };
      return {
        nodes: patchNestedGraph(d.nodes, path, ordered, v.edges),
        edges: d.edges,
      };
    });
  }, []);

  useEffect(() => {
    if (!alignOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAlignOverlay(null);
        return;
      }
      let dir: AlignDirection | null = null;
      if (e.code === "ArrowUp") dir = "up";
      else if (e.code === "ArrowDown") dir = "down";
      else if (e.code === "ArrowLeft") dir = "left";
      else if (e.code === "ArrowRight") dir = "right";
      if (!dir) return;
      e.preventDefault();
      applyAlignOverlayChoice(dir, alignOverlay);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alignOverlay, applyAlignOverlayChoice]);

  const groupPathKey = groupPath.join("|");

  const view = useMemo(
    () => getViewGraph(doc.nodes, doc.edges, groupPath),
    [doc.nodes, doc.edges, groupPath]
  );

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const saved = loadGraphDocument();
      if (saved) {
        const clamped = clampFrameChildrenEverywhere(saved.nodes as Node<OpenSeerNodeData>[]);
        const { nodes, edges } = sanitizeHubHandlesInDoc(
          clamped,
          saved.edges as Edge<OpenSeerEdgeData>[]
        );
        setDoc({ nodes, edges });
        setGraphMeta({ id: saved.id, name: saved.name });
      } else {
        const seed = createGitOnboardingSeed();
        const clamped = clampFrameChildrenEverywhere(seed.nodes);
        const { nodes, edges } = sanitizeHubHandlesInDoc(clamped, seed.edges);
        setDoc({ nodes, edges });
        setGraphMeta({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
        saveGraphDocument(documentFromState(SEED_GRAPH_NAME, SEED_GRAPH_ID, nodes, edges));
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        setGraphPanelCollapsed(sessionStorage.getItem(SESSION_GRAPH_PANEL_COLLAPSED_KEY) === "1");
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        setShowNodeTypeHeadings(localStorage.getItem(LOCAL_SHOW_NODE_TYPE_HEADINGS_KEY) !== "0");
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const toggleGraphPanelCollapsed = useCallback(() => {
    setGraphPanelCollapsed((c) => {
      const next = !c;
      try {
        sessionStorage.setItem(SESSION_GRAPH_PANEL_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleShowNodeTypeHeadings = useCallback(() => {
    setShowNodeTypeHeadings((v) => {
      const next = !v;
      try {
        localStorage.setItem(LOCAL_SHOW_NODE_TYPE_HEADINGS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const onGraphNameChange = useCallback((name: string) => {
    setGraphMeta((m) => ({ ...m, name }));
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

  useEffect(() => {
    if (!ctxMenu || ctxMenu.kind !== "pane") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [ctxMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.repeat) return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      ) {
        return;
      }
      if (!graphPointerInside.current) return;
      if (ctxMenu) return;
      e.preventDefault();
      const { x, y } = lastGraphPointer.current;
      const p = screenToFlowPosition({ x, y });
      setCtxMenu({
        kind: "pane",
        clientX: x,
        clientY: y,
        flowX: p.x,
        flowY: p.y,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctxMenu, screenToFlowPosition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (ctxMenu) return;
      if (alignOverlayRef.current) return;

      if (e.key === "Escape") {
        if (proportionalLayoutRef.current) {
          e.preventDefault();
          proportionalLayoutRef.current = null;
          proportionalDragLeaderRef.current = null;
          setProportionalMoveUi(false);
        }
        return;
      }

      const k = e.key.length === 1 ? e.key.toLowerCase() : "";

      if (k === "f") {
        if (focusMode) {
          e.preventDefault();
          setFocusMode(false);
          return;
        }
        if (!graphPointerInside.current) return;
        e.preventDefault();
        setFocusMode(true);
        return;
      }

      if (!graphPointerInside.current) return;

      if (e.code === "KeyG") {
        if (controlPointGrabRef.current) {
          e.preventDefault();
          return;
        }
        const cp = selectedControlPointRef.current;
        if (!cp) return;
        const d0 = docRef.current;
        const path0 = groupPathRef.current;
        const v0 = getViewGraph(d0.nodes, d0.edges, path0);
        const ed0 = v0.edges.find((x) => x.id === cp.edgeId);
        if (!ed0) return;
        const pt0 = normalizeControlPoints(
          (ed0.data as OpenSeerEdgeData | undefined)?.controlPoints
        ).find((p) => p.id === cp.pointId);
        if (!pt0) return;
        e.preventDefault();
        const { x: cx, y: cy } = lastGraphPointer.current;
        const anchor = screenToFlowPosition({ x: cx, y: cy });
        setControlPointGrab({
          edgeId: cp.edgeId,
          pointId: cp.pointId,
          originX: pt0.x,
          originY: pt0.y,
          anchorFlowX: anchor.x,
          anchorFlowY: anchor.y,
        });
        return;
      }

      if (e.code === "KeyP") {
        const cp = selectedControlPointRef.current;
        if (!cp) return;
        e.preventDefault();
        setDoc((doc) => {
          const gPath = groupPathRef.current;
          const v = getViewGraph(doc.nodes, doc.edges, gPath);
          const ne = v.edges.map((edge) => {
            if (edge.id !== cp.edgeId) return edge;
            const data = (edge.data ?? {}) as OpenSeerEdgeData;
            const pts = normalizeControlPoints(data.controlPoints).map((p) =>
              p.id === cp.pointId
                ? { ...p, type: p.type === "bezier" ? ("angled" as const) : ("bezier" as const) }
                : p
            );
            const prev = (edge.data ?? {}) as Partial<OpenSeerEdgeData>;
            const merged: OpenSeerEdgeData = {
              ...prev,
              label: prev.label ?? String(edge.label ?? "relates_to"),
              relationshipType: prev.relationshipType ?? "relates_to",
              controlPoints: pts,
            };
            return { ...edge, label: merged.label, data: merged };
          });
          if (gPath.length === 0) return { nodes: doc.nodes, edges: ne };
          return {
            nodes: patchNestedGraph(doc.nodes, gPath, v.nodes, ne),
            edges: doc.edges,
          };
        });
        return;
      }

      if (k === "b") {
        if (e.repeat) return;
        const selId = selectionRef.current.nodeId;
        if (!selId) return;
        const d0 = docRef.current;
        const path0 = groupPathRef.current;
        const v0 = getViewGraph(d0.nodes, d0.edges, path0);
        const inc0 = v0.edges.filter((x) => x.target === selId);
        const out0 = v0.edges.filter((x) => x.source === selId);
        if (inc0.length !== 1 || out0.length !== 1) return;
        const A0 = inc0[0].source;
        const C0 = out0[0].target;
        if (v0.edges.some((ed) => ed.source === A0 && ed.target === C0)) return;
        e.preventDefault();
        setDoc((d) => {
          const path = groupPathRef.current;
          const v = getViewGraph(d.nodes, d.edges, path);
          const incoming = v.edges.filter((x) => x.target === selId);
          const outgoing = v.edges.filter((x) => x.source === selId);
          if (incoming.length !== 1 || outgoing.length !== 1) return d;
          const eIn = incoming[0];
          const eOut = outgoing[0];
          const A = eIn.source;
          const C = eOut.target;
          if (v.edges.some((ed) => ed.source === A && ed.target === C)) return d;
          const ne = v.edges.filter((ed) => ed.id !== eIn.id && ed.id !== eOut.id);
          const outTemplate = { ...eOut } as Record<string, unknown>;
          delete outTemplate.id;
          delete outTemplate.source;
          delete outTemplate.target;
          delete outTemplate.sourceHandle;
          delete outTemplate.targetHandle;
          ne.push({
            ...(outTemplate as Omit<Edge<OpenSeerEdgeData>, "id" | "source" | "target">),
            id: `e-${A}-${C}-${crypto.randomUUID().slice(0, 8)}`,
            source: A,
            target: C,
          });
          if (path.length === 0) return { nodes: d.nodes, edges: ne };
          return {
            nodes: patchNestedGraph(d.nodes, path, v.nodes, ne),
            edges: d.edges,
          };
        });
        return;
      }

      if (k === "a") {
        const ids = selectionRef.current.multiNodeIds;
        if (!ids || ids.length < 2) return;
        e.preventDefault();
        setAlignOverlay(e.shiftKey ? "distribute" : "align");
        return;
      }

      if (k === "m") {
        if (e.repeat) return;
        e.preventDefault();
        if (proportionalLayoutRef.current) {
          proportionalLayoutRef.current = null;
          proportionalDragLeaderRef.current = null;
          setProportionalMoveUi(false);
          return;
        }
        const ids = selectionRef.current.multiNodeIds;
        if (!ids || ids.length < 2) return;
        const v = getViewGraph(
          docRef.current.nodes,
          docRef.current.edges,
          groupPathRef.current
        );
        const layout = buildProportionalLayoutState(v.nodes, ids);
        if (!layout) return;
        proportionalLayoutRef.current = layout;
        setProportionalMoveUi(true);
        return;
      }

      if (k === "s") {
        if (e.repeat) return;
        e.preventDefault();
        setGridSnapEnabled((v) => !v);
        return;
      }

      if (k === "h") {
        if (e.repeat) return;
        const t = e.target;
        if (t instanceof HTMLElement && t.tagName === "SELECT") return;
        e.preventDefault();
        setOverviewVisible((v) => !v);
        return;
      }

      if (k === "e") {
        e.preventDefault();
        void fitView({ padding: 0.12, duration: 250, maxZoom: 2 });
        return;
      }

      if (k === "z") {
        const sel = selectionRef.current;
        const ids =
          sel.multiNodeIds && sel.multiNodeIds.length > 0
            ? sel.multiNodeIds
            : sel.nodeId
              ? [sel.nodeId]
              : [];
        if (ids.length === 0) return;
        e.preventDefault();
        void fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.08,
          duration: 250,
          maxZoom: 2,
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctxMenu, fitView, focusMode, screenToFlowPosition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (ctxMenu) return;
      if (alignOverlayRef.current) return;
      if (!graphPointerInside.current) return;

      const code = e.code;
      if (
        code !== "ArrowUp" &&
        code !== "ArrowDown" &&
        code !== "ArrowLeft" &&
        code !== "ArrowRight"
      ) {
        return;
      }

      if (e.shiftKey && (code === "ArrowUp" || code === "ArrowDown")) {
        e.preventDefault();
        const cur = arrowPanStepRef.current;
        if (code === "ArrowUp") {
          arrowPanStepRef.current = Math.min(ARROW_PAN_STEP_MAX, cur + ARROW_PAN_SPEED_STEP);
        } else {
          arrowPanStepRef.current = Math.max(ARROW_PAN_STEP_MIN, cur - ARROW_PAN_SPEED_STEP);
        }
        return;
      }

      if (e.shiftKey) return;

      e.preventDefault();
      const step = arrowPanStepRef.current;
      const panBy = store.getState().panBy;
      if (code === "ArrowUp") void panBy({ x: 0, y: step });
      else if (code === "ArrowDown") void panBy({ x: 0, y: -step });
      else if (code === "ArrowLeft") void panBy({ x: step, y: 0 });
      else void panBy({ x: -step, y: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctxMenu, store, alignOverlay]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<OpenSeerNodeData>>[]) => {
      setDoc((d) => {
        const path = groupPathRef.current;
        const v = getViewGraph(d.nodes, d.edges, path);
        let effectiveChanges = changes;

        const pm = proportionalLayoutRef.current;
        if (pm) {
          const selSet = new Set(pm.orderedIds);
          const posChanges = changes.filter(
            (c): c is NodeChange<Node<OpenSeerNodeData>> & { type: "position"; id: string } =>
              c.type === "position" && selSet.has(c.id)
          );
          if (posChanges.length > 0) {
            const leaderId =
              proportionalDragLeaderRef.current &&
              selSet.has(proportionalDragLeaderRef.current)
                ? proportionalDragLeaderRef.current
                : posChanges[0].id;
            const leaderChange =
              posChanges.find((c) => c.id === leaderId) ?? posChanges[0];
            const pos =
              leaderChange && "position" in leaderChange && leaderChange.position
                ? leaderChange.position
                : null;
            if (pos) {
              const relMap = computeProportionalPositions(v.nodes, pm, leaderId, pos);
              const dragFlag =
                "dragging" in leaderChange ? leaderChange.dragging : undefined;
              const filtered = changes.filter(
                (c) => !(c.type === "position" && selSet.has(c.id))
              );
              for (const id of pm.orderedIds) {
                const p = relMap.get(id);
                if (p) {
                  filtered.push({
                    type: "position",
                    id,
                    position: p,
                    dragging: dragFlag,
                  });
                }
              }
              effectiveChanges = filtered;
            }
          }
        }

        const nn = applyNodeChanges(effectiveChanges, v.nodes);
        const clamped = clampFrameChildrenPositions(nn);
        const ordered = sortParentsBeforeChildren(clamped);
        const viewEdges = sanitizeHubEdgesForLevel(ordered, v.edges);
        if (path.length === 0) {
          return viewEdges === v.edges
            ? { nodes: ordered, edges: d.edges }
            : { nodes: ordered, edges: viewEdges };
        }
        return {
          nodes: patchNestedGraph(d.nodes, path, ordered, viewEdges),
          edges: d.edges,
        };
      });
    },
    []
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
      let next: {
        nodeId: string | null;
        edgeId: string | null;
        multiNodeIds: string[] | null;
      };
      if (sn.length > 1) {
        next = {
          nodeId: null,
          edgeId: null,
          multiNodeIds: sn.map((n) => n.id),
        };
      } else if (sn.length === 1) {
        next = { nodeId: sn[0].id, edgeId: null, multiNodeIds: null };
      } else if (se.length === 1) {
        next = { nodeId: null, edgeId: se[0].id, multiNodeIds: null };
      } else {
        next = { nodeId: null, edgeId: null, multiNodeIds: null };
      }

      const pm = proportionalLayoutRef.current;
      if (pm) {
        const ids = next.multiNodeIds;
        const set = new Set(ids ?? []);
        if (
          !ids ||
          ids.length !== pm.orderedIds.length ||
          !pm.orderedIds.every((id) => set.has(id))
        ) {
          proportionalLayoutRef.current = null;
          proportionalDragLeaderRef.current = null;
          setProportionalMoveUi(false);
        }
      }

      setSelection(next);
      setSelectedControlPoint((cp) => {
        if (!cp) return null;
        return next.edgeId === cp.edgeId ? cp : null;
      });
    },
    []
  );

  const onNodesDelete = useCallback((deleted: Node<OpenSeerNodeData>[]) => {
    if (textEditNodeId && deleted.some((n) => n.id === textEditNodeId)) {
      setTextEditNodeId(null);
    }
    if (codeEditNodeId && deleted.some((n) => n.id === codeEditNodeId)) {
      setCodeEditNodeId(null);
    }
    setSelection((s) => {
      const cleared = { nodeId: null, edgeId: null, multiNodeIds: null as string[] | null };
      if (s.nodeId && deleted.some((n) => n.id === s.nodeId)) return cleared;
      if (s.multiNodeIds?.length) {
        const next = s.multiNodeIds.filter((id) => !deleted.some((n) => n.id === id));
        if (next.length !== s.multiNodeIds.length) {
          if (next.length > 1) return { ...s, multiNodeIds: next };
          if (next.length === 1) return { nodeId: next[0], edgeId: null, multiNodeIds: null };
          return cleared;
        }
      }
      return s;
    });
  }, [textEditNodeId, codeEditNodeId]);

  const onEdgesDelete = useCallback((deleted: Edge<OpenSeerEdgeData>[]) => {
    setSelection((s) =>
      s.edgeId && deleted.some((e) => e.id === s.edgeId)
        ? { nodeId: null, edgeId: null, multiNodeIds: null }
        : s
    );
    setSelectedControlPoint((cp) =>
      cp && deleted.some((e) => e.id === cp.edgeId) ? null : cp
    );
  }, []);

  const flowNodes = useMemo(() => {
    const filtered = view.nodes.filter((n) => isVisibleOnCanvas(n, visibleTypes));
    const byId = new Map(filtered.map((n) => [n.id, n]));
    for (const n of filtered) {
      let pid: string | undefined = n.parentId;
      while (pid) {
        if (byId.has(pid)) break;
        const p = view.nodes.find((x) => x.id === pid);
        if (!p) break;
        byId.set(p.id, p);
        pid = p.parentId;
      }
    }
    return sortParentsBeforeChildren([...byId.values()]);
  }, [view.nodes, visibleTypes]);

  const flowEdges = useMemo(() => {
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    const list = view.edges.filter((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      return (
        s !== undefined &&
        t !== undefined &&
        isVisibleOnCanvas(s, visibleTypes) &&
        isVisibleOnCanvas(t, visibleTypes)
      );
    });
    const base = list.map((e) => {
      const insert = edgeInsertHoverId === e.id;
      const sel = e.selected === true;
      const hov = hoveredEdgeId === e.id && !sel;
      const baseW = 1.5;
      let stroke = "#64748b";
      let strokeWidth = baseW;
      if (insert) {
        stroke = "#38bdf8";
        strokeWidth = baseW + 2;
      } else if (sel) {
        stroke = "#38bdf8";
        strokeWidth = 2.5;
      } else if (hov) {
        stroke = "#94a3b8";
        strokeWidth = 2;
      }
      return {
        ...e,
        type: "openSeerEdge" as const,
        selectable: true,
        interactionWidth: 24,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 18,
          height: 18,
        },
        style: { ...e.style, stroke, strokeWidth },
        zIndex: insert ? 1000 : e.zIndex,
      };
    });
    return base;
  }, [view.edges, view.nodes, visibleTypes, edgeInsertHoverId, hoveredEdgeId]);

  const updateEdgeInsertHover = useCallback(
    (e: { clientX: number; clientY: number }, draggedNodeId: string) => {
      if (
        !edgeInsertEligibleRef.current ||
        edgeInsertGrabNodeIdRef.current !== draggedNodeId
      ) {
        if (edgeInsertHoverIdRef.current !== null) {
          edgeInsertHoverIdRef.current = null;
          setEdgeInsertHoverId(null);
        }
        return;
      }

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const { nodeLookup, connectionMode, transform } = store.getState();
      const zoom = transform[2] || 1;
      const threshold = EDGE_INSERT_HIT_FLOW / Math.max(zoom, 0.001);

      let bestId: string | null = null;
      let bestD = threshold;

      for (const edge of flowEdges) {
        if (edge.source === draggedNodeId || edge.target === draggedNodeId) continue;

        const sourceNode = nodeLookup.get(edge.source);
        const targetNode = nodeLookup.get(edge.target);
        if (!sourceNode || !targetNode) continue;

        const pos = getEdgePosition({
          id: edge.id,
          sourceNode,
          sourceHandle: edge.sourceHandle ?? null,
          targetNode,
          targetHandle: edge.targetHandle ?? null,
          connectionMode,
        });
        if (!pos) continue;

        const edata = edge.data as OpenSeerEdgeData | undefined;
        const routing = edata?.type ?? "orthogonal";
        const pathOpts = (edge as { pathOptions?: { offset?: number; stepPosition?: number } })
          .pathOptions;
        const cps = normalizeControlPoints(edata?.controlPoints);
        const { path: pathD } = getOpenSeerEdgePathResult({
          routing,
          sourceX: pos.sourceX,
          sourceY: pos.sourceY,
          targetX: pos.targetX,
          targetY: pos.targetY,
          sourcePosition: pos.sourcePosition,
          targetPosition: pos.targetPosition,
          controlPoints: cps,
          pathOptions: pathOpts,
        });
        const dist = distancePointToSvgPath(flowPos.x, flowPos.y, pathD);
        if (dist < bestD) {
          bestD = dist;
          bestId = edge.id;
        }
      }

      if (edgeInsertHoverIdRef.current !== bestId) {
        edgeInsertHoverIdRef.current = bestId;
        setEdgeInsertHoverId(bestId);
      }
    },
    [flowEdges, screenToFlowPosition, store]
  );

  const handleNodeDrag: OnNodeDrag<Node<OpenSeerNodeData>> = useCallback(
    (e, node) => {
      updateEdgeInsertHover(e, node.id);
    },
    [updateEdgeInsertHover]
  );

  const selectedNode = useMemo(
    () => view.nodes.find((n) => n.id === selection.nodeId) ?? null,
    [view.nodes, selection.nodeId]
  );

  const selectedEdge = useMemo(
    () => view.edges.find((e) => e.id === selection.edgeId) ?? null,
    [view.edges, selection.edgeId]
  );

  const multiSelectedNodes = useMemo(() => {
    if (!selection.multiNodeIds?.length) return [] as Node<OpenSeerNodeData>[];
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    return selection.multiNodeIds
      .map((id) => byId.get(id))
      .filter((n): n is Node<OpenSeerNodeData> => n !== undefined);
  }, [view.nodes, selection.multiNodeIds]);

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

  const onPatchNodes = useCallback(
    (ids: string[], patch: Partial<OpenSeerNodeData>) => {
      const set = new Set(ids);
      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const nn = v.nodes.map((n) =>
          set.has(n.id) ? { ...n, data: { ...n.data, ...patch } } : n
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
        const ne = v.edges.map((e) => {
          if (e.id !== id) return e;
          const prev = (e.data ?? {}) as Partial<OpenSeerEdgeData>;
          const merged: OpenSeerEdgeData = {
            ...prev,
            ...next,
            label: next.label ?? prev.label ?? String(e.label ?? "relates_to"),
            relationshipType: next.relationshipType ?? prev.relationshipType ?? "relates_to",
          };
          return { ...e, label: merged.label, data: merged };
        });
        if (groupPath.length === 0) return { nodes: d.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, v.nodes, ne),
          edges: d.edges,
        };
      });
    },
    [groupPath]
  );

  const addControlPointAtFlow = useCallback(
    (edgeId: string, flowX: number, flowY: number): string => {
      const pointId = `cp-${crypto.randomUUID().slice(0, 8)}`;
      const { nodeLookup, connectionMode } = store.getState();
      const path = groupPathRef.current;
      const d = docRef.current;
      const v = getViewGraph(d.nodes, d.edges, path);
      const edge = v.edges.find((e) => e.id === edgeId);
      if (!edge) return pointId;
      const sourceNode = nodeLookup.get(edge.source);
      const targetNode = nodeLookup.get(edge.target);
      if (!sourceNode || !targetNode) return pointId;
      const pos = getEdgePosition({
        id: edge.id,
        sourceNode,
        sourceHandle: edge.sourceHandle ?? null,
        targetNode,
        targetHandle: edge.targetHandle ?? null,
        connectionMode,
      });
      if (!pos) return pointId;
      const data = (edge.data ?? {}) as OpenSeerEdgeData;
      const routing = data.type ?? "orthogonal";
      const pathOpts = (edge as { pathOptions?: { offset?: number; stepPosition?: number } })
        .pathOptions;
      const baselineD = getBaselinePathD(
        routing,
        pos.sourceX,
        pos.sourceY,
        pos.targetX,
        pos.targetY,
        pos.sourcePosition,
        pos.targetPosition,
        pathOpts
      );
      const existing = normalizeControlPoints(data.controlPoints);
      const snapped = snapFlowPosition(flowX, flowY, gridSnapEnabled, 20, 20);
      const cpType: OpenSeerControlPointType = routing === "bezier" ? "bezier" : "angled";
      const nextPt = { id: pointId, x: snapped.x, y: snapped.y, type: cpType };
      const sorted = sortControlPointsAlongPath(baselineD, [...existing, nextPt]);

      setDoc((doc) => {
        const gPath = groupPathRef.current;
        const v2 = getViewGraph(doc.nodes, doc.edges, gPath);
        const ne = v2.edges.map((e) => {
          if (e.id !== edgeId) return e;
          const prev = (e.data ?? {}) as Partial<OpenSeerEdgeData>;
          const merged: OpenSeerEdgeData = {
            ...prev,
            label: prev.label ?? String(e.label ?? "relates_to"),
            relationshipType: prev.relationshipType ?? "relates_to",
            controlPoints: sorted,
          };
          return { ...e, label: merged.label, data: merged };
        });
        if (gPath.length === 0) return { nodes: doc.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(doc.nodes, gPath, v2.nodes, ne),
          edges: doc.edges,
        };
      });
      return pointId;
    },
    [store, gridSnapEnabled]
  );

  const updateControlPointPosition = useCallback(
    (edgeId: string, pointId: string, flowX: number, flowY: number) => {
      const { nodeLookup, connectionMode } = store.getState();
      setDoc((doc) => {
        const gPath = groupPathRef.current;
        const v = getViewGraph(doc.nodes, doc.edges, gPath);
        const ed = v.edges.find((e) => e.id === edgeId);
        if (!ed) return doc;
        const sourceNode = nodeLookup.get(ed.source);
        const targetNode = nodeLookup.get(ed.target);
        if (!sourceNode || !targetNode) return doc;
        const pos = getEdgePosition({
          id: ed.id,
          sourceNode,
          sourceHandle: ed.sourceHandle ?? null,
          targetNode,
          targetHandle: ed.targetHandle ?? null,
          connectionMode,
        });
        if (!pos) return doc;
        const data = (ed.data ?? {}) as OpenSeerEdgeData;
        const routing = data.type ?? "orthogonal";
        const pathOpts = (ed as { pathOptions?: { offset?: number; stepPosition?: number } })
          .pathOptions;
        const baselineD = getBaselinePathD(
          routing,
          pos.sourceX,
          pos.sourceY,
          pos.targetX,
          pos.targetY,
          pos.sourcePosition,
          pos.targetPosition,
          pathOpts
        );
        const list = sortControlPointsAlongPath(
          baselineD,
          normalizeControlPoints(data.controlPoints).map((p) =>
            p.id === pointId ? { ...p, x: flowX, y: flowY } : p
          )
        );
        const ne = v.edges.map((e) => {
          if (e.id !== edgeId) return e;
          const prev = (e.data ?? {}) as Partial<OpenSeerEdgeData>;
          const merged: OpenSeerEdgeData = {
            ...prev,
            label: prev.label ?? String(e.label ?? "relates_to"),
            relationshipType: prev.relationshipType ?? "relates_to",
            controlPoints: list,
          };
          return { ...e, label: merged.label, data: merged };
        });
        if (gPath.length === 0) return { nodes: doc.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(doc.nodes, gPath, v.nodes, ne),
          edges: doc.edges,
        };
      });
    },
    [store]
  );

  useEffect(() => {
    if (!controlPointGrab) return;
    const { edgeId, pointId, originX, originY, anchorFlowX, anchorFlowY } = controlPointGrab;

    const onMove = (ev: PointerEvent) => {
      const fp = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const nx = originX + (fp.x - anchorFlowX);
      const ny = originY + (fp.y - anchorFlowY);
      const sn = snapFlowPosition(nx, ny, gridSnapEnabled, 20, 20);
      updateControlPointPosition(edgeId, pointId, sn.x, sn.y);
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      setControlPointGrab(null);
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      updateControlPointPosition(edgeId, pointId, originX, originY);
      setControlPointGrab(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [controlPointGrab, gridSnapEnabled, screenToFlowPosition, updateControlPointPosition]);

  const onBeforeDelete = useCallback(
    async ({
      nodes,
      edges,
    }: {
      nodes: Node<OpenSeerNodeData>[];
      edges: Edge<OpenSeerEdgeData>[];
    }) => {
      const cp = selectedControlPointRef.current;
      if (!cp || edges.length === 0) return { nodes, edges };
      if (!edges.some((e) => e.id === cp.edgeId)) return { nodes, edges };
      setDoc((doc) => {
        const gPath = groupPathRef.current;
        const v = getViewGraph(doc.nodes, doc.edges, gPath);
        const ne = v.edges.map((e) => {
          if (e.id !== cp.edgeId) return e;
          const data = (e.data ?? {}) as OpenSeerEdgeData;
          const nextPts = normalizeControlPoints(data.controlPoints).filter((p) => p.id !== cp.pointId);
          const prev = (e.data ?? {}) as Partial<OpenSeerEdgeData>;
          const merged: OpenSeerEdgeData = {
            ...prev,
            label: prev.label ?? String(e.label ?? "relates_to"),
            relationshipType: prev.relationshipType ?? "relates_to",
            controlPoints: nextPts,
          };
          return { ...e, label: merged.label, data: merged };
        });
        if (gPath.length === 0) return { nodes: doc.nodes, edges: ne };
        return {
          nodes: patchNestedGraph(doc.nodes, gPath, v.nodes, ne),
          edges: doc.edges,
        };
      });
      setSelectedControlPoint(null);
      return { nodes, edges: edges.filter((e) => e.id !== cp.edgeId) };
    },
    []
  );

  const edgeControlApi = useMemo(
    () => ({
      snapToGrid: gridSnapEnabled,
      snapGrid: [20, 20] as const,
      screenToFlowPosition,
      selectedControlPoint,
      setSelectedControlPoint,
      addControlPointAtFlow,
      updateControlPointPosition,
    }),
    [
      gridSnapEnabled,
      screenToFlowPosition,
      selectedControlPoint,
      addControlPointAtFlow,
      updateControlPointPosition,
    ]
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      setTextEditNodeId((tid) => (tid === id ? null : tid));
      setCodeEditNodeId((cid) => (cid === id ? null : cid));
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
      setSelection({ nodeId: null, edgeId: null, multiNodeIds: null });
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
      setSelection({ nodeId: null, edgeId: null, multiNodeIds: null });
      setSelectedControlPoint(null);
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
    setVisibleTypes(new Set(GRAPH_WORKSPACE_NODE_TYPE_LIST));
  }, []);

  const onLoadDemo = useCallback(() => {
    const seed = createGitOnboardingSeed();
    const clamped = clampFrameChildrenEverywhere(seed.nodes);
    const { nodes, edges } = sanitizeHubHandlesInDoc(clamped, seed.edges);
    setDoc({ nodes, edges });
    setGraphMeta({ id: SEED_GRAPH_ID, name: SEED_GRAPH_NAME });
    setGroupPath([]);
    setSelection({ nodeId: null, edgeId: null, multiNodeIds: null });
    setSelectedControlPoint(null);
    initialFitDone.current = false;
    window.setTimeout(() => fitView({ padding: 0.12, maxZoom: 1.15, duration: 200 }), 60);
  }, [fitView]);

  const onNewBlank = useCallback(() => {
    const id = crypto.randomUUID();
    setDoc({ nodes: [], edges: [] });
    setGraphMeta({ id, name: "Untitled graph" });
    setGroupPath([]);
    setSelection({ nodeId: null, edgeId: null, multiNodeIds: null });
    setSelectedControlPoint(null);
  }, []);

  const onAddNodeAt = useCallback(
    (nodeType: OpenSeerNodeType, position: { x: number; y: number }) => {
      const id = `n-${crypto.randomUUID()}`;
      const sel = selectionRef.current;
      const selectedIds: string[] =
        sel.multiNodeIds?.length ? sel.multiNodeIds : sel.nodeId ? [sel.nodeId] : [];

      setDoc((d) => {
        const v = getViewGraph(d.nodes, d.edges, groupPath);
        const inView = new Set(v.nodes.map((n) => n.id));
        const sources = selectedIds.filter((sid) => inView.has(sid));

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

        let nextEdges = v.edges;
        for (const src of sources) {
          if (src === id) continue;
          if (nextEdges.some((e) => e.source === src && e.target === id)) continue;
          const eid = `e-${src}-${id}-${crypto.randomUUID().slice(0, 8)}`;
          const edge: Edge<OpenSeerEdgeData> = {
            id: eid,
            source: src,
            target: id,
            label: "relates_to",
            data: { label: "relates_to", relationshipType: "relates_to" },
          };
          nextEdges = addEdge(edge, nextEdges);
        }

        if (groupPath.length === 0) return { nodes: nextNodes, edges: nextEdges };
        return {
          nodes: patchNestedGraph(d.nodes, groupPath, nextNodes, nextEdges),
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
      const selectedIds = sel.length > 0 ? sel.map((n) => n.id) : [node.id];
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

  const onEdgeContextMenu: EdgeMouseHandler<Edge<OpenSeerEdgeData>> = useCallback(
    (e, edge) => {
      e.preventDefault();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCtxMenu({
        kind: "edge",
        clientX: e.clientX,
        clientY: e.clientY,
        flowX: p.x,
        flowY: p.y,
        edgeId: edge.id,
      });
    },
    [screenToFlowPosition]
  );

  const onEdgeDoubleClick: EdgeMouseHandler<Edge<OpenSeerEdgeData>> = useCallback(
    (e, edge) => {
      e.preventDefault();
      e.stopPropagation();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const pointId = addControlPointAtFlow(edge.id, p.x, p.y);
      setSelectedControlPoint({ edgeId: edge.id, pointId });
    },
    [screenToFlowPosition, addControlPointAtFlow]
  );

  const onEdgeClick: EdgeMouseHandler<Edge<OpenSeerEdgeData>> = useCallback(() => {
    setSelectedControlPoint(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedControlPoint(null);
  }, []);

  const onEdgeMouseEnter: EdgeMouseHandler<Edge<OpenSeerEdgeData>> = useCallback((_e, edge) => {
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave: EdgeMouseHandler<Edge<OpenSeerEdgeData>> = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  const onNodeDragStart: OnNodeDrag<Node<OpenSeerNodeData>> = useCallback((_e, node) => {
    const pm = proportionalLayoutRef.current;
    if (pm?.orderedIds.includes(node.id)) {
      proportionalDragLeaderRef.current = node.id;
    }

    const multi = selectionRef.current.multiNodeIds;
    const propBlocks =
      pm !== null && pm !== undefined && pm.orderedIds.length > 1;
    edgeInsertEligibleRef.current = multi === null && !propBlocks;
    edgeInsertGrabNodeIdRef.current = node.id;
  }, []);

  const onNodeDragStop: OnNodeDrag<Node<OpenSeerNodeData>> = useCallback((_e, node) => {
    proportionalDragLeaderRef.current = null;

    const hoverId = edgeInsertHoverIdRef.current;
    edgeInsertHoverIdRef.current = null;
    setEdgeInsertHoverId(null);

    const eligible = edgeInsertEligibleRef.current;
    const grabOk = edgeInsertGrabNodeIdRef.current === node.id;
    edgeInsertEligibleRef.current = false;
    edgeInsertGrabNodeIdRef.current = null;

    if (!eligible || !grabOk || !hoverId) return;

    const B = node.id;
    setDoc((d) => {
      const path = groupPathRef.current;
      const v = getViewGraph(d.nodes, d.edges, path);
      const edge = v.edges.find((ed) => ed.id === hoverId);
      if (!edge) return d;
      const A = edge.source;
      const C = edge.target;
      if (A === B || C === B) return d;
      if (v.edges.some((ed) => ed.source === A && ed.target === B)) return d;
      if (v.edges.some((ed) => ed.source === B && ed.target === C)) return d;

      const ne = v.edges.filter((ed) => ed.id !== hoverId);
      const edgeTemplate = { ...edge } as Record<string, unknown>;
      delete edgeTemplate.id;
      delete edgeTemplate.source;
      delete edgeTemplate.target;
      delete edgeTemplate.sourceHandle;
      delete edgeTemplate.targetHandle;
      const edgeRest = edgeTemplate as Omit<Edge<OpenSeerEdgeData>, "id" | "source" | "target">;
      ne.push(
        {
          ...edgeRest,
          id: `e-${A}-${B}-${crypto.randomUUID().slice(0, 8)}`,
          source: A,
          target: B,
        },
        {
          ...edgeRest,
          id: `e-${B}-${C}-${crypto.randomUUID().slice(0, 8)}`,
          source: B,
          target: C,
        }
      );
      if (path.length === 0) return { nodes: d.nodes, edges: ne };
      return {
        nodes: patchNestedGraph(d.nodes, path, v.nodes, ne),
        edges: d.edges,
      };
    });
  }, []);

  const onSelectionDragStart: SelectionDragHandler<Node<OpenSeerNodeData>> = useCallback(
    (_e, nodes) => {
      if (nodes.length > 1) {
        edgeInsertEligibleRef.current = false;
      }
      const pm = proportionalLayoutRef.current;
      if (!pm) return;
      const set = new Set(pm.orderedIds);
      const first = nodes.find((n) => set.has(n.id));
      if (first) proportionalDragLeaderRef.current = first.id;
    },
    []
  );

  const onSelectionDragStop: SelectionDragHandler<Node<OpenSeerNodeData>> = useCallback(() => {
    proportionalDragLeaderRef.current = null;
    edgeInsertHoverIdRef.current = null;
    setEdgeInsertHoverId(null);
    edgeInsertEligibleRef.current = false;
    edgeInsertGrabNodeIdRef.current = null;
  }, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.data.nodeType === "group") {
      setGroupPath((p) => [...p, node.id]);
      setSelection({ nodeId: null, edgeId: null, multiNodeIds: null });
      initialFitDone.current = false;
      return;
    }
    if (node.data.nodeType === "text") {
      setTextEditNodeId(node.id);
      return;
    }
    if (node.data.nodeType === "code") {
      setCodeEditNodeId(node.id);
      return;
    }
    if (node.data.nodeType === "document") {
      const raw = node.data.documentUrl;
      const u = typeof raw === "string" ? raw.trim() : "";
      if (u) void openDocumentUrl(u);
    }
  }, []);

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

  const radialPos =
    ctxMenu?.kind === "pane" ? clampRadialMenuCenter(ctxMenu.clientX, ctxMenu.clientY) : null;

  const flowColumn = (
    <div
      ref={flowAreaRef}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0c0c0e]"
      onContextMenuCapture={onFlowContextMenuCapture}
      onContextMenu={onFlowContextMenu}
      onPointerEnter={() => {
        graphPointerInside.current = true;
      }}
      onPointerLeave={() => {
        graphPointerInside.current = false;
      }}
      onPointerMove={(e) => {
        graphPointerInside.current = true;
        lastGraphPointer.current = { x: e.clientX, y: e.clientY };
      }}
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
      <ShowNodeTypeHeadingContext.Provider value={showNodeTypeHeadings}>
        <EdgeControlContext.Provider value={edgeControlApi}>
        <ReactFlow
          className={`min-h-0 flex-1 bg-[#0c0c0e] ${groupPath.length > 0 && !focusMode ? "pt-0" : ""}`}
          minZoom={0.001}
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onSelectionContextMenu={onSelectionContextMenu}
          onSelectionDragStart={onSelectionDragStart}
          onSelectionDragStop={onSelectionDragStop}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDrag={handleNodeDrag}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onEdgeClick={onEdgeClick}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onPaneClick={onPaneClick}
          onBeforeDelete={onBeforeDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          elementsSelectable
          fitView
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={["Backspace", "Delete"]}
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
          snapToGrid={gridSnapEnabled}
          snapGrid={[20, 20]}
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
          {overviewVisible ? (
            <MiniMap
              className="!m-3 !rounded-md !border !border-zinc-700 !bg-zinc-900/90"
              nodeStrokeWidth={2}
              nodeColor={(n) => minimapColorForNodeType((n as Node<OpenSeerNodeData>).data?.nodeType)}
              maskColor="rgb(12, 12, 14, 0.85)"
            />
          ) : null}
        </ReactFlow>
        </EdgeControlContext.Provider>
      </ShowNodeTypeHeadingContext.Provider>
      {proportionalMoveUi ? (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-[24] -translate-x-1/2 rounded-md border border-amber-600/80 bg-amber-950/95 px-3 py-1.5 text-center text-xs font-medium text-amber-100 shadow-lg">
          Proportional move — M or Esc to exit
        </div>
      ) : null}
      {alignOverlay ? (
        <div
          ref={alignOverlayContainerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Choose alignment direction"
          tabIndex={-1}
          className="absolute inset-0 z-[25] flex flex-col items-center justify-center bg-black/55 outline-none"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Cancel alignment"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setAlignOverlay(null)}
          />
          <div className="relative z-[1] flex max-w-md flex-col items-center gap-5 rounded-xl border border-zinc-600 bg-zinc-900 px-10 py-9 shadow-2xl">
            <p className="text-center text-2xl font-semibold tracking-tight text-zinc-100">
              {alignOverlay === "distribute" ? "Distribute" : "Align"}
            </p>
            <p className="select-none text-xl text-zinc-400">↑ ↓ ← →</p>
            <div className="grid grid-cols-[2.5rem_2.5rem_2.5rem] grid-rows-[2.5rem_2.5rem_2.5rem] gap-1.5 place-items-center">
              <span className="col-start-2 row-start-1">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 text-lg text-zinc-100 hover:bg-zinc-700"
                  aria-label="Up"
                  onClick={() => applyAlignOverlayChoice("up", alignOverlay)}
                >
                  ↑
                </button>
              </span>
              <span className="col-start-1 row-start-2">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 text-lg text-zinc-100 hover:bg-zinc-700"
                  aria-label="Left"
                  onClick={() => applyAlignOverlayChoice("left", alignOverlay)}
                >
                  ←
                </button>
              </span>
              <span className="col-start-3 row-start-2">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 text-lg text-zinc-100 hover:bg-zinc-700"
                  aria-label="Right"
                  onClick={() => applyAlignOverlayChoice("right", alignOverlay)}
                >
                  →
                </button>
              </span>
              <span className="col-start-2 row-start-3">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 text-lg text-zinc-100 hover:bg-zinc-700"
                  aria-label="Down"
                  onClick={() => applyAlignOverlayChoice("down", alignOverlay)}
                >
                  ↓
                </button>
              </span>
            </div>
            <p className="text-center text-[11px] text-zinc-500">
              Arrow keys · Esc to cancel
            </p>
          </div>
        </div>
      ) : null}
      {ctxMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close menu"
            onClick={() => setCtxMenu(null)}
          />
          {ctxMenu.kind === "pane" && radialPos ? (
            <div
              className="fixed z-50"
              style={{
                left: radialPos.left,
                top: radialPos.top,
                transform: "translate(-50%, -50%)",
              }}
            >
              <RadialCreateNodeMenu
                onPick={(t) => {
                  onAddNodeAt(t, { x: ctxMenu.flowX, y: ctxMenu.flowY });
                  setCtxMenu(null);
                }}
                onClose={() => setCtxMenu(null)}
              />
            </div>
          ) : ctxMenu.kind === "nodes" ? (
            <div
              className="fixed z-50 max-h-[min(70vh,360px)] w-52 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              style={(() => {
                const { left, top } = clampFixedMenuPosition(
                  ctxMenu.clientX,
                  ctxMenu.clientY,
                  CTX_MENU_W,
                  CTX_MENU_H_NODES
                );
                return { left, top };
              })()}
            >
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
              {ctxMenuAnchorNode ? (
                <>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      if (ctxMenu.kind !== "nodes") return;
                      const n = ctxMenuAnchorNode;
                      if (!n) return;
                      const pos = clampFixedMenuPosition(
                        ctxMenu.clientX + CTX_MENU_W + 6,
                        ctxMenu.clientY,
                        STYLE_PANEL_W,
                        STYLE_PANEL_H
                      );
                      setNodeStylePicker({
                        mode: "header",
                        targetIds: [...ctxMenu.selectedIds],
                        anchorData: n.data,
                        position: pos,
                      });
                      setCtxMenu(null);
                    }}
                  >
                    Change Header Color
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      if (ctxMenu.kind !== "nodes") return;
                      const n = ctxMenuAnchorNode;
                      if (!n) return;
                      const pos = clampFixedMenuPosition(
                        ctxMenu.clientX + CTX_MENU_W + 6,
                        ctxMenu.clientY,
                        STYLE_PANEL_W,
                        STYLE_PANEL_H
                      );
                      setNodeStylePicker({
                        mode: "body",
                        targetIds: [...ctxMenu.selectedIds],
                        anchorData: n.data,
                        position: pos,
                      });
                      setCtxMenu(null);
                    }}
                  >
                    Change Background Color
                  </button>
                </>
              ) : null}
              <p className="px-3 py-1 text-[11px] text-zinc-600">
                {ctxMenu.selectedIds.length < 2
                  ? "Select 2+ nodes (Shift-click) to group nodes together."
                  : ""}
              </p>
            </div>
          ) : ctxMenu.kind === "edge" ? (
            <div
              className="fixed z-50 w-52 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              style={(() => {
                const { left, top } = clampFixedMenuPosition(
                  ctxMenu.clientX,
                  ctxMenu.clientY,
                  CTX_MENU_W,
                  CTX_MENU_H_EDGE
                );
                return { left, top };
              })()}
            >
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={() => {
                  if (ctxMenu.kind !== "edge") return;
                  const pointId = addControlPointAtFlow(ctxMenu.edgeId, ctxMenu.flowX, ctxMenu.flowY);
                  setSelectedControlPoint({ edgeId: ctxMenu.edgeId, pointId });
                  setCtxMenu(null);
                }}
              >
                Add Control Point
              </button>
              <p className="px-3 py-1 text-[11px] font-medium uppercase text-zinc-500">Edge type</p>
              {(
                [
                  ["straight", "Straight"],
                  ["orthogonal", "Orthogonal"],
                  ["bezier", "Curved"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => {
                    if (ctxMenu.kind !== "edge") return;
                    const ed = view.edges.find((x) => x.id === ctxMenu.edgeId);
                    if (!ed) return;
                    const prev = ed.data as OpenSeerEdgeData | undefined;
                    onPatchEdge(ctxMenu.edgeId, {
                      ...prev,
                      label: String(ed.label ?? prev?.label ?? "relates_to"),
                      relationshipType: prev?.relationshipType ?? "relates_to",
                      type: value,
                    });
                    setCtxMenu(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {nodeStylePicker ? (
        <NodeStyleColorPanel
          mode={nodeStylePicker.mode}
          anchorData={nodeStylePicker.anchorData}
          targetIds={nodeStylePicker.targetIds}
          onLivePatch={onPatchNodes}
          onClose={() => setNodeStylePicker(null)}
          position={nodeStylePicker.position}
        />
      ) : null}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1">
      {!focusMode ? (
        <GraphSidebar
          graphName={graphMeta.name}
          onGraphNameChange={onGraphNameChange}
          collapsed={graphPanelCollapsed}
          onToggleCollapsed={toggleGraphPanelCollapsed}
          showNodeTypeHeadings={showNodeTypeHeadings}
          onToggleShowNodeTypeHeadings={toggleShowNodeTypeHeadings}
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
          multiSelectedNodes={multiSelectedNodes}
          viewNodes={view.nodes}
          onPatchNode={onPatchNode}
          onPatchEdge={onPatchEdge}
          onDeleteNode={onDeleteNode}
          onDeleteEdge={onDeleteEdge}
        />
      ) : null}
      <TextNodeEditModal
        nodeId={textEditNodeId}
        nodes={view.nodes}
        onPatchNode={onPatchNode}
        onClose={() => setTextEditNodeId(null)}
      />
      <CodeNodeEditModal
        nodeId={codeEditNodeId}
        nodes={view.nodes}
        onPatchNode={onPatchNode}
        onClose={() => setCodeEditNodeId(null)}
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
