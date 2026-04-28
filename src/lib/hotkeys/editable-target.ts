/**
 * When true, graph must not act on the key (typing in form fields, editors, tag input, code modal).
 */
export function isGlobalHotkeySuppressedEventTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const name = t.tagName;
  if (name === "INPUT" || name === "TEXTAREA" || name === "SELECT" || name === "OPTION") return true;
  const r = t.getAttribute("role");
  if (r === "textbox" || r === "combobox" || r === "searchbox" || r === "spinbutton") return true;
  if (t.closest?.("[data-openseer-no-graph-hotkey]")) return true;
  return false;
}
