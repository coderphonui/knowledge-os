import { NextResponse } from "next/server";
import { listDirectory } from "@/lib/kb-fs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dir = searchParams.get("dir") || "";

  try {
    const nodes = await listDirectory(dir);
    return NextResponse.json({ nodes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
