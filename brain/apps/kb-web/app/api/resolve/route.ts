import { NextResponse } from "next/server";
import { KB_ROOT } from "@/lib/kb-fs";
import fs from "fs/promises";
import path from "path";

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function findBySuffix(dir: string, suffix: string): Promise<string | null> {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const found = await findBySuffix(full, suffix);
      if (found) return found;
    } else if (full.endsWith(suffix)) {
      return full;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const href = searchParams.get("href");       // the link href clicked
  const from = searchParams.get("from") ?? ""; // current file path (relative to KB_ROOT)

  if (!href) return NextResponse.json({ error: "Missing href" }, { status: 400 });

  // Strip any leading / and ensure .md extension
  const cleaned = href.replace(/^\/+/, "");
  const withMd = cleaned.endsWith(".md") ? cleaned : cleaned + ".md";

  const rel = (abs: string) => path.relative(KB_ROOT, abs).replace(/\\/g, "/");

  // 1. Relative to current file's directory
  if (from) {
    const fromDir = path.dirname(path.resolve(KB_ROOT, from));
    const candidate = path.resolve(fromDir, withMd);
    if (candidate.startsWith(KB_ROOT) && await fileExists(candidate)) {
      return NextResponse.json({ path: rel(candidate) });
    }
  }

  // 2. Relative to KB_ROOT directly
  const direct = path.resolve(KB_ROOT, withMd);
  if (await fileExists(direct)) {
    return NextResponse.json({ path: rel(direct) });
  }

  // 3. Recursive suffix search (handles slug-style paths)
  const suffix = "/" + withMd;
  const found = await findBySuffix(KB_ROOT, suffix);
  if (found) return NextResponse.json({ path: rel(found) });

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
