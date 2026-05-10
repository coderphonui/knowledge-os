"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import {
  useCreateBlockNote,
  LinkToolbarController,
  LinkToolbar,
  type LinkToolbarProps,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import FrontmatterForm from "./FrontmatterForm";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import {
  stringifyFrontmatter,
  parseFrontmatter,
  preprocessMarkdownForEditor,
} from "@/lib/markdown";
import { addRecentFile } from "@/lib/recent-files";
import {
  Save,
  ArrowLeft,
  Loader2,
  PanelRight,
  Check,
  MoreHorizontal,
  LayoutTemplate,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResizableWidth } from "@/lib/hooks";
import { toast } from "sonner";

interface EditorProps {
  filePath: string;
  onBack?: () => void;
  onNavigate?: (path: string) => void;
  onToggleAgent?: () => void;
  agentOpen?: boolean;
}

function FileBreadcrumb({ path }: { path: string }) {
  const parts = path.split("/");
  const fileName = parts.pop() ?? path;
  return (
    <div className="flex items-center gap-0.5 min-w-0 text-[12px]">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className="text-muted-foreground/50 truncate max-w-[80px]">
            {part}
          </span>
          <span className="text-muted-foreground/30">/</span>
        </span>
      ))}
      <span className="text-foreground/70 truncate">{fileName}</span>
    </div>
  );
}

// BlockNote's Qe() function prepends "https://" to any URL without a known
// scheme, turning internal paths into invalid URLs:
//   /foo/bar.md  →  https:///foo/bar.md
//   foo/bar.md   →  https://foo/bar.md  (foo treated as hostname)
// We intercept editLink and reverse these transformations.
function recoverInternalPath(url: string): string {
  // Case 1: leading-slash path → https:///path
  if (url.startsWith("https:///")) return url.slice("https://".length);

  // Case 2: relative path → https://segment/rest (no dot in hostname = not a real domain)
  if (url.startsWith("https://") || url.startsWith("http://")) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
        return parsed.hostname + parsed.pathname;
      }
    } catch { /* leave as-is */ }
  }

  return url;
}

function FixedLinkToolbar(props: LinkToolbarProps & { onEdited?: () => void }) {
  const { onEdited, ...rest } = props;
  const editLink = useCallback(
    (url: string, text: string) => {
      rest.editLink(recoverInternalPath(url), text);
      onEdited?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rest.editLink, onEdited]
  );
  return <LinkToolbar {...rest} editLink={editLink} />;
}

