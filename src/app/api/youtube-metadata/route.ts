import { NextRequest, NextResponse } from "next/server";
import { parseYoutubeVideoId } from "@/lib/youtube";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** YouTube oEmbed only (no API key). Title and author_name only. */
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
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatch)}&format=json`,
      { headers: { "User-Agent": UA }, cache: "no-store" }
    );
    if (!oembedRes.ok) {
      return NextResponse.json({ error: "oembed failed" }, { status: 502 });
    }
    const oembed = (await oembedRes.json()) as {
      title?: string;
      author_name?: string;
    };
    const title = typeof oembed.title === "string" ? oembed.title : "";
    const author = typeof oembed.author_name === "string" ? oembed.author_name : "";
    return NextResponse.json({
      title: title || "YouTube video",
      author,
    });
  } catch {
    return NextResponse.json({ error: "oembed unavailable" }, { status: 502 });
  }
}
