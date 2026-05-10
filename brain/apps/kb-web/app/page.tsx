"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Editor from "@/components/Editor";
import { CommandPalette } from "@/components/CommandPalette";
import { NewItemDialog } from "@/components/NewItemDialog";
import { AgentChat } from "@/components/AgentChat";
import { useResizableWidth } from "@/lib/hooks";
import { BookOpen, Plus, Search, FileText, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRecentFiles } from "@/lib/recent-files";
import type { RecentFile } from "@/lib/types";
import { toast } from "sonner";

const DEFAULT_SIDEBAR_WIDTH = 260;
const DEFAULT_CHAT_WIDTH = 360;

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<string | undefined>(
    undefined
  );
  const [cmdOpen, setCmdOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Init selectedFile from URL on first mount + handle browser back/forward
  useEffect(() => {
    const syncFromUrl = () => {
      const p = window.location.pathname;
      setSelectedFile(p && p !== "/" ? p.slice(1) : undefined);
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  // Update URL without triggering Next.js navigation (SPA pattern)
  const navigateTo = useCallback((path: string | undefined) => {
    setSelectedFile(path);
    window.history.pushState(null, "", path ? `/${path}` : "/");
  }, []);

  const { width: sidebarWidth, startResize: startResizeSidebar } =
    useResizableWidth("kb-sidebar-width", DEFAULT_SIDEBAR_WIDTH, 200, 420);

  const { width: chatWidth, startResize: startResizeChat } =
    useResizableWidth("kb-chat-width", DEFAULT_CHAT_WIDTH, 280, 600);

  // Cmd+K → command palette; Cmd+Shift+A → agent chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "a") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleNewNoteCreated = useCallback(
    (node: { name: string; path: string; type: "file" | "folder" }) => {
      if (node.type === "file") navigateTo(node.path);
      toast.success(`Created "${node.name}"`);
    },
    [navigateTo]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Mobile: sidebar or editor */}
      <div
        className={cn(
          "md:hidden h-full flex-shrink-0",
          selectedFile ? "hidden" : "flex w-full"
        )}
      >
        <Sidebar onSelectFile={navigateTo} selectedPath={selectedFile} />
      </div>

      {/* Desktop sidebar — always visible, resizable */}
      <div
        className="hidden md:flex h-full flex-shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="h-full w-full overflow-hidden">
          <Sidebar onSelectFile={navigateTo} selectedPath={selectedFile} />
        </div>
        <div
          onMouseDown={(e) => startResizeSidebar(e, "e")}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-10"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Main content area */}
      <div
        className={cn(
          "flex h-full flex-1 overflow-hidden min-w-0",
          !selectedFile && "hidden md:flex"
        )}
      >
        {selectedFile ? (
          <Editor
            key={selectedFile}
            filePath={selectedFile}
            onBack={() => navigateTo(undefined)}
            onNavigate={navigateTo}
            onToggleAgent={() => setChatOpen((v) => !v)}
            agentOpen={chatOpen}
          />
        ) : (
          <EmptyState
            onNewNote={() => setNewItemOpen(true)}
            onSearch={() => setCmdOpen(true)}
            onSelectFile={navigateTo}
            onOpenAgent={() => setChatOpen(true)}
          />
        )}
      </div>

      {/* Agent chat panel — desktop only, resizable */}
      {chatOpen && (
        <div
          className="hidden md:flex flex-col h-full flex-shrink-0 relative border-l"
          style={{ width: chatWidth }}
        >
          <div
            onMouseDown={(e) => startResizeChat(e, "w")}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-10"
            style={{ touchAction: "none" }}
          />
          <div className="h-full w-full overflow-hidden">
            <AgentChat
              currentFile={selectedFile}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Command palette */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onSelectFile={navigateTo}
        onNewNote={() => setNewItemOpen(true)}
      />

      {/* New item dialog */}
      <NewItemDialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        parentPath=""
        onCreated={handleNewNoteCreated}
      />
    </div>
  );
}

// ---------- Recent helpers ----------

function smartDisplayName(name: string): string {
  return name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function getParentFolder(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts[parts.length - 2] : "";
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  return `${Math.floor(day / 7)}w`;
}

// ---------- Empty state ----------

interface EmptyStateProps {
  onNewNote: () => void;
  onSearch: () => void;
  onSelectFile: (path: string) => void;
  onOpenAgent: () => void;
}

function EmptyState({ onNewNote, onSearch, onSelectFile, onOpenAgent }: EmptyStateProps) {
  const [recent, setRecent] = useState<RecentFile[]>([]);

  useEffect(() => {
    setRecent(getRecentFiles().slice(0, 5));
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center select-none px-8">
      <div className="text-muted-foreground/12 mb-6">
        <BookOpen size={44} strokeWidth={1.25} />
      </div>

      <p className="text-[15px] font-semibold text-foreground/80 mb-1 text-center">
        Nothing open
      </p>
      <p className="text-[13px] text-muted-foreground/60 text-center max-w-[260px] leading-relaxed mb-8">
        Select a note from the sidebar, search, or create a new one.
      </p>

      {/* Quick actions */}
      <div className="flex flex-col gap-2 w-full max-w-[220px]">
        <button
          onClick={onNewNote}
          className="flex items-center gap-2.5 rounded-lg border bg-background px-4 py-2.5 text-[13px] font-medium hover:bg-accent transition-colors shadow-sm"
        >
          <Plus size={14} className="text-muted-foreground/60" />
          New note
        </button>
        <button
          onClick={onSearch}
          className="flex items-center gap-2.5 rounded-lg border bg-background px-4 py-2.5 text-[13px] font-medium hover:bg-accent transition-colors shadow-sm"
        >
          <Search size={14} className="text-muted-foreground/60" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] text-muted-foreground/40 font-mono">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={onOpenAgent}
          className="flex items-center gap-2.5 rounded-lg border bg-background px-4 py-2.5 text-[13px] font-medium hover:bg-accent transition-colors shadow-sm"
        >
          <BrainCircuit size={14} className="text-muted-foreground/60" />
          <span className="flex-1 text-left">Agent</span>
          <kbd className="text-[10px] text-muted-foreground/40 font-mono">
            ⌘⇧A
          </kbd>
        </button>
      </div>

      {/* Recent files */}
      {recent.length > 0 && (
        <div className="mt-8 w-full max-w-[260px]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2 px-1">
            Recent
          </p>
          <div className="space-y-0.5">
            {recent.map((f) => {
              const parent = getParentFolder(f.path);
              return (
                <button
                  key={f.path}
                  onClick={() => onSelectFile(f.path)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 hover:bg-accent/60 transition-colors text-left"
                >
                  <FileText
                    size={12}
                    className="text-muted-foreground/40 shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] text-foreground/80 leading-[18px]">
                      {smartDisplayName(f.name)}
                    </div>
                    {parent && (
                      <div className="truncate text-[11px] text-muted-foreground/40 leading-[15px]">
                        {parent}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground/30 leading-[18px]">
                    {relativeTime(f.accessedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Shortcuts */}
      <div className="mt-8 flex flex-col gap-1.5">
        <ShortcutRow keys={["⌘", "K"]} label="Search / command palette" />
        <ShortcutRow keys={["⌘", "S"]} label="Save current note" />
        <ShortcutRow keys={["⌘", "⇧", "A"]} label="Knowledge Agent" />
        <ShortcutRow keys={["Right-click"]} label="File actions in sidebar" />
      </div>
    </div>
  );
}

function ShortcutRow({
  keys,
  label,
}: {
  keys: string[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {k}
          </kbd>
        ))}
      </div>
      <span className="text-[12px] text-muted-foreground/50">{label}</span>
    </div>
  );
}
