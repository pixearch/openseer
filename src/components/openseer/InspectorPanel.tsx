"use client";

import type { Edge, Node } from "@xyflow/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CodeEditorTextarea } from "@/components/openseer/CodeEditorTextarea";
import { useDebouncedPatchNode } from "@/hooks/use-debounced-graph-patch";
import { copyAllCodeBlocks, newCodeBlockId, normalizeCodeBlocksForDisplay } from "@/lib/code-blocks";
import { DEFAULT_TITLE_BY_TYPE } from "@/lib/node-type-meta";
import { parseYoutubeVideoId } from "@/lib/youtube";
import { colorInputHex6 } from "@/lib/node-font-styles";
import type {
  OpenSeerEdgeArrowStyle,
  OpenSeerEdgeData,
  OpenSeerEdgeRouting,
  OpenSeerNodeData,
  OpenSeerNodeType,
} from "@/lib/types/graph";
import { OPEN_SEER_STATUSES } from "@/lib/types/graph";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600";

const textareaClass = `${inputClass} min-h-[72px] resize-y font-mono text-xs leading-relaxed`;

function inspectorShowsBodyTypography(nt: OpenSeerNodeType): boolean {
  return nt !== "hub" && nt !== "image" && nt !== "video" && nt !== "document";
}

function InspectorNodeTypographySection({
  draft,
  patchImmediate,
}: {
  draft: OpenSeerNodeData;
  patchImmediate: (patch: Partial<OpenSeerNodeData>) => void;
}) {
  const showBody = inspectorShowsBodyTypography(draft.nodeType);
  const defaultHeaderSliderFs =
    draft.nodeType === "code" ||
    draft.nodeType === "image" ||
    draft.nodeType === "video" ||
    draft.nodeType === "document"
      ? 14
      : 16;
  const headerSliderValue = draft.styleHeaderFontSizePx ?? defaultHeaderSliderFs;
  const bodySliderValue = draft.styleBodyFontSizePx ?? 12;
  const hColorHex = colorInputHex6(draft.styleHeaderFontColor, "#fafafa");
  const hStrokeHex = colorInputHex6(draft.styleHeaderStrokeColor, "#18181b");
  const bColorHex = colorInputHex6(draft.styleBodyFontColor, "#a1a1aa");
  const strokeW =
    typeof draft.styleHeaderStrokeWidthPx === "number" &&
    Number.isFinite(draft.styleHeaderStrokeWidthPx)
      ? draft.styleHeaderStrokeWidthPx
      : 0;

  return (
    <>
      <hr className="border-zinc-800" />
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Header typography</p>
      <Field label="Header font color">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            aria-label="Header font color"
            className="h-9 w-14 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5"
            value={hColorHex}
            onChange={(e) => patchImmediate({ styleHeaderFontColor: e.target.value })}
          />
          <input
            className={`${inputClass} min-w-[8rem] flex-1 font-mono text-xs`}
            value={typeof draft.styleHeaderFontColor === "string" ? draft.styleHeaderFontColor : ""}
            placeholder="#fafafa or hsl(…)"
            onChange={(e) =>
              patchImmediate({
                styleHeaderFontColor:
                  e.target.value.trim() === "" ? undefined : e.target.value.trim(),
              })
            }
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            onClick={() => patchImmediate({ styleHeaderFontColor: undefined })}
          >
            Default
          </button>
        </div>
      </Field>
      <Field label="Header font size">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={32}
            step={1}
            className="min-w-0 flex-1 accent-sky-500"
            value={headerSliderValue}
            onChange={(e) => patchImmediate({ styleHeaderFontSizePx: Number(e.target.value) })}
          />
          <input
            className="w-14 rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-1 text-right text-xs tabular-nums text-zinc-100"
            type="number"
            min={8}
            max={40}
            step={1}
            value={draft.styleHeaderFontSizePx ?? ""}
            placeholder="def."
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                patchImmediate({ styleHeaderFontSizePx: undefined });
                return;
              }
              const v = Number(raw);
              if (!Number.isFinite(v) || v <= 0) return;
              patchImmediate({ styleHeaderFontSizePx: v });
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            onClick={() => patchImmediate({ styleHeaderFontSizePx: undefined })}
          >
            Default
          </button>
        </div>
      </Field>
      <Field label="Header stroke color">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            aria-label="Header stroke color"
            className="h-9 w-14 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5"
            value={hStrokeHex}
            onChange={(e) => patchImmediate({ styleHeaderStrokeColor: e.target.value })}
          />
          <input
            className={`${inputClass} min-w-[8rem] flex-1 font-mono text-xs`}
            value={typeof draft.styleHeaderStrokeColor === "string" ? draft.styleHeaderStrokeColor : ""}
            placeholder="#18181b or hsl(…)"
            onChange={(e) =>
              patchImmediate({
                styleHeaderStrokeColor:
                  e.target.value.trim() === "" ? undefined : e.target.value.trim(),
              })
            }
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            onClick={() => patchImmediate({ styleHeaderStrokeColor: undefined })}
          >
            Default
          </button>
        </div>
      </Field>
      <Field label="Header stroke thickness">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={4}
            step={0.25}
            className="min-w-0 flex-1 accent-sky-500"
            value={strokeW}
            onChange={(e) => patchImmediate({ styleHeaderStrokeWidthPx: Number(e.target.value) })}
          />
          <input
            className="w-14 rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-1 text-right text-xs tabular-nums text-zinc-100"
            type="number"
            min={0}
            max={8}
            step={0.25}
            value={strokeW}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v) || v < 0) return;
              patchImmediate({ styleHeaderStrokeWidthPx: v });
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            onClick={() => patchImmediate({ styleHeaderStrokeWidthPx: undefined })}
          >
            Default
          </button>
        </div>
      </Field>
      {showBody ? (
        <>
          <hr className="border-zinc-800" />
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Body / text typography</p>
          <Field label="Text font color">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Text font color"
                className="h-9 w-14 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5"
                value={bColorHex}
                onChange={(e) => patchImmediate({ styleBodyFontColor: e.target.value })}
              />
              <input
                className={`${inputClass} min-w-[8rem] flex-1 font-mono text-xs`}
                value={typeof draft.styleBodyFontColor === "string" ? draft.styleBodyFontColor : ""}
                placeholder="#a1a1aa or hsl(…)"
                onChange={(e) =>
                  patchImmediate({
                    styleBodyFontColor:
                      e.target.value.trim() === "" ? undefined : e.target.value.trim(),
                  })
                }
              />
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                onClick={() => patchImmediate({ styleBodyFontColor: undefined })}
              >
                Default
              </button>
            </div>
          </Field>
          <Field label="Text font size">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={9}
                max={22}
                step={1}
                className="min-w-0 flex-1 accent-sky-500"
                value={bodySliderValue}
                onChange={(e) => patchImmediate({ styleBodyFontSizePx: Number(e.target.value) })}
              />
              <input
                className="w-14 rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-1 text-right text-xs tabular-nums text-zinc-100"
                type="number"
                min={8}
                max={28}
                step={1}
                value={draft.styleBodyFontSizePx ?? ""}
                placeholder="def."
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    patchImmediate({ styleBodyFontSizePx: undefined });
                    return;
                  }
                  const v = Number(raw);
                  if (!Number.isFinite(v) || v <= 0) return;
                  patchImmediate({ styleBodyFontSizePx: v });
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                onClick={() => patchImmediate({ styleBodyFontSizePx: undefined })}
              >
                Default
              </button>
            </div>
          </Field>
        </>
      ) : null}
    </>
  );
}

