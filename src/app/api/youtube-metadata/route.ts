import { NextRequest, NextResponse } from "next/server";
import {
  formatYoutubeDurationSeconds,
  parseYoutubeVideoId,
  youtubeDateToInputValue,
} from "@/lib/youtube";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Best-effort YouTube metadata without API keys.
 * Uses oEmbed for title, then optional watch-page scraping for duration / description / date.
 * Structured for future expansion (Invidious, Data API, etc.).
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  const videoId = parseYoutubeVideoId(rawUrl);
  if (!videoId) {
    return NextResponse.json({ error: "unsupported url" }, { status: 400 });
  }

  const canonicalWatch = `https://www.youtube.com/watch?v=${videoId}`;

  let title = "";
  let shortDescription = "";

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatch)}&format=json`,
      { headers: { "User-Agent": UA }, cache: "no-store" }
    );
    if (oembedRes.ok) {
      const oembed = (await oembedRes.json()) as { title?: string };
      if (typeof oembed.title === "string") title = oembed.title;
    }
  } catch {
    /* oEmbed blocked or network error */
  }

  let videoDurationLabel: string | undefined;
  let videoPublishedAt: string | undefined;

  try {
    const pageRes = await fetch(canonicalWatch, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store",
    });
    if (pageRes.ok) {
      const html = await pageRes.text();

      const lenM = html.match(/"lengthSeconds":\s*"(\d+)"/);
      if (lenM) {
        const sec = Number(lenM[1]);
        if (Number.isFinite(sec) && sec > 0) {
          videoDurationLabel = formatYoutubeDurationSeconds(sec);
        }
      }

      const pubM = html.match(/itemprop="datePublished"\s+content="([^"]+)"/);
      if (pubM?.[1]) {
        const d = youtubeDateToInputValue(pubM[1]);
        if (d) videoPublishedAt = d;
      }

      const ogDesc = html.match(
        /<meta\s+property="og:description"\s+content="([^"]*)"/i
      );
      if (ogDesc?.[1] && !shortDescription) {
        shortDescription = decodeYoutubeHtmlEntities(ogDesc[1]);
      }
    }
  } catch {
    /* watch page unavailable */
  }

  return NextResponse.json({
    title: title || "YouTube video",
    shortDescription,
    videoPublishedAt: videoPublishedAt ?? "",
    videoDurationLabel: videoDurationLabel ?? "",
  });
}

function decodeYoutubeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
