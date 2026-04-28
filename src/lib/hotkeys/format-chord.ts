import type { Chord } from "@/lib/hotkeys/chord";

const CODE_TO_LABEL: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
  Backslash: "\\",
  IntlBackslash: "\\",
};

for (let i = 0; i < 26; i += 1) {
  const letter = String.fromCharCode(65 + i);
  CODE_TO_LABEL[`Key${letter}`] = letter;
}

const DIGITS = "0123456789";
for (const d of DIGITS) {
  CODE_TO_LABEL[`Digit${d}`] = d;
}

for (const d of "0123456789") {
  CODE_TO_LABEL[`Numpad${d}`] = d === "0" ? "Num 0" : `Num ${d}`;
}
CODE_TO_LABEL.NumpadDecimal = "Num .";
CODE_TO_LABEL.NumpadAdd = "Num +";
CODE_TO_LABEL.NumpadSubtract = "Num -";

export function codeToLabel(code: string): string {
  return CODE_TO_LABEL[code] ?? code;
}

/** Chord as ordered list of kbd label strings for a game-style keycap row. */
export function chordToKeycapLabels(c: Chord): string[] {
  const out: string[] = [];
  if (c.usePrimary) {
    out.push("Ctrl / ⌘");
  } else {
    if (c.ctrl) out.push("Ctrl");
    if (c.meta) out.push("Meta");
  }
  if (c.shift) out.push("Shift");
  if (c.alt) out.push("Alt");
  out.push(codeToLabel(c.code));
  return out;
}

export function formatChordText(c: Chord): string {
  return chordToKeycapLabels(c).join(" + ");
}
