import fs from "fs/promises";
import path from "path";

export const KB_ROOT = process.env.KB_ROOT || path.resolve(process.cwd(), "../../../data");

export interface KbNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: KbNode[];
}

export async function listDirectory(dirPath: string): Promise<KbNode[]> {
  const fullPath = path.resolve(KB_ROOT, dirPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });

  const nodes: KbNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("_assets")) continue;
    if (entry.name === "_templates") continue;

    const relativePath = path.join(dirPath, entry.name).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "folder",
      });
    } else if (entry.name.endsWith(".md")) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "file",
      });
    }
  }

  // Sort: folders first, then files, alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function readFile(filePath: string): Promise<{ content: string; frontmatter: string; body: string }> {
  const fullPath = path.resolve(KB_ROOT, filePath);
  const content = await fs.readFile(fullPath, "utf-8");

  // Parse frontmatter
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (match) {
    return { content, frontmatter: match[1], body: match[2] };
  }
  return { content, frontmatter: "", body: content };
}

export async function writeFile(filePath: string, frontmatter: string, body: string): Promise<void> {
  const fullPath = path.resolve(KB_ROOT, filePath);
  const content = frontmatter.trim()
    ? `---\n${frontmatter}\n---\n\n${body.trim()}\n`
    : `${body.trim()}\n`;
  await fs.writeFile(fullPath, content, "utf-8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(path.resolve(KB_ROOT, filePath));
    return true;
  } catch {
    return false;
  }
}

export async function deleteNode(nodePath: string): Promise<void> {
  const fullPath = path.resolve(KB_ROOT, nodePath);
  const resolvedRoot = path.resolve(KB_ROOT);
  if (!fullPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid path");
  }
  await fs.rm(fullPath, { recursive: true, force: true });
}

export async function renameNode(oldPath: string, newPath: string): Promise<void> {
  const resolvedRoot = path.resolve(KB_ROOT);
  const oldFull = path.resolve(KB_ROOT, oldPath);
  const newFull = path.resolve(KB_ROOT, newPath);

  if (!oldFull.startsWith(resolvedRoot) || !newFull.startsWith(resolvedRoot)) {
    throw new Error("Invalid path");
  }

  await fs.mkdir(path.dirname(newFull), { recursive: true });
  await fs.rename(oldFull, newFull);
}
