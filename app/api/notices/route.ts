import { NextResponse } from "next/server";
import { createNotice, listNotices } from "@/lib/google-sheets";
import { noticeSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ notices: await listNotices() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "안내사항을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = noticeSchema.parse(await request.json());
    await createNotice(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "안내사항을 등록하지 못했습니다." }, { status: 400 });
  }
}
