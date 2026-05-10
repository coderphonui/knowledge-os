import matter from "gray-matter";
import YAML from "yaml";

export interface ParsedFrontmatter {
  [key: string]: unknown;
}

// gray-matter/js-yaml converts "2024-01-01" strings → JavaScript Date objects.
// Walk the parsed data and convert any Date back to a YYYY-MM-DD string.
// Also handles the edge case where value looks like a Date but fails instanceof
// (can happen across module boundaries in some bundler environments).
function sanitizeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  // Duck-type check for Date-like objects (toISOString method present)
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).toISOString === "function"
  ) {
    try {
      return (
        (value as Date).toISOString().split("T")[0]
      );
    } catch {
      // fall through
    }
  }
  if (Array.isArray(value)) return value.map(sanitizeDates);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitizeDates(v),
      ])
    );
  }
  return value;
}

export function parseFrontmatter(content: string): {
  frontmatter: ParsedFrontmatter;
  body: string;
} {
  try {
    const parsed = matter(content);
    return {
      frontmatter: sanitizeDates(parsed.data) as ParsedFrontmatter,
      body: parsed.content,
    };
  } catch {
    // Malformed YAML frontmatter — strip the --- block and return empty data
    // so the editor can still load the body content.
    const fmStripped = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
    return { frontmatter: {}, body: fmStripped };
  }
}

export function stringifyFrontmatter(data: ParsedFrontmatter): string {
  return YAML.stringify(data, { lineWidth: 0 });
}


const LIST_LINE_RE = /^[ \t]*(?:[-*+]|\d+\.)[ \t]/;

/**
 * BlockNote doesn't handle "loose lists" (blank lines between items) — it
 * creates an empty bullet block and nests the content as a child paragraph.
 * Fix: collapse blank lines between consecutive list items while preserving
 * blank lines that are part of multi-paragraph item content (indented lines).
 */
function tightenLists(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);

    if (LIST_LINE_RE.test(lines[i])) {
      // Look past any immediately following blank lines
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;

      // Only skip the blanks if the very next non-blank line is also a list item.
      // This preserves blank lines before indented continuation paragraphs.
      if (j > i + 1 && j < lines.length && LIST_LINE_RE.test(lines[j])) {
        i = j - 1; // loop will i++ → land on lines[j]
      }
    }
  }

  return out.join("\n");
}

/**
 * Pre-process markdown before sending to BlockNote.
 * 1. Tighten loose lists (blank lines between items → no blank line).
 * 2. Merge split checkbox patterns into single list-item lines.
 */
export function preprocessMarkdownForEditor(body: string): string {
  const tightened = tightenLists(body);
  const lines = tightened.split("\n");
  const out: string[] = [];
  let i = 0;

  const listItemRe = /^(\s*)([-*])\s+\[([ xX])\]\s*$/;

  while (i < lines.length) {
    const line = lines[i];
    const match = listItemRe.exec(line);

    if (match) {
      const indent = match[1];
      const marker = match[2];
      const checked = match[3];

      // Look ahead: skip empty lines and nested empty checkboxes
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") {
        j++;
      }
      // Skip any nested empty list items (indented checkboxes)
      while (j < lines.length && listItemRe.test(lines[j]) && lines[j].startsWith(indent + " ")) {
        j++;
        while (j < lines.length && lines[j].trim() === "") {
          j++;
        }
      }

      // If the next non-empty line is plain text (not a list item, heading, code, blockquote, hr, html), merge it
      if (j < lines.length) {
        const nextLine = lines[j];
        const isNewBlock =
          /^\s*#{1,6}\s/.test(nextLine) ||
          /^\s*```/.test(nextLine) ||
          /^\s*>\s/.test(nextLine) ||
          /^\s*[-*]\s/.test(nextLine) ||
          /^\s*\d+\.\s/.test(nextLine) ||
          /^\s*---+\s*$/.test(nextLine) ||
          /^\s*<[a-zA-Z]/.test(nextLine);

        if (!isNewBlock) {
          out.push(`${indent}${marker} [${checked}] ${nextLine.trim()}`);
          i = j + 1;
          continue;
        }
      }
    }

    out.push(line);
    i++;
  }

  return out.join("\n");
}
