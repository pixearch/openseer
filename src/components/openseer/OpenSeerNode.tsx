"use client";

import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  GROUP_STANDARD_HEIGHT,
  GROUP_STANDARD_WIDTH,
  NODE_STANDARD_HEIGHT,
  NODE_STANDARD_WIDTH,
} from "@/lib/default-node";
import { FRAME_HEADER_RESERVE_PX } from "@/lib/graph/frame-chrome";
import { CodeEditorTextarea } from "@/components/openseer/CodeEditorTextarea";
import { useShowNodeTypeHeading } from "@/components/openseer/graph-workspace-ui-context";
import { documentPreviewMeta, openDocumentUrl } from "@/lib/document-open";
import { copyAllCodeBlocks, newCodeBlockId, normalizeCodeBlocksForDisplay } from "@/lib/code-blocks";
import {
  DEFAULT_TITLE_BY_TYPE,
  minimapColorForNodeType,
  NODE_TYPE_ACCENT_CLASS,
  NODE_TYPE_LABEL,
} from "@/lib/node-type-meta";
import type { CodeBlockEntry, OpenSeerEdgeData, OpenSeerNodeData } from "@/lib/types/graph";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube";

const HUB_SIDES_MIN = 3;
const HUB_SIDES_MAX = 16;

function clampHubSides(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 6;
  return Math.min(HUB_SIDES_MAX, Math.max(HUB_SIDES_MIN, n));
}

function hubGeometry(sides: number, bw: number, bh: number) {
  const cx = bw / 2;
  const cy = bh / 2;
  const inset = 10;
  const R = Math.max(8, Math.min(bw, bh) / 2 - inset);
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    verts.push({ x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) });
  }
  return {
    points: verts.map((p) => `${p.x},${p.y}`).join(" "),
    verts,
  };
}

function hubHandleStyle(leftPct: number, topPct: number): CSSProperties {
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: "translate(-50%, -50%)",
  };
}

/** Large transparent hit target; small visible tab is `.os-quad-handle-visual` inside. */
const QUAD_HANDLE_CLASS =
  "os-quad-handle !z-[2] !h-6 !w-6 !min-h-6 !min-w-6 !rounded-none !border-0 !bg-transparent !shadow-none !pointer-events-auto relative box-border";

function quadHandleVisualLayout(position: Position): string {
  switch (position) {
    case Position.Right:
      return "left-[9px] top-1/2 h-3 w-2.5 -translate-y-1/2";
    case Position.Left:
      return "right-[9px] top-1/2 h-3 w-2.5 -translate-y-1/2";
    case Position.Top:
      return "bottom-[9px] left-1/2 h-2.5 w-3 -translate-x-1/2";
    case Position.Bottom:
      return "top-[9px] left-1/2 h-2.5 w-3 -translate-x-1/2";
    default:
      return "";
  }
}

function QuadHandleFace({ position }: { position: Position }) {
  return (
    <span
      className={`os-quad-handle-visual pointer-events-none absolute rounded-sm border border-zinc-500 bg-zinc-800 ${quadHandleVisualLayout(position)}`}
      aria-hidden
    />
  );
}

/** Targets first (left before others) and sources with right first so legacy edges without handle ids keep left/right attachment. */
function QuadrilateralHandles({ nodeId }: { nodeId: string }) {
  const p = nodeId;
  return (
    <>
      <Handle
        type="target"
        id={`${p}__lt`}
        position={Position.Left}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Left} />
      </Handle>
      <Handle
        type="target"
        id={`${p}__tt`}
        position={Position.Top}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Top} />
      </Handle>
      <Handle
        type="target"
        id={`${p}__rt`}
        position={Position.Right}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Right} />
      </Handle>
      <Handle
        type="target"
        id={`${p}__bt`}
        position={Position.Bottom}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Bottom} />
      </Handle>
      <Handle
        type="source"
        id={`${p}__rs`}
        position={Position.Right}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Right} />
      </Handle>
      <Handle
        type="source"
        id={`${p}__ts`}
        position={Position.Top}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Top} />
      </Handle>
      <Handle
        type="source"
        id={`${p}__ls`}
        position={Position.Left}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Left} />
      </Handle>
      <Handle
        type="source"
        id={`${p}__bs`}
        position={Position.Bottom}
        className={QUAD_HANDLE_CLASS}
      >
        <QuadHandleFace position={Position.Bottom} />
      </Handle>
    </>
  );
}

