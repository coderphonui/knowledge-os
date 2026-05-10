import { NextResponse } from "next/server";
import { readFile, writeFile, deleteNode, renameNode, KB_ROOT } from "@/lib/kb-fs";
import path from "path";
import fs from "fs/promises";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { path: filePath, frontmatter, body } = await request.json();

  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    await writeFile(filePath, frontmatter, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { path: filePath, frontmatter, body } = await request.json();

  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const fullPath = path.resolve(KB_ROOT, filePath);

  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(fullPath);
      return NextResponse.json({ error: "File already exists" }, { status: 409 });
    } catch {
      // File does not exist, good
    }

    await writeFile(filePath, frontmatter, body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { oldPath, newPath } = await request.json();

  if (!oldPath || !newPath) {
    return NextResponse.json({ error: "Missing paths" }, { status: 400 });
  }

  try {
    await renameNode(oldPath, newPath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to rename" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    await deleteNode(filePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
