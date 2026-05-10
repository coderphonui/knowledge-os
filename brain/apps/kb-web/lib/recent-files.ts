"use client";

import type { RecentFile } from "./types";

const STORAGE_KEY = "kb-recent-files";
const MAX_RECENT = 12;

export function getRecentFiles(): RecentFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentFile[]) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(path: string): void {
  if (typeof window === "undefined") return;
  const name = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  const recent = getRecentFiles().filter((f) => f.path !== path);
  recent.unshift({ path, name, accessedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function removeRecentFile(path: string): void {
  if (typeof window === "undefined") return;
  const recent = getRecentFiles().filter((f) => f.path !== path);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

export function renameRecentFile(oldPath: string, newPath: string): void {
  if (typeof window === "undefined") return;
  const name = newPath.split("/").pop()?.replace(/\.md$/, "") ?? newPath;
  const recent = getRecentFiles().map((f) =>
    f.path === oldPath ? { ...f, path: newPath, name } : f
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}
