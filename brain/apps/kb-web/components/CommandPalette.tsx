"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Clock, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRecentFiles } from "@/lib/recent-files";
import type { RecentFile } from "@/lib/types";

type PaletteItem =
  | { kind: "file" | "recent"; path: string; name: string; dir: string }
  | { kind: "action"; id: string; label: string };

interface SearchResult {
  path: string;
  file?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFile: (path: string) => void;
  onNewNote?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectFile,
  onNewNote,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ path: string; name: string; dir: string }>>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setRecentFiles(getRecentFiles().slice(0, 8));
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, topK: 10 }),
      });
      const data = (await res.json()) as { results?: SearchResult[] };
      setResults(
        (data.results ?? []).map((r) => {
          const p = r.path ?? r.file ?? "";
          const parts = p.split("/");
          const name = parts.pop()?.replace(/\.md$/, "") ?? p;
          return { path: p, name, dir: parts.join("/") };
        })
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(trimmedQuery), 200);
    return () => clearTimeout(t);
  }, [trimmedQuery, doSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery]);

  const items: PaletteItem[] = [];

  if (trimmedQuery) {
    results.forEach((r) => items.push({ kind: "file", ...r }));
  } else {
    recentFiles.forEach((f) => {
      const parts = f.path.split("/");
      const dir = parts.slice(0, -1).join("/");
      items.push({ kind: "recent", path: f.path, name: f.name, dir });
    });
  }

  if (onNewNote) {
    items.push({ kind: "action", id: "new-note", label: "New note" });
  }

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      if (item.kind === "action") {
        if (item.id === "new-note") onNewNote?.();
      } else {
        onSelectFile(item.path);
      }
      onOpenChange(false);
    },
    [onSelectFile, onNewNote, onOpenChange]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onOpenChange(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, items.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (items[activeIndex]) handleSelect(items[activeIndex]);
          break;
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [open, items, activeIndex, handleSelect, onOpenChange]);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const hasSection = !trimmedQuery && recentFiles.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "12vh" }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="relative w-full max-w-[560px] mx-4 rounded-xl border bg-background shadow-2xl overflow-hidden"
        style={{ maxHeight: "min(500px, 72vh)" }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 border-b">
          <Search size={15} className="text-muted-foreground/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="flex-1 py-3.5 text-[14px] bg-transparent outline-none placeholder:text-muted-foreground/40"
          />
          {searching ? (
            <Loader2
              size={14}
              className="text-muted-foreground/50 animate-spin shrink-0"
            />
          ) : (
            <kbd className="text-[11px] text-muted-foreground/40 font-mono shrink-0 hidden sm:block">
              Esc
            </kbd>
          )}
        </div>

        {/* Section label */}
        {hasSection && (
          <div className="px-4 pt-3 pb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              Recent
            </span>
          </div>
        )}

        {/* Items list */}
        <div
          ref={listRef}
          className="overflow-y-auto py-1.5"
          style={{ maxHeight: "calc(min(500px, 72vh) - 56px - 42px)" }}
        >
          {trimmedQuery && results.length === 0 && !searching && (
            <p className="px-4 py-8 text-[13px] text-muted-foreground/50 text-center">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}
          {!trimmedQuery && recentFiles.length === 0 && (
            <p className="px-4 py-8 text-[13px] text-muted-foreground/50 text-center">
              Start typing to search…
            </p>
          )}

          {items.map((item, i) => {
            const isActive = i === activeIndex;
            const base =
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors";
            const active = isActive ? "bg-accent" : "hover:bg-accent/60";

            if (item.kind === "action") {
              return (
                <button
                  key={item.id}
                  data-index={i}
                  onClick={() => handleSelect(item)}
                  onMouseMove={() => setActiveIndex(i)}
                  className={cn(base, active)}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                      isActive
                        ? "border-foreground/20 bg-background"
                        : "border-border bg-muted/50"
                    )}
                  >
                    <Plus size={12} />
                  </div>
                  <span className="text-[13px] font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.path + i}
                data-index={i}
                onClick={() => handleSelect(item)}
                onMouseMove={() => setActiveIndex(i)}
                className={cn(base, active)}
              >
                {item.kind === "recent" ? (
                  <Clock
                    size={14}
                    className="text-muted-foreground/40 shrink-0"
                  />
                ) : (
                  <FileText
                    size={14}
                    className="text-muted-foreground/40 shrink-0"
                  />
                )}
                <span className="flex-1 text-[13px] truncate">{item.name}</span>
                {item.dir && (
                  <span className="text-[11px] text-muted-foreground/40 font-mono truncate max-w-[200px] shrink-0">
                    {item.dir}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground/40">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
