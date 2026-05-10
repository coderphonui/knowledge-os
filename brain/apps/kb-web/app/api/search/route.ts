import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const KB_ROOT = process.env.KB_ROOT || path.resolve(process.cwd(), "../../data");
const SEARCH_SCRIPT = path.resolve(KB_ROOT, "../brain/scripts/kb-search/search.py");

export async function POST(request: Request) {
  const { query, topK = 5 } = await request.json();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const results = await new Promise((resolve, reject) => {
      const proc = spawn(
        "python",
        [SEARCH_SCRIPT, query, "--top-k", String(topK), "--json"],
        { cwd: path.dirname(SEARCH_SCRIPT) }
      );

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Search script exited with code ${code}`));
          return;
        }
        try {
          const lines = stdout.trim().split("\n");
          const jsonLine = lines.find((l) => l.startsWith("{"));
          if (jsonLine) {
            resolve(JSON.parse(jsonLine));
          } else {
            resolve({ results: [] });
          }
        } catch {
          resolve({ results: [] });
        }
      });

      proc.on("error", reject);
    });

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
