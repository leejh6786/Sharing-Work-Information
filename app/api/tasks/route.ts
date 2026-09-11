import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/google-sheets";
import { taskSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listTasks() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "업무목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = taskSchema.parse(await request.json());
    await createTask(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "업무를 등록하지 못했습니다." }, { status: 400 });
  }
}
