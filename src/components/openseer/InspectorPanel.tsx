"use client";

import type { Edge, Node } from "@xyflow/react";
import { useState } from "react";
import { useDebouncedPatchNode } from "@/hooks/use-debounced-graph-patch";
import type { OpenSeerEdgeData, OpenSeerNodeData } from "@/lib/types/graph";
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

interface InspectorPanelProps {
  selectedNode: Node<OpenSeerNodeData> | null;
  selectedEdge: Edge<OpenSeerEdgeData> | null;
  onPatchNode: (id: string, patch: Partial<OpenSeerNodeData>) => void;
  onPatchEdge: (id: string, next: OpenSeerEdgeData) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
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

  const tagsStr = draft.tags.join(", ");

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold capitalize text-zinc-100">
          {draft.nodeType === "howto"
            ? "How-to"
            : draft.nodeType === "group"
              ? "Group"
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
        <Field label="Short description">
          <textarea
            className={textareaClass}
            value={draft.shortDescription}
            onChange={(e) => applyDebounced({ shortDescription: e.target.value })}
            rows={3}
          />
        </Field>
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

        {draft.nodeType === "group" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs text-zinc-500">
              Group name uses <strong className="text-zinc-400">Title</strong> above. Double-click this node on
              the canvas to edit the nested graph.
            </p>
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
  onPatchNode,
  onPatchEdge,
  onDeleteNode,
  onDeleteEdge,
}: InspectorPanelProps) {
  if (selectedEdge && !selectedNode) {
    const d = selectedEdge.data ?? { label: "relates_to", relationshipType: "relates_to" };
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
                  label: e.target.value,
                  relationshipType: d.relationshipType,
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
                  label: d.label,
                  relationshipType: e.target.value,
                })
              }
            />
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
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Inspector</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Select a node or edge</p>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-600">
          Click any node to view and edit properties. Select an edge to edit its label.
        </div>
      </aside>
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
