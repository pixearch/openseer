/** Opens a document in a new tab. Long data: URLs often open as about:blank via <a href>; blob URLs avoid that. */
export async function openDocumentUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  if (trimmed.startsWith("data:")) {
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!w) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 180_000);
    } catch {
      /* ignore */
    }
    return;
  }

  window.open(trimmed, "_blank", "noopener,noreferrer");
}

/** Short labels for a document-card preview (no filename for data URLs). */
export function documentPreviewMeta(url: string): {
  typeLabel: string;
  detail: string;
} {
  const u = url.trim();
  if (u.startsWith("data:")) {
    const m = u.match(/^data:([^;,]+)/i);
    const mime = (m?.[1] ?? "application/octet-stream").toLowerCase();
    if (mime.includes("pdf")) return { typeLabel: "PDF", detail: "Embedded file" };
    if (mime.startsWith("text/")) return { typeLabel: "Text", detail: "Embedded file" };
    const part = mime.split("/")[1];
    return {
      typeLabel: part ? part.toUpperCase() : "File",
      detail: "Embedded file",
    };
  }
  try {
    const parsed = new URL(u);
    return { typeLabel: "Linked file", detail: parsed.hostname };
  } catch {
    return { typeLabel: "Linked file", detail: "URL" };
  }
}