function thumbnailNodeSize(n: Node<OpenSeerNodeData>): { w: number; h: number } {
  if (typeof n.width === "number" && typeof n.height === "number") {
    return { w: n.width, h: n.height };
  }
  if (n.data.nodeType === "group") {
    return { w: GROUP_STANDARD_WIDTH, h: GROUP_STANDARD_HEIGHT };
  }
  return { w: NODE_STANDARD_WIDTH, h: NODE_STANDARD_HEIGHT };
}

function NestedGraphThumbnail({
  nodes,
  edges = [],
}: {
  nodes: Node<OpenSeerNodeData>[];
  edges?: Edge<OpenSeerEdgeData>[];
}) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[72px] w-full items-center justify-center rounded-md border border-zinc-800/90 bg-zinc-950/60">
        <p className="text-center text-[10px] text-zinc-600">Empty subgraph</p>
      </div>
    );
  }

  const items = nodes.map((n) => {
    const { w, h } = thumbnailNodeSize(n);
    const x = n.position.x;
    const y = n.position.y;
    return {
      id: n.id,
      x,
      y,
      w,
      h,
      nt: n.data.nodeType,
      cx: x + w / 2,
      cy: y + h / 2,
    };
  });

  const minX = Math.min(...items.map((b) => b.x));
  const minY = Math.min(...items.map((b) => b.y));
  const maxX = Math.max(...items.map((b) => b.x + b.w));
  const maxY = Math.max(...items.map((b) => b.y + b.h));
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const pad = Math.max(bw, bh) * 0.08;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = bw + pad * 2;
  const vbH = bh + pad * 2;
  const stroke = Math.max(vbW, vbH) * 0.0035;
  const nodeById = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="h-full min-h-[72px] w-full overflow-hidden rounded-md border border-zinc-700/90 bg-zinc-950/90 shadow-[inset_0_1px_0_rgb(39_39_42/0.5)]">
      <svg
        width="100%"
        height="100%"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block"
        aria-hidden
      >
        {edges.map((e) => {
          const s = nodeById.get(e.source);
          const t = nodeById.get(e.target);
          if (!s || !t) return null;
          return (
            <line
              key={e.id}
              x1={s.cx}
              y1={s.cy}
              x2={t.cx}
              y2={t.cy}
              stroke="#64748b"
              strokeWidth={stroke * 1.2}
              strokeLinecap="round"
              opacity={0.9}
            />
          );
        })}
        {items.map((b) => (
          <rect
            key={b.id}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={stroke * 3}
            ry={stroke * 3}
            fill={minimapColorForNodeType(b.nt)}
            stroke="#18181b"
            strokeWidth={stroke}
            opacity={0.97}
          />
        ))}
      </svg>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-zinc-500",
  active: "bg-emerald-500",
  blocked: "bg-rose-500",
  done: "bg-sky-500",
  archived: "bg-zinc-600",
};