interface InspectorPanelProps {
  selectedNode: Node<OpenSeerNodeData> | null;
  selectedEdge: Edge<OpenSeerEdgeData> | null;
  multiSelectedNodes: Node<OpenSeerNodeData>[];
  viewNodes: Node<OpenSeerNodeData>[];
  onPatchNode: (id: string, patch: Partial<OpenSeerNodeData>) => void;
  onPatchEdge: (id: string, next: OpenSeerEdgeData) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

/** Child entries in stored order (nested graph array, or view node list order for frames). */
function containedChildEntries(
  node: Node<OpenSeerNodeData>,
  viewNodes: Node<OpenSeerNodeData>[]
): { id: string; title: string }[] {
  if (node.data.nodeType === "group") {
    const nested = (node.data.nestedGraph?.nodes ?? []) as Node<OpenSeerNodeData>[];
    return nested.map((n) => ({ id: n.id, title: n.data.title }));
  }
  if (node.data.nodeType === "frame") {
    return viewNodes
      .filter((n) => n.parentId === node.id)
      .map((n) => ({ id: n.id, title: n.data.title }));
  }
  return [];
}

function InspectorMultiSelectionList({ nodes }: { nodes: Node<OpenSeerNodeData>[] }) {
  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Multiple selection</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{nodes.length} nodes</p>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto p-4 pb-8">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Selected</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-zinc-200">
          {nodes.map((n) => (
            <li key={n.id} className="truncate" title={n.data.title}>
              {n.data.title}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

function InspectorGroupedContainer({
  node,
  viewNodes,
  onPatchNode,
  onDeleteNode,
}: {
  node: Node<OpenSeerNodeData>;
  viewNodes: Node<OpenSeerNodeData>[];
  onPatchNode: (id: string, patch: Partial<OpenSeerNodeData>) => void;
  onDeleteNode: (id: string) => void;
}) {
  const id = node.id;
  const scheduleNodePatch = useDebouncedPatchNode(id, onPatchNode);
  const [title, setTitle] = useState(node.data.title);

  const heading =
    node.data.nodeType === "frame" ? "Group nodes" : node.data.nodeType === "group" ? "Grouping" : "Container";
  const children = containedChildEntries(node, viewNodes);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">{heading}</h2>
        <p className="mt-0.5 truncate text-xs text-zinc-500" title={title}>
          {title}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-8">
        <Field label="Title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => {
              const v = e.target.value;
              setTitle(v);
              scheduleNodePatch({ title: v });
            }}
          />
        </Field>
        <hr className="border-zinc-800" />
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Contained nodes</p>
        {children.length === 0 ? (
          <p className="text-sm text-zinc-600">None</p>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-zinc-200">
            {children.map((c) => (
              <li key={c.id} className="truncate" title={c.title}>
                {c.title}
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          className="mt-auto rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/70"
          onClick={() => onDeleteNode(id)}
        >
          Delete node
        </button>
      </div>
    </aside>
  );
}

function InspectorNodeEditor({
  node,
  onPatchNode,
  onDeleteNode,
}: {
  node: Node<OpenSeerNodeData>;
  onPatchNode: (id: string, patch: Partial<OpenSeerNodeData>) => void;
  onDeleteNode: (id: string) => void;
}) {
  const id = node.id;
  const scheduleNodePatch = useDebouncedPatchNode(id, onPatchNode);
  const [draft, setDraft] = useState<OpenSeerNodeData>(() => ({ ...node.data }));

  const applyDebounced = (patch: Partial<OpenSeerNodeData>) => {
    setDraft((d) => ({ ...d, ...patch }));
    scheduleNodePatch(patch);
  };

  const patchImmediate = (patch: Partial<OpenSeerNodeData>) => {
    setDraft((d) => ({ ...d, ...patch }));
    onPatchNode(id, patch);
  };

  const tagsStr = draft.tags.join(", ");

  const draftRef = useRef(draft);
  useLayoutEffect(() => {
    draftRef.current = draft;
  });

  const prevVideoUrlRef = useRef(node.data.videoUrl ?? "");
  useEffect(() => {
    if (node.data.nodeType !== "video") return;
    const next = node.data.videoUrl ?? "";
    if (next === prevVideoUrlRef.current) return;
    prevVideoUrlRef.current = next;
    setDraft((d) => ({ ...d, videoUrl: next }));
  }, [node.data.videoUrl, node.data.nodeType, node.id]);

  const prevTextBodyRef = useRef(node.data.shortDescription ?? "");
  useEffect(() => {
    if (node.data.nodeType !== "text") return;
    const next = node.data.shortDescription ?? "";
    if (next === prevTextBodyRef.current) return;
    prevTextBodyRef.current = next;
    setDraft((d) => ({ ...d, shortDescription: next }));
  }, [node.data.shortDescription, node.data.nodeType, node.id]);

  const prevDocumentUrlRef = useRef(node.data.documentUrl ?? "");
  useEffect(() => {
    if (node.data.nodeType !== "document") return;
    const next = node.data.documentUrl ?? "";
    if (next === prevDocumentUrlRef.current) return;
    prevDocumentUrlRef.current = next;
    setDraft((d) => ({ ...d, documentUrl: next }));
  }, [node.data.documentUrl, node.data.nodeType, node.id]);

  useEffect(() => {
    if (draft.nodeType !== "video") return;
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      const u = (draft.videoUrl ?? "").trim();
      if (!parseYoutubeVideoId(u)) return;
      try {
        const r = await fetch(`/api/youtube-metadata?url=${encodeURIComponent(u)}`, {
          signal: ac.signal,
        });
        if (!r.ok) return;
        const meta = (await r.json()) as { title?: string; author?: string };
        if (ac.signal.aborted) return;
        const patch: Partial<OpenSeerNodeData> = {};
        const d = draftRef.current;
        const defaultVideoTitle = DEFAULT_TITLE_BY_TYPE.video;
        if (typeof meta.title === "string" && meta.title) {
          if (!d.title.trim() || d.title === defaultVideoTitle) {
            patch.title = meta.title;
          }
        }
        if (typeof meta.author === "string" && meta.author && !(d.owner ?? "").trim()) {
          patch.owner = meta.author;
        }
        if (Object.keys(patch).length === 0) return;
        setDraft((prev) => ({ ...prev, ...patch }));
        onPatchNode(id, patch);
      } catch {
        /* aborted or network */
      }
    }, 600);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [draft.videoUrl, draft.nodeType, id, onPatchNode]);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold capitalize text-zinc-100">
          {draft.nodeType === "howto"
            ? "How-to"
            : draft.nodeType === "group"
              ? "Grouping"
              : draft.nodeType === "frame"
                ? "Group nodes"
                : draft.nodeType === "text"
                  ? "Text"
                  : draft.nodeType === "code"
                    ? "Code"
                    : draft.nodeType === "document"
                      ? "Document"
                      : draft.nodeType === "hub"
                        ? "Hub"
                        : draft.nodeType}
        </h2>
        <p className="mt-0.5 truncate text-xs text-zinc-500" title={draft.title}>
          {draft.title}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-8">
        <Field label="Title">
          <input
            className={inputClass}
            value={draft.title}
            onChange={(e) => applyDebounced({ title: e.target.value })}
          />
        </Field>
        <InspectorNodeTypographySection draft={draft} patchImmediate={patchImmediate} />
        {draft.nodeType !== "code" ? (
          <Field label="Short description">
            <textarea
              className={textareaClass}
              value={draft.shortDescription}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, shortDescription: v }));
                if (node.data.nodeType === "text") {
                  onPatchNode(id, { shortDescription: v });
                } else {
                  scheduleNodePatch({ shortDescription: v });
                }
              }}
              rows={draft.nodeType === "text" ? 6 : 3}
            />
          </Field>
        ) : null}

        {draft.nodeType === "code" ? (
          <>
            <hr className="border-zinc-800" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Code blocks</p>
              <button
                type="button"
                className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    copyAllCodeBlocks(normalizeCodeBlocksForDisplay(id, node.data.codeBlocks))
                  )
                }
              >
                Copy all
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {normalizeCodeBlocksForDisplay(id, node.data.codeBlocks).map((block) => (
                <div
                  key={block.id}
                  className="rounded border border-zinc-800 bg-zinc-950/50 p-2"
                >
                  <div className="mb-1.5 flex justify-end gap-1">
                    <button
                      type="button"
                      className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                      onClick={() => void navigator.clipboard.writeText(block.content)}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={normalizeCodeBlocksForDisplay(id, node.data.codeBlocks).length <= 1}
                      className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-rose-950/60 hover:text-rose-200 disabled:opacity-40"
                      onClick={() => {
                        const cur = normalizeCodeBlocksForDisplay(id, node.data.codeBlocks);
                        if (cur.length <= 1) return;
                        const next = cur.filter((b) => b.id !== block.id);
                        onPatchNode(id, { codeBlocks: next });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <CodeEditorTextarea
                    value={block.content}
                    onChange={(content) => {
                      const cur = normalizeCodeBlocksForDisplay(id, node.data.codeBlocks);
                      const next = cur.map((b) =>
                        b.id === block.id ? { ...b, content } : b
                      );
                      onPatchNode(id, { codeBlocks: next });
                    }}
                    className={`${textareaClass} min-h-[100px]`}
                    rows={5}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="w-full rounded border border-dashed border-zinc-600 py-2 text-xs text-zinc-400 hover:border-emerald-700 hover:bg-zinc-800/50"
              onClick={() => {
                const cur = normalizeCodeBlocksForDisplay(id, node.data.codeBlocks);
                const next = [...cur, { id: newCodeBlockId(), content: "" }];
                onPatchNode(id, { codeBlocks: next });
              }}
            >
              + Add block
            </button>
          </>
        ) : null}
        <Field label="Status">
          <select
            className={inputClass}
            value={draft.status}
            onChange={(e) => {
              const status = e.target.value as OpenSeerNodeData["status"];
              setDraft((d) => ({ ...d, status }));
              onPatchNode(id, { status });
            }}
          >
            {OPEN_SEER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <input
            className={inputClass}
            value={draft.owner}
            onChange={(e) => applyDebounced({ owner: e.target.value })}
          />
        </Field>
        <Field label="Tags (comma-separated)">
          <input
            className={inputClass}
            value={tagsStr}
            onChange={(e) =>
              applyDebounced({
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Field label="Notes">
          <textarea
            className={textareaClass}
            value={draft.notes}
            onChange={(e) => applyDebounced({ notes: e.target.value })}
            rows={4}
          />
        </Field>

        {draft.nodeType === "step" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step</p>
            <Field label="Commands">
              <textarea
                className={textareaClass}
                value={draft.commands ?? ""}
                onChange={(e) => applyDebounced({ commands: e.target.value })}
                rows={4}
              />
            </Field>
            <Field label="Expected outcome">
              <textarea
                className={textareaClass}
                value={draft.expectedOutcome ?? ""}
                onChange={(e) => applyDebounced({ expectedOutcome: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Troubleshooting">
              <textarea
                className={textareaClass}
                value={draft.troubleshooting ?? ""}
                onChange={(e) => applyDebounced({ troubleshooting: e.target.value })}
                rows={3}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "howto" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How-To</p>
            <Field label="Summary">
              <textarea
                className={textareaClass}
                value={draft.howToSummary ?? ""}
                onChange={(e) => applyDebounced({ howToSummary: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="Ordered steps">
              <textarea
                className={textareaClass}
                value={draft.orderedSteps ?? ""}
                onChange={(e) => applyDebounced({ orderedSteps: e.target.value })}
                rows={5}
              />
            </Field>
            <Field label="Related links">
              <textarea
                className={textareaClass}
                value={draft.relatedLinks ?? ""}
                onChange={(e) => applyDebounced({ relatedLinks: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "evidence" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence</p>
            <Field label="Image URL">
              <input
                className={inputClass}
                value={draft.imageUrl ?? ""}
                onChange={(e) => applyDebounced({ imageUrl: e.target.value })}
              />
            </Field>
            {draft.imageUrl ? (
              <div className="overflow-hidden rounded border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.imageUrl} alt="" className="max-h-40 w-full object-cover" />
              </div>
            ) : null}
            <Field label="Video URL">
              <input
                className={inputClass}
                value={draft.videoUrl ?? ""}
                onChange={(e) => applyDebounced({ videoUrl: e.target.value })}
              />
            </Field>
            <Field label="Source link">
              <input
                className={inputClass}
                value={draft.sourceLink ?? ""}
                onChange={(e) => applyDebounced({ sourceLink: e.target.value })}
              />
            </Field>
            {draft.sourceLink ? (
              <a
                href={draft.sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-xs text-sky-400 hover:text-sky-300"
              >
                {draft.sourceLink}
              </a>
            ) : null}
            <Field label="Caption">
              <textarea
                className={textareaClass}
                value={draft.caption ?? ""}
                onChange={(e) => applyDebounced({ caption: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "cost" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cost</p>
            <Field label="Estimated">
              <input
                className={inputClass}
                value={draft.estimatedCost ?? ""}
                onChange={(e) => applyDebounced({ estimatedCost: e.target.value })}
              />
            </Field>
            <Field label="Actual">
              <input
                className={inputClass}
                value={draft.actualCost ?? ""}
                onChange={(e) => applyDebounced({ actualCost: e.target.value })}
              />
            </Field>
            <Field label="Cost type">
              <input
                className={inputClass}
                value={draft.costType ?? ""}
                onChange={(e) => applyDebounced({ costType: e.target.value })}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "risk" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Risk</p>
            <Field label="Severity">
              <input
                className={inputClass}
                value={draft.severity ?? ""}
                onChange={(e) => applyDebounced({ severity: e.target.value })}
              />
            </Field>
            <Field label="Impact">
              <textarea
                className={textareaClass}
                value={draft.impact ?? ""}
                onChange={(e) => applyDebounced({ impact: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Mitigation">
              <textarea
                className={textareaClass}
                value={draft.mitigation ?? ""}
                onChange={(e) => applyDebounced({ mitigation: e.target.value })}
                rows={3}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "proposal" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposal</p>
            <Field label="Objective">
              <textarea
                className={textareaClass}
                value={draft.objective ?? ""}
                onChange={(e) => applyDebounced({ objective: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Scope">
              <textarea
                className={textareaClass}
                value={draft.scope ?? ""}
                onChange={(e) => applyDebounced({ scope: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Expected benefit">
              <textarea
                className={textareaClass}
                value={draft.expectedBenefit ?? ""}
                onChange={(e) => applyDebounced({ expectedBenefit: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "image" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Image</p>
            <Field label="Image URL">
              <input
                className={inputClass}
                value={draft.imageUrl ?? ""}
                onChange={(e) => applyDebounced({ imageUrl: e.target.value })}
              />
            </Field>
            <Field label="Caption">
              <textarea
                className={textareaClass}
                value={draft.caption ?? ""}
                onChange={(e) => applyDebounced({ caption: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "video" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Video</p>
            <Field label="Video URL">
              <input
                className={inputClass}
                value={draft.videoUrl ?? ""}
                onChange={(e) => applyDebounced({ videoUrl: e.target.value })}
              />
            </Field>
            <Field label="Published">
              <input
                className={inputClass}
                type="date"
                value={draft.videoPublishedAt ?? ""}
                onChange={(e) => applyDebounced({ videoPublishedAt: e.target.value })}
              />
            </Field>
            <Field label="Duration">
              <input
                className={inputClass}
                value={draft.videoDurationLabel ?? ""}
                onChange={(e) => applyDebounced({ videoDurationLabel: e.target.value })}
                placeholder="e.g. 12:34"
              />
            </Field>
            <Field label="Caption">
              <textarea
                className={textareaClass}
                value={draft.caption ?? ""}
                onChange={(e) => applyDebounced({ caption: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "document" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Document</p>
            <Field label="Document URL">
              <input
                className={inputClass}
                value={draft.documentUrl ?? ""}
                onChange={(e) => applyDebounced({ documentUrl: e.target.value })}
                placeholder="https://… or linked file"
              />
            </Field>
            <Field label="Caption">
              <textarea
                className={textareaClass}
                value={draft.caption ?? ""}
                onChange={(e) => applyDebounced({ caption: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {draft.nodeType === "decision" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Decision</p>
            <Field label="Rationale">
              <textarea
                className={textareaClass}
                value={draft.rationale ?? ""}
                onChange={(e) => applyDebounced({ rationale: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="Date">
              <input
                className={inputClass}
                type="date"
                value={draft.decisionDate ?? ""}
                onChange={(e) => applyDebounced({ decisionDate: e.target.value })}
              />
            </Field>
            <Field label="Outcome">
              <textarea
                className={textareaClass}
                value={draft.outcome ?? ""}
                onChange={(e) => applyDebounced({ outcome: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        <button
          type="button"
          className="rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/70"
          onClick={() => onDeleteNode(id)}
        >
          Delete node
        </button>
      </div>
    </aside>
  );
}

export function InspectorPanel({
  selectedNode,
  selectedEdge,
  multiSelectedNodes,
  viewNodes,
  onPatchNode,
  onPatchEdge,
  onDeleteNode,
  onDeleteEdge,
}: InspectorPanelProps) {
  if (multiSelectedNodes.length > 1) {
    return <InspectorMultiSelectionList nodes={multiSelectedNodes} />;
  }

  if (selectedEdge && !selectedNode) {
    const d = selectedEdge.data ?? { label: "relates_to", relationshipType: "relates_to" };
    const routing: OpenSeerEdgeRouting = d.type ?? "orthogonal";
    const arrowStyle: OpenSeerEdgeArrowStyle =
      d.arrowStyle === "none" || d.arrowStyle === "both" ? d.arrowStyle : "end";
    const thickness =
      typeof d.strokeWidthPx === "number" && Number.isFinite(d.strokeWidthPx) && d.strokeWidthPx > 0
        ? d.strokeWidthPx
        : 1.5;
    const colorPickerValue =
      typeof d.strokeColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(d.strokeColor.trim())
        ? d.strokeColor.trim()
        : "#64748b";
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Relationship</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Edge between nodes</p>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Field label="Label">
            <input
              className={inputClass}
              value={d.label}
              onChange={(e) =>
                onPatchEdge(selectedEdge.id, {
                  ...d,
                  label: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Relationship type">
            <input
              className={inputClass}
              value={d.relationshipType}
              onChange={(e) =>
                onPatchEdge(selectedEdge.id, {
                  ...d,
                  relationshipType: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Edge type">
            <select
              className={inputClass}
              value={routing}
              onChange={(e) => {
                const next = e.target.value as OpenSeerEdgeRouting;
                onPatchEdge(selectedEdge.id, {
                  ...d,
                  type: next,
                  orthogonalPath: next === "orthogonal" ? d.orthogonalPath : undefined,
                });
              }}
            >
              <option value="straight">Straight</option>
              <option value="orthogonal">Orthogonal</option>
              <option value="bezier">Curved</option>
            </select>
          </Field>
          <Field label="Edge color">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Edge color"
                className="h-9 w-14 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-0.5"
                value={colorPickerValue}
                onChange={(ev) =>
                  onPatchEdge(selectedEdge.id, {
                    ...d,
                    strokeColor: ev.target.value,
                  })
                }
              />
              <input
                className={`${inputClass} min-w-[8rem] flex-1 font-mono text-xs`}
                value={typeof d.strokeColor === "string" ? d.strokeColor : ""}
                placeholder="#64748b or hsl(…)"
                onChange={(ev) =>
                  onPatchEdge(selectedEdge.id, {
                    ...d,
                    strokeColor: ev.target.value.trim() === "" ? undefined : ev.target.value.trim(),
                  })
                }
              />
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                onClick={() =>
                  onPatchEdge(selectedEdge.id, {
                    ...d,
                    strokeColor: undefined,
                  })
                }
              >
                Default
              </button>
            </div>
          </Field>
          <Field label="Edge thickness">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={8}
                step={0.5}
                className="min-w-0 flex-1 accent-sky-500"
                value={thickness}
                onChange={(ev) =>
                  onPatchEdge(selectedEdge.id, {
                    ...d,
                    strokeWidthPx: Number(ev.target.value),
                  })
                }
              />
              <input
                className="w-16 rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-1 text-right text-xs tabular-nums text-zinc-100"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={thickness}
                onChange={(ev) => {
                  const v = Number(ev.target.value);
                  if (!Number.isFinite(v) || v <= 0) return;
                  onPatchEdge(selectedEdge.id, { ...d, strokeWidthPx: v });
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                onClick={() =>
                  onPatchEdge(selectedEdge.id, {
                    ...d,
                    strokeWidthPx: undefined,
                  })
                }
              >
                Default
              </button>
            </div>
          </Field>
          <Field label="Arrow style">
            <select
              className={inputClass}
              value={arrowStyle}
              onChange={(ev) =>
                onPatchEdge(selectedEdge.id, {
                  ...d,
                  arrowStyle: ev.target.value as OpenSeerEdgeArrowStyle,
                })
              }
            >
              <option value="none">None</option>
              <option value="end">End arrow</option>
              <option value="both">Both ends</option>
            </select>
          </Field>
          <button
            type="button"
            className="mt-auto rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/70"
            onClick={() => onDeleteEdge(selectedEdge.id)}
          >
            Delete connection
          </button>
        </div>
      </aside>
    );
  }

  if (!selectedNode) {
    return null;
  }

  if (selectedNode.data.nodeType === "group" || selectedNode.data.nodeType === "frame") {
    return (
      <InspectorGroupedContainer
        key={selectedNode.id}
        node={selectedNode}
        viewNodes={viewNodes}
        onPatchNode={onPatchNode}
        onDeleteNode={onDeleteNode}
      />
    );
  }

  return (
    <InspectorNodeEditor
      key={selectedNode.id}
      node={selectedNode}
      onPatchNode={onPatchNode}
      onDeleteNode={onDeleteNode}
    />
  );
}
