/** YouTube watch/embed/shorts and youtu.be — used for thumbnails and server metadata fetch. */
export function parseYoutubeVideoId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/watch")) {
        const id = u.searchParams.get("v");
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.slice(7).split("/")[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.slice(8).split("/")[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* relative or invalid URL */
  }
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return m?.[1] ?? null;
}

export function youtubeThumbnailUrl(videoId: string, quality: "hq" | "max" = "hq"): string {
  if (quality === "max") {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function formatYoutubeDurationSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** YYYY-MM-DD for `<input type="date">`, or null if unparseable. */
export function youtubeDateToInputValue(isoLike: string | null | undefined): string | null {
  if (!isoLike) return null;
  const m = isoLike.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}
