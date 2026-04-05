"use client";

import {
  useRef,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";

function lineStartIndex(text: string, pos: number): number {
  const i = text.lastIndexOf("\n", pos - 1);
  return i === -1 ? 0 : i + 1;
}

function lineEndIndex(text: string, pos: number): number {
  const nl = text.indexOf("\n", pos);
  return nl === -1 ? text.length : nl;
}

function lineIndentBefore(text: string, pos: number): string {
  const ls = lineStartIndex(text, pos);
  let i = ls;
  while (i < text.length && text[i] === " ") i++;
  return text.slice(ls, i);
}

function applyTab(text: string, selStart: number, selEnd: number) {
  const a = Math.min(selStart, selEnd);
  const b = Math.max(selStart, selEnd);
  if (a === b) {
    const next = text.slice(0, a) + "  " + text.slice(b);
    return { next, selStart: a + 2, selEnd: a + 2 };
  }
  const firstLineStart = lineStartIndex(text, a);
  const lastLineEnd = lineEndIndex(text, Math.max(0, b - 1));
  const block = text.slice(firstLineStart, lastLineEnd);
  const before = text.slice(0, firstLineStart);
  const after = text.slice(lastLineEnd);
  const lines = block.split("\n");
  const k = lines.length;
  const indented = lines.map((ln) => "  " + ln).join("\n");
  const next = before + indented + after;
  return { next, selStart: a + 2, selEnd: b + 2 * k };
}

function applyEnterBetweenEmptyBraces(text: string, selStart: number, selEnd: number) {
  if (selStart !== selEnd) return null;
  if (selStart === 0) return null;
  const chBefore = text[selStart - 1];
  const chAfter = text[selStart];
  if (chBefore !== "{" || chAfter !== "}") return null;
  const indent = lineIndentBefore(text, selStart - 1);
  const inner = indent + "  ";
  const insertion = "\n" + inner + "\n" + indent;
  const next = text.slice(0, selStart) + insertion + text.slice(selEnd);
  const cursor = selStart + 1 + inner.length;
  return { next, selStart: cursor, selEnd: cursor };
}

const PAIRS: Record<string, string> = {
  "{": "}",
  "(": ")",
  "[": "]",
};

export function CodeEditorTextarea({
  value,
  onChange,
  className = "",
  onKeyDown: userKeyDown,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const setSel = (s: number, e: number) => {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(s, e);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    userKeyDown?.(e);
    if (e.defaultPrevented) return;

    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = value;

    if (e.key === "Tab") {
      e.preventDefault();
      const { next, selStart, selEnd } = applyTab(text, start, end);
      if (next !== text) {
        onChange(next);
        setSel(selStart, selEnd);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      const r = applyEnterBetweenEmptyBraces(text, start, end);
      if (r) {
        e.preventDefault();
        onChange(r.next);
        setSel(r.selStart, r.selEnd);
        return;
      }
      e.preventDefault();
      const indent = lineIndentBefore(text, start);
      const insert = "\n" + indent;
      const next = text.slice(0, start) + insert + text.slice(end);
      onChange(next);
      const c = start + insert.length;
      setSel(c, c);
      return;
    }

    const close = PAIRS[e.key];
    if (close) {
      e.preventDefault();
      const next = text.slice(0, start) + e.key + close + text.slice(end);
      onChange(next);
      setSel(start + 1, start + 1);
      return;
    }

    if (e.key === '"' || e.key === "'" || e.key === "`") {
      const q = e.key;
      if (start === end && text[start] === q) {
        e.preventDefault();
        setSel(start + 1, start + 1);
        return;
      }
      e.preventDefault();
      const next = text.slice(0, start) + q + q + text.slice(end);
      onChange(next);
      setSel(start + 1, start + 1);
    }
  };

  return (
    <textarea
      ref={ref}
      {...rest}
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      onKeyDown={onKeyDown}
      className={className}
      spellCheck={false}
      wrap="off"
    />
  );
}
