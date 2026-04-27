import { NextResponse } from "next/server";

import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true, ping: rows[0]?.ok });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
