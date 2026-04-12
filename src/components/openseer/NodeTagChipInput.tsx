"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeStoredTags } from "@/lib/node-tags";

type NodeTagChipInputProps = {
  tags: string[];
  onTagsChange: (next: string[]) => void;
  onTagsCommit: (next: string[]) => void;
};

/** ASCII comma, fullwidth comma, Arabic comma — layout-independent token delimiters. */
const COMMA_SPLIT_RE = /[,，\u060C]/;

function isCommaInsertion(data: string): boolean {
  return data.length === 1 && COMMA_SPLIT_RE.test(data);
}

function splitTrailingInput(raw: string): { completed: string[]; rest: string } {
  const parts = raw.split(COMMA_SPLIT_RE);
  if (parts.length <= 1) {
    return { completed: [], rest: raw };
  }
  const rest = parts[parts.length - 1] ?? "";
  const completed = parts
    .slice(0, -1)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return { completed, rest };
}

export function NodeTagChipInput({ tags, onTagsChange, onTagsCommit }: NodeTagChipInputProps) {
  const tagList = useMemo(() => normalizeStoredTags(tags), [tags]);
  const tagsRef = useRef(tagList);
  useLayoutEffect(() => {
    tagsRef.current = tagList;
  }, [tagList]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [buffer, setBuffer] = useState("");
  const bufferRef = useRef("");
  const setBufferTracked = useCallback((next: string) => {
    bufferRef.current = next;
    setBuffer(next);
  }, []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const skipEditBlurSaveRef = useRef(false);

  const commitBufferInto = useCallback((raw: string, base: string[]) => {
    const t = raw.trim();
    if (!t) return base;
    const seen = new Set(base);
    if (seen.has(t)) return base;
    return normalizeStoredTags([...base, t]);
  }, []);

  const mergeCompletedSegments = useCallback((base: string[], segments: string[]) => {
    let next = [...base];
    for (const seg of segments) {
      const t = seg.trim();
      if (!t) continue;
      const seen = new Set(next);
      if (seen.has(t)) continue;
      next = normalizeStoredTags([...next, t]);
    }
    return next;
  }, []);

  const flushBuffer = useCallback(
    (base: string[]) => {
      const next = commitBufferInto(bufferRef.current, base);
      tagsRef.current = next;
      setBufferTracked("");
      if (next.length !== base.length || next.some((v, i) => v !== base[i])) {
        onTagsChange(next);
      }
      return next;
    },
    [commitBufferInto, onTagsChange, setBufferTracked]
  );

  const focusStaysInside = useCallback((e: React.FocusEvent) => {
    const r = e.relatedTarget;
    return !!(r && rootRef.current?.contains(r as Node));
  }, []);

  const flushBufferAndCommit = useCallback(() => {
    const next = flushBuffer(tagsRef.current);
    onTagsCommit(next);
  }, [flushBuffer, onTagsCommit]);

  const removeAt = useCallback(
    (index: number) => {
      const next = tagList.filter((_, i) => i !== index);
      tagsRef.current = next;
      onTagsChange(next);
      onTagsCommit(next);
    },
    [onTagsChange, onTagsCommit, tagList]
  );

  const startEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditText(tagList[index] ?? "");
  }, [tagList]);

  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const t = editText.trim();
    const prev = tagList[editingIndex];
    const others = tagList.filter((_, i) => i !== editingIndex);
    if (!t) {
      const next = others;
      tagsRef.current = next;
      setEditingIndex(null);
      setEditText("");
      onTagsChange(next);
      onTagsCommit(next);
      return;
    }
    if (t !== prev && others.includes(t)) {
      setEditText(prev);
      queueMicrotask(() => editInputRef.current?.focus());
      return;
    }
    const next = [...others.slice(0, editingIndex), t, ...others.slice(editingIndex)];
    const normalized = normalizeStoredTags(next);
    tagsRef.current = normalized;
    setEditingIndex(null);
    setEditText("");
    onTagsChange(normalized);
    onTagsCommit(normalized);
  }, [editText, editingIndex, onTagsChange, onTagsCommit, tagList]);

  const cancelEdit = useCallback(() => {
    skipEditBlurSaveRef.current = true;
    setEditingIndex(null);
    setEditText("");
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (editingIndex === null) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingIndex]);

  const chipClass =
    "inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-600 bg-zinc-800/95 px-2 py-0.5 text-xs text-zinc-100 select-none";
  const shellClass =
    "flex min-h-[2.5rem] w-full flex-wrap items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 focus-within:border-sky-600 focus-within:ring-1 focus-within:ring-sky-600";
  const inlineInputClass =
    "min-w-[5rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600";

  return (
    <div ref={rootRef} role="list" className={shellClass}>
      {tagList.map((tag, i) =>
        editingIndex === i ? (
          <input
            key={`edit-${i}`}
            ref={editInputRef}
            className={`${inlineInputClass} max-w-full rounded border border-zinc-600 bg-zinc-950 px-1.5 py-0.5`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (skipEditBlurSaveRef.current) {
                skipEditBlurSaveRef.current = false;
                return;
              }
              saveEdit();
            }}
          />
        ) : (
          <span
            key={`${i}-${tag}`}
            role="listitem"
            className={chipClass}
            title={tag}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startEdit(i);
            }}
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              className="shrink-0 rounded px-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              aria-label={`Remove tag ${tag}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
            >
              ×
            </button>
          </span>
        )
      )}
      {editingIndex === null ? (
        <input
          ref={inputRef}
          className={inlineInputClass}
          placeholder="Add tags…"
          value={buffer}
          onBeforeInput={(e) => {
            if (e.defaultPrevented) return;
            const ne = e.nativeEvent as InputEvent;
            if (ne.isComposing) return;
            if (ne.inputType !== "insertText" || !ne.data || !isCommaInsertion(ne.data)) return;
            e.preventDefault();
            flushBufferAndCommit();
          }}
          onChange={(e) => {
            const v = e.target.value;
            const { completed, rest } = splitTrailingInput(v);
            if (completed.length > 0) {
              const merged = mergeCompletedSegments(tagsRef.current, completed);
              tagsRef.current = merged;
              onTagsChange(merged);
              setBufferTracked(rest);
              return;
            }
            if (COMMA_SPLIT_RE.test(v) && v.split(COMMA_SPLIT_RE).length > 1) {
              setBufferTracked(rest);
              return;
            }
            setBufferTracked(v);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              flushBufferAndCommit();
              return;
            }
            const commaKey =
              e.key === "," ||
              e.code === "Comma" ||
              e.key === "，" ||
              e.key === "\u060C";
            if (commaKey) {
              e.preventDefault();
              flushBufferAndCommit();
              return;
            }
            if (e.key === "Backspace" && bufferRef.current === "" && tagsRef.current.length > 0) {
              e.preventDefault();
              const next = tagsRef.current.slice(0, -1);
              tagsRef.current = next;
              onTagsChange(next);
              onTagsCommit(next);
            }
          }}
          onBlur={(e) => {
            if (focusStaysInside(e)) return;
            const raw = bufferRef.current;
            const trimmed = raw.trim();
            const beforeTags = tagsRef.current;
            let next = beforeTags;
            if (trimmed) {
              next = commitBufferInto(raw, beforeTags);
              tagsRef.current = next;
              setBufferTracked("");
              if (next.length !== beforeTags.length || next.some((v, i) => v !== beforeTags[i])) {
                onTagsChange(next);
              }
            }
            onTagsCommit(next);
          }}
        />
      ) : null}
    </div>
  );
}
