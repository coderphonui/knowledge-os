"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FileText, Folder, X, LayoutTemplate, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KbTemplate } from "@/lib/types";

interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPath: string;
  onCreated: (node: {
    name: string;
    path: string;
    type: "file" | "folder";
  }) => void;
}

const BLANK: KbTemplate = {
  name: "__blank__",
  displayName: "Blank note",
  description: "Start from scratch",
  frontmatterYaml: "",
  body: "",
};

export function NewItemDialog({
  open,
  onOpenChange,
  parentPath,
  onCreated,
}: NewItemDialogProps) {
  const [type, setType] = useState<"file" | "folder">("file");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [templates, setTemplates] = useState<KbTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<KbTemplate>(BLANK);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load templates once on open
  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
    setType("file");
    setSelectedTemplate(BLANK);
    setTimeout(() => inputRef.current?.focus(), 60);

    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: { templates?: KbTemplate[] }) => {
        setTemplates(data.templates ?? []);
      })
      .catch(() => setTemplates([]));
  }, [open]);

  // Close template dropdown on outside click
  useEffect(() => {
    if (!templateMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!templateMenuRef.current?.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [templateMenuOpen]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      setError("Name cannot contain slashes");
      return;
    }

    const finalName =
      type === "file" && !trimmed.endsWith(".md")
        ? `${trimmed}.md`
        : trimmed;
    const fullPath = parentPath ? `${parentPath}/${finalName}` : finalName;

    setCreating(true);
    setError("");

    try {
      if (type === "file") {
        const fm = selectedTemplate.frontmatterYaml;
        const body = selectedTemplate.body;
        const res = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: fullPath, frontmatter: fm, body }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Failed to create");
          return;
        }
        onCreated({ name: finalName, path: fullPath, type: "file" });
      } else {
        // Create folder via a hidden .gitkeep
        const keepPath = parentPath
          ? `${parentPath}/${finalName}/.gitkeep`
          : `${finalName}/.gitkeep`;
        const res = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: keepPath, frontmatter: "", body: "" }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Failed to create folder");
          return;
        }
        onCreated({ name: finalName, path: fullPath, type: "folder" });
      }
      onOpenChange(false);
    } catch {
      setError("Failed to create");
    } finally {
      setCreating(false);
    }
  }, [name, type, parentPath, selectedTemplate, onCreated, onOpenChange]);

  const allTemplates = [BLANK, ...templates];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-[380px] rounded-xl border bg-background p-5 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold">
              New item
            </Dialog.Title>
            <Dialog.Close className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <X size={13} />
            </Dialog.Close>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2 mb-4">
            {(["file", "folder"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] transition-colors",
                  type === t
                    ? "border-foreground/30 bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {t === "file" ? (
                  <FileText size={13} />
                ) : (
                  <Folder size={13} />
                )}
                {t === "file" ? "File" : "Folder"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {/* Template picker (files only) */}
            {type === "file" && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1.5 block">
                  Template
                </label>
                <div className="relative" ref={templateMenuRef}>
                  <button
                    onClick={() => setTemplateMenuOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-[13px] hover:bg-accent/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {selectedTemplate.name === "__blank__" ? (
                        <FileText
                          size={13}
                          className="text-muted-foreground/50 shrink-0"
                        />
                      ) : (
                        <LayoutTemplate
                          size={13}
                          className="text-muted-foreground/50 shrink-0"
                        />
                      )}
                      <span className="truncate">
                        {selectedTemplate.displayName}
                      </span>
                    </span>
                    <ChevronDown
                      size={13}
                      className={cn(
                        "text-muted-foreground/50 shrink-0 transition-transform",
                        templateMenuOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {templateMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 z-30 w-full rounded-lg border bg-popover shadow-lg p-1 max-h-[200px] overflow-y-auto text-[13px]">
                      {allTemplates.map((tmpl) => (
                        <button
                          key={tmpl.name}
                          onClick={() => {
                            setSelectedTemplate(tmpl);
                            setTemplateMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-2 hover:bg-accent transition-colors text-left"
                        >
                          {tmpl.name === "__blank__" ? (
                            <FileText
                              size={13}
                              className="text-muted-foreground/50 shrink-0"
                            />
                          ) : (
                            <LayoutTemplate
                              size={13}
                              className="text-muted-foreground/50 shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {tmpl.displayName}
                            </div>
                            {tmpl.description && (
                              <div className="text-[11px] text-muted-foreground/60 truncate">
                                {tmpl.description}
                              </div>
                            )}
                          </div>
                          {selectedTemplate.name === tmpl.name && (
                            <Check
                              size={12}
                              className="text-foreground/60 shrink-0"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Parent path display */}
            {parentPath && (
              <p className="text-[11px] text-muted-foreground/50 font-mono truncate">
                {parentPath}/
              </p>
            )}

            {/* Name input */}
            <div>
              {!parentPath && (
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1.5 block">
                  Name
                </label>
              )}
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder={
                  type === "file" ? "note-name (auto .md)" : "folder-name"
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-[13px] font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
              />
            </div>

            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-md border px-3 py-1.5 text-[13px] hover:bg-accent transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
