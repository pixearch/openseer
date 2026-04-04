"use client";

import type { Edge, Node } from "@xyflow/react";
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

  const { id, data } = selectedNode;
  const tagsStr = data.tags.join(", ");

  const patch = (p: Partial<OpenSeerNodeData>) => onPatchNode(id, p);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/95">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold capitalize text-zinc-100">{data.nodeType.replace("howto", "how-to")}</h2>
        <p className="mt-0.5 truncate text-xs text-zinc-500" title={data.title}>
          {data.title}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-8">
        <Field label="Title">
          <input
            className={inputClass}
            value={data.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>
        <Field label="Short description">
          <textarea
            className={textareaClass}
            value={data.shortDescription}
            onChange={(e) => patch({ shortDescription: e.target.value })}
            rows={3}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={data.status}
            onChange={(e) => patch({ status: e.target.value as OpenSeerNodeData["status"] })}
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
            value={data.owner}
            onChange={(e) => patch({ owner: e.target.value })}
          />
        </Field>
        <Field label="Tags (comma-separated)">
          <input
            className={inputClass}
            value={tagsStr}
            onChange={(e) =>
              patch({
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
            value={data.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={4}
          />
        </Field>

        {data.nodeType === "step" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step</p>
            <Field label="Commands">
              <textarea
                className={textareaClass}
                value={data.commands ?? ""}
                onChange={(e) => patch({ commands: e.target.value })}
                rows={4}
              />
            </Field>
            <Field label="Expected outcome">
              <textarea
                className={textareaClass}
                value={data.expectedOutcome ?? ""}
                onChange={(e) => patch({ expectedOutcome: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Troubleshooting">
              <textarea
                className={textareaClass}
                value={data.troubleshooting ?? ""}
                onChange={(e) => patch({ troubleshooting: e.target.value })}
                rows={3}
              />
            </Field>
          </>
        ) : null}

        {data.nodeType === "howto" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How-To</p>
            <Field label="Summary">
              <textarea
                className={textareaClass}
                value={data.howToSummary ?? ""}
                onChange={(e) => patch({ howToSummary: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="Ordered steps">
              <textarea
                className={textareaClass}
                value={data.orderedSteps ?? ""}
                onChange={(e) => patch({ orderedSteps: e.target.value })}
                rows={5}
              />
            </Field>
            <Field label="Related links">
              <textarea
                className={textareaClass}
                value={data.relatedLinks ?? ""}
                onChange={(e) => patch({ relatedLinks: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {data.nodeType === "evidence" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence</p>
            <Field label="Image URL">
              <input
                className={inputClass}
                value={data.imageUrl ?? ""}
                onChange={(e) => patch({ imageUrl: e.target.value })}
              />
            </Field>
            {data.imageUrl ? (
              <div className="overflow-hidden rounded border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.imageUrl} alt="" className="max-h-40 w-full object-cover" />
              </div>
            ) : null}
            <Field label="Video URL">
              <input
                className={inputClass}
                value={data.videoUrl ?? ""}
                onChange={(e) => patch({ videoUrl: e.target.value })}
              />
            </Field>
            <Field label="Source link">
              <input
                className={inputClass}
                value={data.sourceLink ?? ""}
                onChange={(e) => patch({ sourceLink: e.target.value })}
              />
            </Field>
            <Field label="Caption">
              <textarea
                className={textareaClass}
                value={data.caption ?? ""}
                onChange={(e) => patch({ caption: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {data.nodeType === "cost" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cost</p>
            <Field label="Estimated">
              <input
                className={inputClass}
                value={data.estimatedCost ?? ""}
                onChange={(e) => patch({ estimatedCost: e.target.value })}
              />
            </Field>
            <Field label="Actual">
              <input
                className={inputClass}
                value={data.actualCost ?? ""}
                onChange={(e) => patch({ actualCost: e.target.value })}
              />
            </Field>
            <Field label="Cost type">
              <input
                className={inputClass}
                value={data.costType ?? ""}
                onChange={(e) => patch({ costType: e.target.value })}
              />
            </Field>
          </>
        ) : null}

        {data.nodeType === "risk" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Risk</p>
            <Field label="Severity">
              <input
                className={inputClass}
                value={data.severity ?? ""}
                onChange={(e) => patch({ severity: e.target.value })}
              />
            </Field>
            <Field label="Impact">
              <textarea
                className={textareaClass}
                value={data.impact ?? ""}
                onChange={(e) => patch({ impact: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Mitigation">
              <textarea
                className={textareaClass}
                value={data.mitigation ?? ""}
                onChange={(e) => patch({ mitigation: e.target.value })}
                rows={3}
              />
            </Field>
          </>
        ) : null}

        {data.nodeType === "proposal" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposal</p>
            <Field label="Objective">
              <textarea
                className={textareaClass}
                value={data.objective ?? ""}
                onChange={(e) => patch({ objective: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Scope">
              <textarea
                className={textareaClass}
                value={data.scope ?? ""}
                onChange={(e) => patch({ scope: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Expected benefit">
              <textarea
                className={textareaClass}
                value={data.expectedBenefit ?? ""}
                onChange={(e) => patch({ expectedBenefit: e.target.value })}
                rows={2}
              />
            </Field>
          </>
        ) : null}

        {data.nodeType === "decision" ? (
          <>
            <hr className="border-zinc-800" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Decision</p>
            <Field label="Rationale">
              <textarea
                className={textareaClass}
                value={data.rationale ?? ""}
                onChange={(e) => patch({ rationale: e.target.value })}
                rows={3}
              />
            </Field>
            <Field label="Date">
              <input
                className={inputClass}
                type="date"
                value={data.decisionDate ?? ""}
                onChange={(e) => patch({ decisionDate: e.target.value })}
              />
            </Field>
            <Field label="Outcome">
              <textarea
                className={textareaClass}
                value={data.outcome ?? ""}
                onChange={(e) => patch({ outcome: e.target.value })}
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
