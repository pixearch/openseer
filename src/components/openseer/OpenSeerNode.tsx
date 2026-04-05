"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { NODE_TYPE_ACCENT_CLASS, NODE_TYPE_LABEL } from "@/lib/node-type-meta";
import type { OpenSeerNodeData } from "@/lib/types/graph";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-zinc-500",
  active: "bg-emerald-500",
  blocked: "bg-rose-500",
  done: "bg-sky-500",
  archived: "bg-zinc-600",
};

function OpenSeerNodeInner(props: NodeProps<Node<OpenSeerNodeData>>) {
  const { data, selected } = props;
  const w = typeof props.width === "number" ? props.width : undefined;
  const h = typeof props.height === "number" ? props.height : undefined;
  const [lightbox, setLightbox] = useState(false);

  const accent = NODE_TYPE_ACCENT_CLASS[data.nodeType];
  const typeLabel = NODE_TYPE_LABEL[data.nodeType];
  const statusClass = STATUS_DOT[data.status] ?? "bg-zinc-500";

  const previewTags = data.tags.slice(0, 2);
  const moreTags = data.tags.length > 2 ? data.tags.length - 2 : 0;

  if (data.nodeType === "group") {
    const gw = w ?? 320;
    const gh = h ?? 200;
    return (
      <div
        className={[
          "flex flex-col rounded-lg border-2 border-dashed border-teal-600/70 bg-zinc-950/90 shadow-lg",
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
        style={{ width: gw, minHeight: gh }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
        <div className="border-b border-teal-900/50 bg-teal-950/40 px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400/90">
            {typeLabel}
          </span>
          <div className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{data.title}</div>
        </div>
        <div className="flex flex-1 flex-col justify-center px-3 py-2 text-center">
          <p className="text-[11px] text-zinc-500">Nested graph</p>
          <p className="text-[10px] text-zinc-600">Double-click to open</p>
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
    return (
      <>
        <div
          className={[
            "min-w-[200px] max-w-[260px] overflow-hidden rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
            "border-l-[3px]",
            accent,
            selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
          ].join(" ")}
        >
          <Handle
            type="target"
            position={Position.Left}
            className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
          />
          <div className="border-b border-zinc-800/80 px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {typeLabel}
            </span>
            <div className="truncate text-sm font-medium text-zinc-100">{data.title}</div>
          </div>
          {data.imageUrl ? (
            <button
              type="button"
              className="block w-full cursor-zoom-in focus:outline-none"
              onClick={() => setLightbox(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.imageUrl}
                alt=""
                className="h-28 w-full object-cover"
              />
            </button>
          ) : (
            <div className="flex h-28 items-center justify-center bg-zinc-950 text-xs text-zinc-600">
              Set image URL
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
      </>
    );
  }

  if (data.nodeType === "video") {
    return (
      <div
        className={[
          "min-w-[200px] max-w-[260px] overflow-hidden rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
          "border-l-[3px]",
          accent,
          selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
        ].join(" ")}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
        <div className="border-b border-zinc-800/80 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {typeLabel}
          </span>
          <div className="truncate text-sm font-medium text-zinc-100">{data.title}</div>
        </div>
        {data.videoUrl ? (
          <video
            className="h-28 w-full bg-black object-cover"
            src={data.videoUrl}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="flex h-28 items-center justify-center bg-zinc-950 text-xs text-zinc-600">
            Set video URL
          </div>
        )}
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "min-w-[220px] max-w-[280px] rounded-md border border-zinc-700/90 bg-zinc-900/95 shadow-lg backdrop-blur-sm",
        "border-l-[3px]",
        accent,
        selected ? "ring-1 ring-sky-500/80 ring-offset-2 ring-offset-[#0c0c0e]" : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border !border-zinc-500 !bg-zinc-800"
      />
      <div className="border-b border-zinc-800/80 px-3 py-2">
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
      <div className="space-y-2 px-3 py-2">
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
          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">{data.shortDescription}</p>
        ) : data.nodeType !== "evidence" || (!data.imageUrl && !data.videoUrl) ? (
          <p className="text-xs italic text-zinc-600">No description</p>
        ) : null}
        {data.owner ? (
          <p className="text-[11px] text-zinc-500">
            <span className="text-zinc-600">Owner</span> {data.owner}
          </p>
        ) : null}
        {previewTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
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
