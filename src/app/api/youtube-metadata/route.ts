import { NextRequest, NextResponse } from "next/server";
import { parseYoutubeVideoId } from "@/lib/youtube";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchOEmbedJson(canonicalWatch: string): Promise<{ title: string; author: string } | null> {
  const oembedRes = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatch)}&format=json`,
    {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    }
  );
  if (!oembedRes.ok) return null;
  const oembed = (await oembedRes.json()) as {
    title?: string;
    author_name?: string;
  };
  const title = typeof oembed.title === "string" ? oembed.title.trim() : "";
  const author = typeof oembed.author_name === "string" ? oembed.author_name.trim() : "";
  return { title, author };
}

/** Fallback when oEmbed is blocked or returns no title (datacenter / bot quirks). */
async function fetchTitleFromWatchPage(videoId: string): Promise<string | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
  if (!og?.[1]) return null;
  const title = decodeHtmlEntities(og[1]).trim();
  return title || null;
}

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

  try {
    let title = "";
    let author = "";
    const oembed = await fetchOEmbedJson(canonicalWatch);
    if (oembed) {
      title = oembed.title;
      author = oembed.author;
    }
    if (!title) {
      const fromPage = await fetchTitleFromWatchPage(videoId);
      if (fromPage) title = fromPage;
    }
    if (!title) {
      return NextResponse.json({ error: "metadata unavailable" }, { status: 502 });
    }
    return NextResponse.json({ title, author });
  } catch {
    return NextResponse.json({ error: "metadata unavailable" }, { status: 502 });
  }
}
