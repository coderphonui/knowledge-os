"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Search,
  Plus,
  Trash2,
  X,
  Loader2,
  FilePlus,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { NewItemDialog } from "./NewItemDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { toast } from "sonner";
import { removeRecentFile, renameRecentFile } from "@/lib/recent-files";
import type { KbNode } from "@/lib/types";

interface SidebarProps {
  onSelectFile: (path: string | undefined) => void;
  selectedPath?: string;
}

async function fetchNodes(dir: string): Promise<KbNode[]> {
  const res = await fetch(`/api/files/list?dir=${encodeURIComponent(dir)}`);
  const data = (await res.json()) as { nodes?: KbNode[] };
  return data.nodes ?? [];
}

// ---------- Inline rename input ----------

interface RenameInputProps {
  initialValue: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function RenameInput({ initialValue, onConfirm, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.select();
    }, 30);
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const t = value.trim();
          if (t) onConfirm(t);
          else onCancel();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      onBlur={() => {
        const t = value.trim();
        if (t && t !== initialValue) onConfirm(t);
        else onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 bg-background border rounded px-1.5 py-0.5 text-[13px] outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

// ---------- TreeNode ----------

interface TreeNodeProps {
  node: KbNode;
  depth: number;
  selectedPath?: string;
  onSelectFile: (path: string | undefined) => void;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (oldPath: string, newPath: string, newName: string) => void;
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  expanded,
  onToggle,
  onDelete,
  onRename,
}: TreeNodeProps) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;

  const [children, setChildren] = useState<KbNode[]>(node.children ?? []);
  const [loaded, setLoaded] = useState(!!node.children);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const toggle = useCallback(async () => {
    if (node.type !== "folder") return;
    if (!loaded) {
      const fetched = await fetchNodes(node.path);
      setChildren(fetched);
      setLoaded(true);
    }
    onToggle(node.path);
  }, [node, loaded, onToggle]);

  const handleDeleteConfirmed = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/files?path=${encodeURIComponent(node.path)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      if (selectedPath === node.path) onSelectFile(undefined);
      if (selectedPath?.startsWith(node.path + "/")) onSelectFile(undefined);
      removeRecentFile(node.path);
      onDelete(node.path);
      toast.success(`Deleted "${node.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }, [node, selectedPath, onSelectFile, onDelete]);

  const handleRenameConfirm = useCallback(
    async (newDisplayName: string) => {
      setIsRenaming(false);
      const parentPath = node.path.split("/").slice(0, -1).join("/");
      const ext = node.type === "file" && !newDisplayName.endsWith(".md") ? ".md" : "";
      const newName = `${newDisplayName}${ext}`;
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      if (newPath === node.path) return;

      try {
        const res = await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath: node.path, newPath }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to rename");
        }

        renameRecentFile(node.path, newPath);
        onRename(node.path, newPath, newName);

        // Update selected path if needed
        if (selectedPath === node.path) {
          onSelectFile(newPath);
        } else if (
          node.type === "folder" &&
          selectedPath?.startsWith(node.path + "/")
        ) {
          onSelectFile(
            selectedPath.replace(node.path + "/", newPath + "/")
          );
        }

        toast.success(`Renamed to "${newName}"`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to rename");
      }
    },
    [node, selectedPath, onSelectFile, onRename]
  );

  const removeChild = useCallback((childPath: string) => {
    setChildren((prev) => prev.filter((c) => c.path !== childPath));
  }, []);

  const renameChild = useCallback(
    (oldPath: string, newPath: string, newName: string) => {
      setChildren((prev) =>
        prev.map((c) =>
          c.path === oldPath ? { ...c, path: newPath, name: newName } : c
        )
      );
    },
    []
  );

  const handleNewItemCreated = useCallback(
    (newNode: { name: string; path: string; type: "file" | "folder" }) => {
      if (newNode.type === "file") {
        setChildren((prev) => [
          ...prev,
          { name: newNode.name, path: newNode.path, type: "file" },
        ]);
        onSelectFile(newNode.path);
      } else {
        setChildren((prev) => [
          ...prev,
          { name: newNode.name, path: newNode.path, type: "folder", children: [] },
        ]);
      }
      if (!isExpanded) onToggle(node.path);
      toast.success(`Created "${newNode.name}"`);
    },
    [isExpanded, onToggle, node.path, onSelectFile]
  );

  // Display name strips .md extension
  const displayName =
    node.type === "file" ? node.name.replace(/\.md$/, "") : node.name;
  const renameDefault =
    node.type === "file" ? node.name.replace(/\.md$/, "") : node.name;

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            onClick={() => {
              if (node.type === "folder") toggle();
              else onSelectFile(node.path);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-1 rounded-sm py-[4px] text-[13px] transition-colors",
              "hover:bg-accent/60",
              isSelected
                ? "bg-accent/80 text-foreground font-medium"
                : "text-foreground/80"
            )}
            style={{
              paddingLeft: `${depth * 14 + 8}px`,
              paddingRight: "6px",
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (node.type === "folder") toggle();
                else onSelectFile(node.path);
              }
            }}
          >
            <span className="shrink-0 w-[14px] flex items-center justify-center text-muted-foreground/50">
              {node.type === "folder" &&
                (isExpanded ? (
                  <ChevronDown size={11} />
                ) : (
                  <ChevronRight size={11} />
                ))}
            </span>
            <span className="shrink-0 text-muted-foreground/60">
              {node.type === "folder" ? (
                isExpanded ? (
                  <FolderOpen size={13} />
                ) : (
                  <Folder size={13} />
                )
              ) : (
                <FileText size={13} />
              )}
            </span>

            {isRenaming ? (
              <RenameInput
                initialValue={renameDefault}
                onConfirm={handleRenameConfirm}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <span className="truncate leading-5 flex-1">{displayName}</span>
            )}
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content
            className={cn(
              "z-50 min-w-[170px] overflow-hidden rounded-lg border bg-popover p-1",
              "text-[13px] text-popover-foreground shadow-md",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            {node.type === "folder" && (
              <>
                <ContextMenu.Item
                  onSelect={() => setNewItemOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none hover:bg-accent hover:text-accent-foreground"
                >
                  <FilePlus size={13} className="text-muted-foreground" />
                  New item here
                </ContextMenu.Item>
                <ContextMenu.Separator className="my-1 h-px bg-border mx-1" />
              </>
            )}
            <ContextMenu.Item
              onSelect={() => setIsRenaming(true)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil size={13} className="text-muted-foreground" />
              Rename
            </ContextMenu.Item>
            <ContextMenu.Separator className="my-1 h-px bg-border mx-1" />
            <ContextMenu.Item
              onSelect={() => setDeleteOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-destructive outline-none select-none hover:bg-destructive/10"
            >
              <Trash2 size={13} />
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {node.type === "folder" && isExpanded && loaded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expanded={expanded}
              onToggle={onToggle}
              onDelete={removeChild}
              onRename={renameChild}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${node.type}`}
        description={`Delete "${displayName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirmed}
      />

      {node.type === "folder" && (
        <NewItemDialog
          open={newItemOpen}
          onOpenChange={setNewItemOpen}
          parentPath={node.path}
          onCreated={handleNewItemCreated}
        />
      )}
    </>
  );
}

// ---------- Sidebar ----------

export default function Sidebar({ onSelectFile, selectedPath }: SidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [topNodes, setTopNodes] = useState<KbNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KbNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);

  useEffect(() => {
    fetchNodes("").then(setTopNodes).catch(console.error);
  }, []);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleDeleteTop = useCallback((path: string) => {
    setTopNodes((prev) => prev.filter((n) => n.path !== path));
  }, []);

  const handleRenameTop = useCallback(
    (oldPath: string, newPath: string, newName: string) => {
      setTopNodes((prev) =>
        prev.map((n) =>
          n.path === oldPath ? { ...n, path: newPath, name: newName } : n
        )
      );
    },
    []
  );

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: 10 }),
      });
      const data = (await res.json()) as {
        results?: Array<{ path?: string; file?: string }>;
      };
      const results: KbNode[] = (data.results ?? []).map((r) => {
        const p = r.path ?? r.file ?? "";
        const name = p.split("/").pop() ?? p;
        return { name, path: p, type: "file" as const };
      });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const handleTopLevelCreated = useCallback(
    (node: { name: string; path: string; type: "file" | "folder" }) => {
      setTopNodes((prev) => [
        ...prev,
        {
          name: node.name,
          path: node.path,
          type: node.type,
          children: node.type === "folder" ? [] : undefined,
        },
      ]);
      if (node.type === "file") onSelectFile(node.path);
      toast.success(`Created "${node.name}"`);
    },
    [onSelectFile]
  );

  const isSearchMode = !!searchQuery.trim();
  const displayNodes = isSearchMode ? searchResults : topNodes;

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <button
          onClick={() => onSelectFile(undefined)}
          className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors select-none"
          title="Go home"
        >
          Knowledge
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setNewItemOpen(true)}
            className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="New file or folder"
          >
            <Plus size={13} />
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b">
        <div className="relative flex items-center">
          <Search
            size={12}
            className="absolute left-2.5 text-muted-foreground/50 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchResults([]);
              }
            }}
            className="w-full rounded-md bg-accent/40 pl-7 pr-7 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground/40 focus:bg-background focus:ring-1 focus:ring-ring transition-colors"
          />
          {searching && (
            <Loader2
              size={11}
              className="absolute right-2.5 text-muted-foreground/50 animate-spin"
            />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="absolute right-2 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {/* Empty states */}
        {isSearchMode && searchResults.length === 0 && !searching && (
          <p className="px-3 py-4 text-[12px] text-muted-foreground/60 text-center">
            No results
          </p>
        )}
        {!isSearchMode && topNodes.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-[12px] text-muted-foreground/60 mb-2">
              No notes yet
            </p>
            <button
              onClick={() => setNewItemOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={11} />
              Create one
            </button>
          </div>
        )}

        {displayNodes.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            expanded={expanded}
            onToggle={toggleExpand}
            onDelete={handleDeleteTop}
            onRename={handleRenameTop}
          />
        ))}
      </div>

      <NewItemDialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        parentPath=""
        onCreated={handleTopLevelCreated}
      />
    </div>
  );
}
