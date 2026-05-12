import { NextResponse } from "next/server";

type DebateRequest = {
  title?: string;
  content?: string;
  background?: string;
};

export async function POST(request: Request) {
  const input = (await request.json()) as DebateRequest;
  const title = input.title?.trim() ?? "";
  const content = input.content?.trim() || input.background?.trim() || "";

  if (!title || !content) {
    return NextResponse.json(
      { error: "안건 제목과 안건 내용은 필수입니다." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    decisionId: crypto.randomUUID(),
    message: "이제 /api/debate/stream에서 실제 AI 토론을 순서대로 스트리밍합니다.",
  });
}
