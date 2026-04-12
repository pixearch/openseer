"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
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

const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

const CLOSE_TO_OPEN: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

type StackEntry =
  | { t: "b"; i: number; o: string; c: string }
  | { t: "q"; i: number; q: '"' | "'" | "`" };

/** Rainbow / error indices for paired delimiters; null depth = default text color. */
function computePairHighlight(text: string): {
  depth: (number | null)[];
  err: boolean[];
} {
  const n = text.length;
  const depth: (number | null)[] = Array(n).fill(null);
  const err = Array(n).fill(false);
  const stack: StackEntry[] = [];
  let i = 0;

  while (i < n) {
    const c = text[i];
    const top = stack[stack.length - 1];

    if (top?.t === "q") {
      if (c === "\\" && i + 1 < n) {
        i += 2;
        continue;
      }
      if (c === top.q) {
        const d = stack.length - 1;
        depth[top.i] = d;
        depth[i] = d;
        stack.pop();
      }
      i++;
      continue;
    }

    if (c === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n) {
        if (i + 1 < n && text[i] === "*" && text[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      stack.push({ t: "q", i, q: c });
      i++;
      continue;
    }

    if (c === "(" || c === "[" || c === "{") {
      stack.push({ t: "b", i, o: c, c: OPEN_TO_CLOSE[c]! });
      i++;
      continue;
    }

    if (c === ")" || c === "]" || c === "}") {
      const need = CLOSE_TO_OPEN[c];
      let k = stack.length - 1;
      while (k >= 0 && stack[k].t !== "b") k--;
      const topB = k >= 0 ? stack[k] : undefined;
      if (topB?.t === "b" && topB.o === need) {
        const d = k;
        depth[topB.i] = d;
        depth[i] = d;
        stack.splice(k, 1);
      } else {
        err[i] = true;
      }
      i++;
      continue;
    }

    i++;
  }

  for (const s of stack) {
    err[s.i] = true;
  }

  return { depth, err };
}

const DEPTH_CLASS = [
  "text-sky-400",
  "text-fuchsia-400",
  "text-pink-400",
  "text-amber-400",
  "text-emerald-400",
  "text-yellow-300",
] as const;

function pairHighlightSpans(text: string): ReactNode[] {
  const { depth, err } = computePairHighlight(text);
  const n = text.length;
  const out: ReactNode[] = [];
  if (n === 0) return out;

  const runSame = (a: number, b: number) => err[a] === err[b] && depth[a] === depth[b];

  let runStart = 0;
  for (let j = 1; j <= n; j++) {
    if (j === n || !runSame(runStart, j)) {
      const slice = text.slice(runStart, j);
      const d = depth[runStart];
      const e = err[runStart];
      let cls = "text-zinc-100";
      if (e) cls = "text-rose-400";
      else if (d !== null) cls = DEPTH_CLASS[d % DEPTH_CLASS.length]!;
      out.push(
        <span key={`${runStart}-${j}`} className={cls}>
          {slice}
        </span>
      );
      runStart = j;
    }
  }
  return out;
}

export function CodeEditorTextarea({
  value,
  onChange,
  className = "",
  style,
  onKeyDown: userKeyDown,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const spans = useMemo(() => pairHighlightSpans(value), [value]);

  const setSel = (s: number, e: number) => {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(s, e);
    });
  };

  const syncScroll = () => {
    const t = ref.current;
    const p = preRef.current;
    if (!t || !p) return;
    p.scrollTop = t.scrollTop;
    p.scrollLeft = t.scrollLeft;
  };

  useLayoutEffect(() => {
    syncScroll();
  }, [value]);

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

  const ghostTail = value.endsWith("\n") ? "\n\u00a0" : "";

  return (
    <div
      style={style}
      className={[
        "relative isolate w-full min-w-0 overflow-hidden focus-within:border-emerald-700 focus-within:outline-none focus-within:ring-1 focus-within:ring-emerald-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        aria-hidden
        className="invisible w-full overflow-hidden whitespace-pre font-[inherit] [font-size:inherit] [line-height:inherit]"
      >
        {value || "\u00a0"}
        {ghostTail}
      </div>
      <pre
        ref={preRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 box-border w-full overflow-auto whitespace-pre border-0 bg-transparent p-0 font-[inherit] [font-size:inherit] [line-height:inherit]"
      >
        <code className="block min-h-full font-[inherit] [font-size:inherit] [line-height:inherit]">
          {spans.length ? spans : "\u00a0"}
        </code>
      </pre>
      <textarea
        ref={ref}
        {...rest}
        style={style}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        className="absolute inset-0 m-0 box-border min-h-full w-full cursor-text resize-none overflow-auto whitespace-pre border-0 bg-transparent p-0 font-[inherit] text-transparent [font-size:inherit] [line-height:inherit] caret-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-0"
        spellCheck={false}
        wrap="off"
      />
    </div>
  );
}