export default function Editor({ filePath, onBack, onNavigate, onToggleAgent, agentOpen }: EditorProps) {
  const { resolvedTheme } = useTheme();
  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showFm, setShowFm] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templatePayload, setTemplatePayload] = useState({ fm: "", body: "" });

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});
  const loadCountRef = useRef(0);
  const dirtyRef = useRef(false);

  const { width: fmWidth, startResize: startResizeFm } = useResizableWidth(
    "kb-frontmatter-width",
    300,
    240,
    500
  );

  const editor = useCreateBlockNote({ initialContent: undefined });

  // Close "more" menu on outside click
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (!moreMenuRef.current?.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  const loadFile = useCallback(async () => {
    const token = ++loadCountRef.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files?path=${encodeURIComponent(filePath)}`
      );
      const data = (await res.json()) as { content?: string; body?: string };
      if (token !== loadCountRef.current) return;
      const parsed = parseFrontmatter(data.content ?? "");
      setFrontmatter(parsed.frontmatter);
      const body = preprocessMarkdownForEditor(data.body ?? "");
      const blocks = body ? await editor.tryParseMarkdownToBlocks(body) : [];
      if (token !== loadCountRef.current) return;
      editor.replaceBlocks(editor.document, blocks);
      dirtyRef.current = false;
      setDirty(false);
      addRecentFile(filePath);
    } catch (err) {
      if (token !== loadCountRef.current) return;
      console.error("Failed to load file:", err);
      toast.error("Failed to load file");
    } finally {
      if (token === loadCountRef.current) setLoading(false);
    }
  }, [filePath, editor]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const frontmatterRef = useRef(frontmatter);
  useEffect(() => {
    frontmatterRef.current = frontmatter;
  }, [frontmatter]);

  const handleSave = useCallback(
    async (silent = false) => {
      if (!editor || !dirtyRef.current) return;
      setSaving(true);
      try {
        const body = await editor.blocksToMarkdownLossy(editor.document);
        const fmString = stringifyFrontmatter(frontmatterRef.current);
        const res = await fetch("/api/files", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: filePath,
            frontmatter: fmString,
            body,
          }),
        });
        if (res.ok) {
          dirtyRef.current = false;
          setDirty(false);
          if (!silent) toast.success("Saved");
        } else {
          const err = (await res.json()) as { error?: string };
          toast.error(`Save failed: ${err.error}`);
        }
      } catch {
        toast.error("Save failed");
      } finally {
        setSaving(false);
      }
    },
    [editor, filePath]
  );

  // Keep ref in sync for auto-save
  useEffect(() => {
    handleSaveRef.current = () => handleSave(true);
  }, [handleSave]);

  // Auto-save: schedule 2s after last change
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRef.current();
    }, 2000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Shared dirty-marking used by both keyboard input and link toolbar edits
  const markDirtyAndScheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Stable link toolbar component that closes over markDirtyAndScheduleSave
  const LinkToolbarWithDirty = useCallback(
    (props: LinkToolbarProps) => (
      <FixedLinkToolbar {...props} onEdited={markDirtyAndScheduleSave} />
    ),
    [markDirtyAndScheduleSave]
  );

  // Word count (debounced)
  const updateWordCount = useCallback(async () => {
    if (!editor) return;
    const md = await editor.blocksToMarkdownLossy(editor.document);
    const count = md.trim() ? md.trim().split(/\s+/).length : 0;
    setWordCount(count);
  }, [editor]);

  // Use native DOM "beforeinput" to detect user edits. TipTap's "update" event
  // is unreliable here because BlockNote calls removeAllListeners() during the
  // React 19 Strict Mode / Fast Refresh lifecycle. "beforeinput" fires for all
  // user editing actions (typing, delete, paste, cut) before TipTap processes
  // them — unlike "input" which TipTap suppresses via preventDefault() for
  // deletions. Word count is deferred so it reads the post-change ProseMirror
  // state after TipTap's synchronous transaction handler completes.
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    const handler = () => {
      dirtyRef.current = true;
      setDirty(true);
      scheduleAutoSave();
      setTimeout(() => updateWordCount(), 0);
    };
    container.addEventListener("beforeinput", handler);
    return () => container.removeEventListener("beforeinput", handler);
  }, [scheduleAutoSave, updateWordCount, loading]);

  // Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // Internal link navigation
  const editorContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || !onNavigate) return;

    const handleMouseDown = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:")
      )
        return;

      e.preventDefault();
      e.stopPropagation();

      fetch(
        `/api/resolve?href=${encodeURIComponent(href)}&from=${encodeURIComponent(filePath)}`
      )
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { path?: string }) => {
          if (data?.path) onNavigate(data.path);
          else toast.error("File not found");
        })
        .catch(() => toast.error("Could not open link"));
    };

    container.addEventListener("mousedown", handleMouseDown, {
      capture: true,
    });
    return () =>
      container.removeEventListener("mousedown", handleMouseDown, {
        capture: true,
      });
  }, [onNavigate, filePath]);

  const handleOpenSaveTemplate = async () => {
    if (!editor) return;
    const body = await editor.blocksToMarkdownLossy(editor.document);
    const fm = stringifyFrontmatter(frontmatter);
    setTemplatePayload({ fm, body });
    setShowMore(false);
    setShowSaveTemplate(true);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={18} />
      </div>
    );
  }

  const title =
    (frontmatter.title != null ? String(frontmatter.title) : "") ||
    filePath.split("/").pop() ||
    filePath;

  const saveLabel = saving ? "Saving…" : dirty ? "Save" : "Saved";

  return (
    <div className="flex h-full flex-1 flex-col min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-2 md:px-4 gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-medium truncate leading-5">
              {title}
            </span>
            <FileBreadcrumb path={filePath} />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Word count */}
          {wordCount > 0 && (
            <span className="hidden sm:block text-[11px] text-muted-foreground/40 mr-1 tabular-nums">
              {wordCount.toLocaleString()} w
            </span>
          )}

          {/* More options */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMore((v) => !v)}
              className={cn(
                "rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
                showMore && "bg-accent text-foreground"
              )}
              title="More options"
            >
              <MoreHorizontal size={15} />
            </button>

            {showMore && (
              <div className="absolute right-0 top-full mt-1 z-30 w-[200px] rounded-lg border bg-popover shadow-lg p-1 text-[13px]">
                <button
                  onClick={handleOpenSaveTemplate}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 hover:bg-accent transition-colors text-foreground/80"
                >
                  <LayoutTemplate
                    size={13}
                    className="text-muted-foreground/50 shrink-0"
                  />
                  Save as template
                </button>
              </div>
            )}
          </div>

          {/* Agent toggle */}
          {onToggleAgent && (
            <button
              onClick={onToggleAgent}
              title="Knowledge Agent (⌘⇧A)"
              className={cn(
                "hidden md:flex rounded-sm p-1.5 text-muted-foreground transition-colors",
                agentOpen
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent hover:text-foreground"
              )}
            >
              <BrainCircuit size={15} />
            </button>
          )}

          {/* Properties panel toggle (mobile/tablet) */}
          <button
            onClick={() => setShowFm((v) => !v)}
            className={cn(
              "lg:hidden rounded-sm p-1.5 text-muted-foreground transition-colors",
              showFm
                ? "bg-accent text-foreground"
                : "hover:bg-accent hover:text-foreground"
            )}
            title="Toggle properties"
          >
            <PanelRight size={15} />
          </button>

          {/* Save button */}
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !dirty}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              dirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground/40 cursor-default"
            )}
          >
            {saving ? (
              <Loader2 className="animate-spin" size={13} />
            ) : dirty ? (
              <Save size={13} />
            ) : (
              <Check size={13} />
            )}
            <span className="hidden sm:inline">{saveLabel}</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div
          ref={editorContainerRef}
          className="flex flex-1 flex-col overflow-y-auto min-w-0"
        >
          <div className="px-4 py-6 md:px-10 md:py-8 max-w-[820px]">
            <BlockNoteView
              editor={editor}
              theme={resolvedTheme === "dark" ? "dark" : "light"}
              className="min-h-[400px]"
              linkToolbar={false}
            >
              <LinkToolbarController linkToolbar={LinkToolbarWithDirty} />
            </BlockNoteView>
          </div>
        </div>

        {/* Properties panel — desktop, resizable */}
        <div
          className="hidden lg:flex flex-shrink-0 relative border-l overflow-y-auto h-full"
          style={{ width: fmWidth }}
        >
          <div
            onMouseDown={(e) => startResizeFm(e, "w")}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-10"
            style={{ touchAction: "none" }}
          />
          <div className="h-full w-full px-4 py-4">
            <p className="mb-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Properties
            </p>
            <FrontmatterForm
              data={frontmatter}
              onChange={(newFm) => {
                setFrontmatter(newFm);
                dirtyRef.current = true;
                setDirty(true);
                scheduleAutoSave();
              }}
            />
          </div>
        </div>
      </div>

      {/* Properties panel — mobile/tablet drawer */}
      {showFm && (
        <div className="lg:hidden border-t bg-muted/20 px-4 py-3 overflow-y-auto max-h-[45vh]">
          <p className="mb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Properties
          </p>
          <FrontmatterForm
            data={frontmatter}
            onChange={(newFm) => {
              setFrontmatter(newFm);
              dirtyRef.current = true;
              setDirty(true);
              scheduleAutoSave();
            }}
          />
        </div>
      )}

      {/* Save as template dialog */}
      <SaveTemplateDialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
        frontmatterYaml={templatePayload.fm}
        body={templatePayload.body}
        onSaved={() => toast.success("Template saved")}
      />
    </div>
  );
}
