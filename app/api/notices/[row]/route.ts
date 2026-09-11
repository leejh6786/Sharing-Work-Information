import { NextResponse } from "next/server";
import { deleteNotice, updateNotice } from "@/lib/google-sheets";
import { noticeSchema } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ row: string }> };

function rowNumber(value: string) {
  const row = Number(value);
  if (!Number.isInteger(row) || row < 4) throw new Error("올바르지 않은 행 번호입니다.");
  return row;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { row } = await context.params;
    const input = noticeSchema.parse(await request.json());
    await updateNotice(rowNumber(row), input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "안내사항을 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { row } = await context.params;
    await deleteNotice(rowNumber(row));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "안내사항을 삭제하지 못했습니다." }, { status: 400 });
  }
}
