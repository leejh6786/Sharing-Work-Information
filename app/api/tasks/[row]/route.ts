import { NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/google-sheets";
import { taskSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ row: string }> };

function rowNumber(value: string) {
  const row = Number(value);
  if (!Number.isInteger(row) || row < 3) throw new Error("올바르지 않은 행 번호입니다.");
  return row;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { row } = await context.params;
    const input = taskSchema.parse(await request.json());
    await updateTask(rowNumber(row), input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "업무를 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { row } = await context.params;
    const body = await request.json().catch(() => ({}));
    await deleteTask(rowNumber(row), typeof body.reason === "string" ? body.reason : undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "업무를 삭제하지 못했습니다." }, { status: 400 });
  }
}
