/** Coerce persisted / unknown `tags` to a clean string[] (trim, drop empties, dedupe order-preserving). */
export function normalizeStoredTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = String(item).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function nodeHasAnyTag(nodeTags: unknown, selected: Set<string>): boolean {
  if (selected.size === 0) return false;
  return normalizeStoredTags(nodeTags).some((t) => selected.has(t));
}
