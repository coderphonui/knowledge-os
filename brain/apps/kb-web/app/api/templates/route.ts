import { NextResponse } from "next/server";
import { KB_ROOT } from "@/lib/kb-fs";
import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";

const TEMPLATES_DIR = "_templates";

async function getTemplatesDir(): Promise<string> {
  const dir = path.resolve(KB_ROOT, TEMPLATES_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function parseFrontmatterYaml(content: string): string {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  return match ? match[1] : "";
}

export async function GET() {
  try {
    const dir = await getTemplatesDir();
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const templates = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      try {
        const filePath = path.join(dir, entry.name);
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = matter(raw);
        const baseName = entry.name.replace(/\.md$/, "");
        const rawTitle = String(parsed.data.title ?? "");
        const typeField = String(parsed.data.type ?? "");
        const baseDisplay = baseName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const displayName = rawTitle.includes("{{")
          ? (typeField ? typeField.charAt(0).toUpperCase() + typeField.slice(1) : baseDisplay)
          : (rawTitle || baseDisplay);
        templates.push({
          name: baseName,
          displayName,
          description: String(parsed.data.description ?? ""),
          frontmatterYaml: parseFrontmatterYaml(raw),
          body: parsed.content.trim(),
        });
      } catch {
        continue;
      }
    }

    templates.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { name, frontmatter, body } = (await request.json()) as {
      name?: string;
      frontmatter?: string;
      body?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const safeName = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-");

    if (!safeName) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const dir = await getTemplatesDir();
    const filePath = path.join(dir, `${safeName}.md`);

    if (!path.resolve(filePath).startsWith(dir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fm = (frontmatter ?? "").trim();
    const bd = (body ?? "").trim();
    const content = fm ? `---\n${fm}\n---\n\n${bd}\n` : `${bd}\n`;

    await fs.writeFile(filePath, content, "utf-8");
    return NextResponse.json({ ok: true, name: safeName }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const dir = await getTemplatesDir();
    const filePath = path.resolve(dir, `${name}.md`);

    if (!filePath.startsWith(dir)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    await fs.rm(filePath, { force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
