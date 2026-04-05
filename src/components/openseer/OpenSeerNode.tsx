"use client";

import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  memo,
  useCallback,
  useRef,
  useState,
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
import {
  minimapColorForNodeType,
  NODE_TYPE_ACCENT_CLASS,
  NODE_TYPE_LABEL,
} from "@/lib/node-type-meta";
import type { OpenSeerEdgeData, OpenSeerNodeData } from "@/lib/types/graph";

/** YouTube watch/embed/shorts and youtu.be — used for a static thumbnail in the node card. */
function youtubeVideoId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/watch")) {
        const id = u.searchParams.get("v");
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.slice(7).split("/")[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.slice(8).split("/")[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* relative or invalid URL */
  }
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return m?.[1] ?? null;
}

function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
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
  const [imgCtxMenu, setImgCtxMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const { setNodes } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

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
          "flex min-h-0 flex-col rounded-lg border-2 border-dashed border-slate-500/80 bg-zinc-950/40 shadow-lg",
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: fw, height: fh }}
      >
        {resizerStandard}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
        <div
          className="box-border flex shrink-0 flex-col justify-center gap-0.5 overflow-hidden border-b border-slate-800/80 bg-slate-950/50 px-2 py-1 leading-tight"
          style={{ height: FRAME_HEADER_RESERVE_PX }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {typeLabel}
          </span>
          <div className="truncate text-sm font-semibold text-zinc-100">{data.title}</div>
        </div>
        <div className="min-h-0 flex-1 rounded-b-md bg-transparent" />
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
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
          "flex min-h-0 flex-col rounded-lg border-2 border-dashed border-teal-600/70 bg-zinc-950/90 shadow-lg",
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: gw, height: gh }}
      >
        {resizerGroup}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
        <div className="shrink-0 border-b border-teal-900/50 bg-teal-950/40 px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400/90">
            {typeLabel}
          </span>
          <div className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{data.title}</div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2 pt-1">
          <div className="min-h-[96px] min-w-0 flex-1">
            <NestedGraphThumbnail nodes={nested} edges={nestedEdges} />
          </div>
          <p className="shrink-0 text-center text-[10px] text-zinc-600">Double-click to open</p>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
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
            "flex min-h-0 flex-col overflow-hidden rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
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
          <Handle
            type="target"
            position={Position.Left}
            className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
          />
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 py-1">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {typeLabel}
              </span>
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
          <Handle
            type="source"
            position={Position.Right}
            className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
          />
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
    };
    const ytId = data.videoUrl ? youtubeVideoId(data.videoUrl) : null;

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
            "flex min-h-0 flex-col overflow-hidden rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
            "border-l-[3px]",
            accent,
            selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
          ].join(" ")}
          style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
        >
          {resizerStandard}
          <Handle
            type="target"
            position={Position.Left}
            className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
          />
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 py-1">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {typeLabel}
              </span>
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
            <div
              className="flex min-h-0 w-full flex-1 items-center justify-center bg-zinc-950"
              onDragOver={onVideoDragOver}
              onDrop={onVideoDrop}
            >
              {ytId ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youtubeThumbnailUrl(ytId)}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </>
              ) : (
                <video
                  className="max-h-full max-w-full object-contain"
                  src={data.videoUrl}
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
            </div>
          ) : (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 bg-zinc-950 px-2 text-center text-xs text-zinc-600"
              onDragOver={onVideoDragOver}
              onDrop={onVideoDrop}
            >
              <span>Set video URL or drop a file</span>
            </div>
          )}
          <Handle
            type="source"
            position={Position.Right}
            className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
          />
        </div>
      </>
    );
  }

  const isTextNode = data.nodeType === "text";

  return (
    <div
      className={[
        "rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg backdrop-blur-sm",
        "border-l-[3px]",
        accent,
        selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        isTextNode ? "flex min-h-0 flex-col overflow-hidden" : "",
      ].join(" ")}
      style={{ width: w ?? NODE_STANDARD_WIDTH, height: h ?? NODE_STANDARD_HEIGHT }}
    >
      {resizerStandard}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
      />
      <div
        className={[
          "border-b border-zinc-800/80 px-3 py-2",
          isTextNode ? "shrink-0" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {typeLabel}
          </span>
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
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
      />
    </div>
  );
}

export const OpenSeerNode = memo(OpenSeerNodeInner);
