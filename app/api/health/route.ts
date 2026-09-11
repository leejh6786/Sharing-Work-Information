import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = ["GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"]
    .every((name) => Boolean(process.env[name]));
  return NextResponse.json({ ok: true, sheetsConfigured: configured });
}
