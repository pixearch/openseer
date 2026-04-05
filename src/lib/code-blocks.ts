import type { CodeBlockEntry } from "@/lib/types/graph";

/** Stable, display-ready blocks; empty/missing arrays become one empty block. */
export function normalizeCodeBlocksForDisplay(nodeId: string, raw: unknown): CodeBlockEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ id: `${nodeId}-b0`, content: "" }];
  }
  return raw.map((item, i) => {
    if (item && typeof item === "object" && "content" in item) {
      const content = String((item as { content: unknown }).content ?? "");
      let id = String((item as { id: unknown }).id ?? "");
      if (!id) id = `${nodeId}-b${i}`;
      return { id, content };
    }
    return { id: `${nodeId}-b${i}`, content: "" };
  });
}

export function copyAllCodeBlocks(blocks: CodeBlockEntry[]): string {
  return blocks.map((b) => b.content).join("\n\n");
}

export function newCodeBlockId(): string {
  return crypto.randomUUID();
}