function OpenSeerNodeInner(props: NodeProps<Node<OpenSeerNodeData>>) {
  const { data, selected, id } = props;
  const w = typeof props.width === "number" ? props.width : undefined;
  const h = typeof props.height === "number" ? props.height : undefined;
  const [lightbox, setLightbox] = useState(false);
  const [videoLightbox, setVideoLightbox] = useState(false);
  const [imgCtxMenu, setImgCtxMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const showTypeHeading = useShowNodeTypeHeading();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const documentFileRef = useRef<HTMLInputElement>(null);

  const applyImageFromFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, imageUrl: url } } : n
          )
        );
      };
      reader.readAsDataURL(file);
    },
    [id, setNodes]
  );

  const clearImage = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, imageUrl: "" } } : n
      )
    );
  }, [id, setNodes]);

  const applyVideoFromFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, videoUrl: url } } : n
          )
        );
      };
      reader.readAsDataURL(file);
    },
    [id, setNodes]
  );

  const applyDocumentFromFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, documentUrl: url } } : n
          )
        );
      };
      reader.readAsDataURL(file);
    },
    [id, setNodes]
  );

  const hubRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data.nodeType !== "hub") return;
    updateNodeInternals(id);
  }, [data.hubSides, data.nodeType, id, updateNodeInternals, w, h]);

  useEffect(() => {
    if (data.nodeType !== "hub") return;
    const el = hubRootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !selected) return;
      e.preventDefault();
      e.stopPropagation();
      const dir = e.deltaY < 0 ? 1 : -1;
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id !== id || n.data.nodeType !== "hub") return n;
          const cur = clampHubSides(n.data.hubSides);
          const next = Math.min(HUB_SIDES_MAX, Math.max(HUB_SIDES_MIN, cur + dir));
          if (next === cur) return n;
          return { ...n, data: { ...n.data, hubSides: next } };
        })
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [data.nodeType, id, selected, setNodes]);

  const maybeAutofillYoutubeMeta = useCallback(
    (videoUrl: string) => {
      const trimmed = videoUrl.trim();
      if (!parseYoutubeVideoId(trimmed)) return;
      void fetch(`/api/youtube-metadata?url=${encodeURIComponent(trimmed)}`).then(async (r) => {
        if (!r.ok) return;
        const meta = (await r.json()) as { title?: string; author?: string };
        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id !== id) return n;
            const t = String(n.data.title ?? "").trim();
            if (t && t !== DEFAULT_TITLE_BY_TYPE.video) return n;
            const next: Partial<OpenSeerNodeData> = {};
            if (typeof meta.title === "string" && meta.title) next.title = meta.title;
            if (typeof meta.author === "string" && meta.author && !String(n.data.owner ?? "").trim()) {
              next.owner = meta.author;
            }
            if (Object.keys(next).length === 0) return n;
            return { ...n, data: { ...n.data, ...next } };
          })
        );
      });
    },
    [id, setNodes]
  );

  const accent = NODE_TYPE_ACCENT_CLASS[data.nodeType];
  const typeLabel = NODE_TYPE_LABEL[data.nodeType];
  const statusClass = STATUS_DOT[data.status] ?? "bg-zinc-500";

  const previewTags = data.tags.slice(0, 2);
  const moreTags = data.tags.length > 2 ? data.tags.length - 2 : 0;

  const resizerGroup = (
    <NodeResizer
      isVisible={selected}
      minWidth={GROUP_STANDARD_WIDTH}
      minHeight={GROUP_STANDARD_HEIGHT}
      handleClassName="!h-2 !w-2 !rounded-sm !border !border-zinc-500 !bg-zinc-800"
      lineClassName="!border-zinc-500"
      color="#71717a"
    />
  );

  const resizerStandard = (
    <NodeResizer
      isVisible={selected}
      minWidth={NODE_STANDARD_WIDTH}
      minHeight={NODE_STANDARD_HEIGHT}
      handleClassName="!h-2 !w-2 !rounded-sm !border !border-zinc-500 !bg-zinc-800"
      lineClassName="!border-zinc-500"
      color="#71717a"
    />
  );

  if (data.nodeType === "frame") {
    const fw = w ?? NODE_STANDARD_WIDTH;
    const fh = h ?? NODE_STANDARD_HEIGHT;
    return (
      <div
        className={[
          "relative flex min-h-0 flex-col overflow-visible rounded-lg border-2 border-dashed border-slate-500/80 bg-zinc-950/40 shadow-lg",
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: fw, height: fh }}
      >
        {resizerStandard}
        <QuadrilateralHandles nodeId={id} />
        <div
          className="box-border flex shrink-0 flex-col justify-center gap-0.5 overflow-hidden border-b border-slate-800/80 bg-slate-950/50 px-2 py-1 leading-tight"
          style={{ height: FRAME_HEADER_RESERVE_PX }}
        >
          {showTypeHeading ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {typeLabel}
            </span>
          ) : null}
          <div className="truncate text-sm font-semibold text-zinc-100">{data.title}</div>
        </div>
        <div className="min-h-0 flex-1 rounded-b-md bg-transparent" />
      </div>
    );
  }

  if (data.nodeType === "group") {
    const gw = w ?? GROUP_STANDARD_WIDTH;
    const gh = h ?? GROUP_STANDARD_HEIGHT;
    const nested = (data.nestedGraph?.nodes ?? []) as Node<OpenSeerNodeData>[];
    const nestedEdges = (data.nestedGraph?.edges ?? []) as Edge<OpenSeerEdgeData>[];
    return (
      <div
        className={[
          "relative flex min-h-0 flex-col overflow-visible rounded-lg border-2 border-dashed border-teal-600/70 bg-zinc-950/90 shadow-lg",
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: gw, height: gh }}
      >
        {resizerGroup}
        <QuadrilateralHandles nodeId={id} />
        <div className="shrink-0 border-b border-teal-900/50 bg-teal-950/40 px-2 py-1.5">
          {showTypeHeading ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400/90">
              {typeLabel}
            </span>
          ) : null}
          <div className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{data.title}</div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2 pt-1">
          <div className="min-h-[96px] min-w-0 flex-1">
            <NestedGraphThumbnail nodes={nested} edges={nestedEdges} />
          </div>
          <p className="shrink-0 text-center text-[10px] text-zinc-600">Double-click to open</p>
        </div>
      </div>
    );
  }

  if (data.nodeType === "hub") {
    const bw = w ?? NODE_STANDARD_WIDTH;
    const bh = h ?? NODE_STANDARD_HEIGHT;
    const sides = clampHubSides(data.hubSides);
    const { points, verts } = hubGeometry(sides, bw, bh);

    return (
      <div
        ref={hubRootRef}
        className={[
          "relative",
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: bw, height: bh }}
      >
        {resizerStandard}
        <svg
          width={bw}
          height={bh}
          className="pointer-events-none absolute inset-0 z-0 block"
          aria-hidden
        >
          <polygon
            points={points}
            fill="rgb(24 24 27 / 0.95)"
            stroke="rgb(139 92 246 / 0.5)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center px-8 text-center">
          {showTypeHeading ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/90">
              {typeLabel}
            </span>
          ) : null}
          <div className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-100">{data.title}</div>
        </div>
        {verts.map((v, i) => {
          const st = hubHandleStyle((v.x / bw) * 100, (v.y / bh) * 100);
          return (
            <span key={i} className="contents">
              <Handle
                type="target"
                id={`hub-${i}-t`}
                position={Position.Top}
                className="!z-[2] !h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
                style={st}
              />
              <Handle
                type="source"
                id={`hub-${i}-s`}
                position={Position.Top}
                className="!z-[2] !h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
                style={st}
              />
            </span>
          );
        })}
      </div>
    );
  }

  if (data.nodeType === "image") {
    const onImageDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onImageDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files[0];
      if (f) applyImageFromFile(f);
    };

    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) applyImageFromFile(f);
            e.target.value = "";
          }}
        />
        <div
          className={[
            "relative flex min-h-0 flex-col overflow-visible rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
            "border-l-[3px]",
            accent,
            selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
          ].join(" ")}
          style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
          onContextMenu={(e: ReactMouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setImgCtxMenu({ clientX: e.clientX, clientY: e.clientY });
          }}
        >
          {resizerStandard}
          <QuadrilateralHandles nodeId={id} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 py-1">
            <div className="min-w-0 flex-1">
              {showTypeHeading ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {typeLabel}
                </span>
              ) : null}
              <div className="truncate text-sm font-medium text-zinc-100">{data.title}</div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => fileRef.current?.click()}
            >
              Load…
            </button>
          </div>
          {data.imageUrl ? (
            <button
              type="button"
              className="flex min-h-0 w-full flex-1 cursor-zoom-in items-center justify-center bg-zinc-950 focus:outline-none"
              onClick={() => setLightbox(true)}
              onDragOver={onImageDragOver}
              onDrop={onImageDrop}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.imageUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </button>
          ) : (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 bg-zinc-950 px-2 text-center text-xs text-zinc-600"
              onDragOver={onImageDragOver}
              onDrop={onImageDrop}
            >
              <span>Set image URL or drop a file</span>
            </div>
          )}
          </div>
        </div>
        {lightbox && data.imageUrl && typeof document !== "undefined"
          ? createPortal(
              <button
                type="button"
                className="fixed inset-0 z-[300] flex cursor-default items-center justify-center bg-black/85 p-4"
                onClick={() => setLightbox(false)}
                aria-label="Close image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.imageUrl}
                  alt=""
                  className="max-h-[90vh] max-w-[90vw] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </button>,
              document.body
            )
          : null}
        {imgCtxMenu && typeof document !== "undefined"
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[280] cursor-default bg-transparent"
                  aria-label="Close menu"
                  onClick={() => setImgCtxMenu(null)}
                />
                <div
                  className="fixed z-[281] w-44 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
                  style={{ left: imgCtxMenu.clientX, top: imgCtxMenu.clientY }}
                >
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      setImgCtxMenu(null);
                      fileRef.current?.click();
                    }}
                  >
                    Replace image…
                  </button>
                  {data.imageUrl ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => {
                        setImgCtxMenu(null);
                        clearImage();
                      }}
                    >
                      Delete image
                    </button>
                  ) : null}
                </div>
              </>,
              document.body
            )
          : null}
      </>
    );
  }

  if (data.nodeType === "video") {
    const onVideoDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onVideoDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files[0];
      if (f) {
        applyVideoFromFile(f);
        return;
      }
      const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      const trimmed = uri.trim();
      if (trimmed) {
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, videoUrl: trimmed } } : n
          )
        );
        maybeAutofillYoutubeMeta(trimmed);
      }
    };
    const promptVideoUrl = () => {
      const next = window.prompt("Video URL", data.videoUrl?.trim() ?? "");
      if (next === null) return;
      const trimmed = next.trim();
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, videoUrl: trimmed } } : n
        )
      );
      maybeAutofillYoutubeMeta(trimmed);
    };
    const ytId = data.videoUrl ? parseYoutubeVideoId(data.videoUrl) : null;

    return (
      <>
        <input
          ref={videoFileRef}
          type="file"
          accept="video/*"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) applyVideoFromFile(f);
            e.target.value = "";
          }}
        />
        <div
          className={[
            "relative flex min-h-0 flex-col overflow-visible rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
            "border-l-[3px]",
            accent,
            selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
          ].join(" ")}
          style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
        >
          {resizerStandard}
          <QuadrilateralHandles nodeId={id} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 py-1">
            <div className="min-w-0 flex-1">
              {showTypeHeading ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {typeLabel}
                </span>
              ) : null}
              <div className="truncate text-sm font-medium text-zinc-100">{data.title}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                onClick={() => videoFileRef.current?.click()}
              >
                Load…
              </button>
              <button
                type="button"
                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                onClick={promptVideoUrl}
              >
                URL…
              </button>
              {data.videoUrl?.trim() ? (
                <a
                  href={data.videoUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                >
                  Open link
                </a>
              ) : null}
            </div>
          </div>
          {data.videoUrl ? (
            <button
              type="button"
              className="flex min-h-0 w-full flex-1 cursor-zoom-in items-center justify-center bg-zinc-950 focus:outline-none"
              onClick={() => setVideoLightbox(true)}
              onDragOver={onVideoDragOver}
              onDrop={onVideoDrop}
            >
              {ytId ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youtubeThumbnailUrl(ytId, "hq")}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </>
              ) : (
                <video
                  className="max-h-full max-w-full object-contain pointer-events-none"
                  src={data.videoUrl}
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
            </button>
          ) : (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 bg-zinc-950 px-2 text-center text-xs text-zinc-600"
              onDragOver={onVideoDragOver}
              onDrop={onVideoDrop}
            >
              <span>Set video URL or drop a file</span>
            </div>
          )}
          </div>
        </div>
        {videoLightbox && data.videoUrl && typeof document !== "undefined"
          ? createPortal(
              <button
                type="button"
                className="fixed inset-0 z-[300] flex cursor-default items-center justify-center bg-black/85 p-4"
                onClick={() => setVideoLightbox(false)}
                aria-label="Close video preview"
              >
                <div
                  className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ytId ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={youtubeThumbnailUrl(ytId, "hq")}
                        alt=""
                        className="max-h-[80vh] max-w-full object-contain"
                      />
                    </>
                  ) : (
                    <video
                      className="max-h-[80vh] max-w-full object-contain"
                      src={data.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )}
                  <p className="max-w-[90vw] text-center text-sm font-medium text-zinc-100">
                    {data.title}
                  </p>
                </div>
              </button>,
              document.body
            )
          : null}
      </>
    );
  }

  if (data.nodeType === "document") {
    const onDocDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDocDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files[0];
      if (f) {
        applyDocumentFromFile(f);
        return;
      }
      const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      const trimmed = uri.trim();
      if (trimmed) {
        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, documentUrl: trimmed } } : n
          )
        );
      }
    };
    const promptDocumentUrl = () => {
      const next = window.prompt("Document URL", data.documentUrl?.trim() ?? "");
      if (next === null) return;
      const trimmed = next.trim();
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, documentUrl: trimmed } } : n
        )
      );
    };
    const docUrl = data.documentUrl?.trim() ?? "";
    const canDownload = Boolean(docUrl);
    const docPreview = docUrl ? documentPreviewMeta(docUrl) : null;

    return (
      <>
        <input
          ref={documentFileRef}
          type="file"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) applyDocumentFromFile(f);
            e.target.value = "";
          }}
        />
        <div
          className={[
            "relative flex min-h-0 flex-col overflow-visible rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
            "border-l-[3px]",
            accent,
            selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
          ].join(" ")}
          style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
        >
          {resizerStandard}
          <QuadrilateralHandles nodeId={id} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 py-1">
            <div className="min-w-0 flex-1">
              {showTypeHeading ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {typeLabel}
                </span>
              ) : null}
              <div className="truncate text-sm font-medium text-zinc-100">{data.title}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                onClick={() => documentFileRef.current?.click()}
              >
                Load…
              </button>
              <button
                type="button"
                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                onClick={promptDocumentUrl}
              >
                URL…
              </button>
              {docUrl ? (
                <button
                  type="button"
                  className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                  onClick={() => void openDocumentUrl(docUrl)}
                >
                  Open
                </button>
              ) : null}
              {canDownload ? (
                <a
                  href={docUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                >
                  Download
                </a>
              ) : null}
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-2 bg-zinc-950 px-3 py-2"
            onDragOver={onDocDragOver}
            onDrop={onDocDrop}
          >
            {docUrl && docPreview ? (
              <div className="flex min-h-[88px] w-full flex-col gap-2 rounded-md border border-amber-900/45 bg-zinc-900/90 p-2.5">
                <div className="flex items-start gap-2.5">
                  <svg
                    className="h-10 w-8 shrink-0 text-amber-500/90"
                    viewBox="0 0 40 48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M8 4h16l8 8v32H8z" strokeLinejoin="round" />
                    <path d="M24 4v12h8" strokeLinejoin="round" />
                    <path d="M12 28h16M12 34h10" strokeLinecap="round" />
                  </svg>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-semibold text-amber-100/95">{docPreview.typeLabel}</p>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500" title={docPreview.detail}>
                      {docPreview.detail}
                    </p>
                    {!docUrl.startsWith("data:") ? (
                      <p
                        className="mt-1 line-clamp-2 break-all text-[10px] text-zinc-600"
                        title={docUrl}
                      >
                        {docUrl}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600">Double-click or use Open to view</p>
              </div>
            ) : (
              <>
                <svg
                  className="mx-auto h-14 w-11 shrink-0 text-amber-500/85"
                  viewBox="0 0 40 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M8 4h16l8 8v32H8z" strokeLinejoin="round" />
                  <path d="M24 4v12h8" strokeLinejoin="round" />
                  <path d="M12 28h16M12 34h10" strokeLinecap="round" />
                </svg>
                <p className="text-center text-xs text-zinc-600">Set document URL or drop a file</p>
              </>
            )}
          </div>
          </div>
        </div>
      </>
    );
  }

  if (data.nodeType === "code") {
    const blocks = normalizeCodeBlocksForDisplay(id, data.codeBlocks);
    const patchBlocks = (next: CodeBlockEntry[]) => {
      setNodes((nodes) =>
        nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, codeBlocks: next } } : n))
      );
    };
    const copyAll = () => void navigator.clipboard.writeText(copyAllCodeBlocks(blocks));

    const copyIcon = (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    );

    const trashIcon = (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14" />
      </svg>
    );

    return (
      <div
        className={[
          "relative flex min-h-0 flex-col overflow-visible rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
          "border-l-[3px]",
          accent,
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
      >
        {resizerStandard}
        <QuadrilateralHandles nodeId={id} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
        <div className="flex shrink-0 flex-col gap-1 border-b border-zinc-800/80 px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {showTypeHeading ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {typeLabel}
                </span>
              ) : null}
              <div className="truncate text-sm font-semibold text-zinc-100">{data.title}</div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                onClick={() => void copyAll()}
              >
                Copy all
              </button>
              <button
                type="button"
                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                onClick={() =>
                  patchBlocks([...blocks, { id: newCodeBlockId(), content: "" }])
                }
              >
                + Block
              </button>
            </div>
          </div>
          <p className="text-[9px] text-zinc-600">Double-click node for full editor</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex min-h-0 gap-1 rounded border border-zinc-800/90 bg-zinc-950/60 p-1"
            >
              <CodeEditorTextarea
                value={block.content}
                onChange={(content) =>
                  patchBlocks(blocks.map((b) => (b.id === block.id ? { ...b, content } : b)))
                }
                className="min-h-[52px] min-w-0 flex-1 resize-y rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-100 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-zinc-600 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Copy block"
                  aria-label="Copy block"
                  onClick={() => void navigator.clipboard.writeText(block.content)}
                >
                  {copyIcon}
                </button>
                <button
                  type="button"
                  disabled={blocks.length <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded border border-zinc-600 text-zinc-400 hover:bg-rose-950/60 hover:text-rose-200 disabled:opacity-40"
                  title="Delete block"
                  aria-label="Delete block"
                  onClick={() => {
                    if (blocks.length <= 1) return;
                    patchBlocks(blocks.filter((b) => b.id !== block.id));
                  }}
                >
                  {trashIcon}
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    );
  }

  const isTextNode = data.nodeType === "text";

  return (
    <div
      className={[
        "relative rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg backdrop-blur-sm",
        "border-l-[3px]",
        accent,
        selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        isTextNode ? "flex min-h-0 flex-col overflow-visible" : "",
      ].join(" ")}
      style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
    >
      {resizerStandard}
      <QuadrilateralHandles nodeId={id} />
      <div
        className={
          isTextNode
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-md"
            : "contents"
        }
      >
      <div
        className={[
          "border-b border-zinc-800/80 px-3 py-2",
          isTextNode ? "shrink-0" : "",
        ].join(" ")}
      >
        <div
          className={[
            "flex items-center gap-2",
            showTypeHeading ? "justify-between" : "justify-end",
          ].join(" ")}
        >
          {showTypeHeading ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {typeLabel}
            </span>
          ) : null}
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusClass}`}
            title={data.status}
          />
        </div>
        <div className="mt-1 font-medium leading-snug text-zinc-100">{data.title}</div>
      </div>
      <div
        className={[
          isTextNode
            ? "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2"
            : "space-y-2 px-3 py-2",
        ].join(" ")}
      >
        {data.nodeType === "evidence" && data.imageUrl ? (
          <div className="overflow-hidden rounded border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.imageUrl} alt="" className="max-h-24 w-full object-cover" />
          </div>
        ) : null}
        {data.nodeType === "evidence" && data.videoUrl ? (
          <video
            className="max-h-24 w-full rounded border border-zinc-800 object-cover"
            src={data.videoUrl}
            muted
            playsInline
            preload="metadata"
          />
        ) : null}
        {data.nodeType === "evidence" && data.sourceLink ? (
          <a
            href={data.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            {data.sourceLink}
          </a>
        ) : null}
        {data.shortDescription ? (
          <p
            className={
              isTextNode
                ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400"
                : "line-clamp-3 text-xs leading-relaxed text-zinc-400"
            }
          >
            {data.shortDescription}
          </p>
        ) : data.nodeType !== "evidence" || (!data.imageUrl && !data.videoUrl) ? (
          <p className="text-xs italic text-zinc-600">No description</p>
        ) : null}
        {data.owner ? (
          <p className={`text-[11px] text-zinc-500${isTextNode ? " shrink-0" : ""}`}>
            <span className="text-zinc-600">Owner</span> {data.owner}
          </p>
        ) : null}
        {previewTags.length > 0 ? (
          <div className={`flex flex-wrap gap-1${isTextNode ? " shrink-0" : ""}`}>
            {previewTags.map((t) => (
              <span
                key={t}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                {t}
              </span>
            ))}
            {moreTags > 0 ? (
              <span className="text-[10px] text-zinc-600">+{moreTags}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}

export const OpenSeerNode = memo(OpenSeerNodeInner);
