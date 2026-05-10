"use client";

import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LayoutTemplate } from "lucide-react";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frontmatterYaml: string;
  body: string;
  onSaved?: () => void;
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  frontmatterYaml,
  body,
  onSaved,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, frontmatter: frontmatterYaml, body }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save template");
        return;
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-[380px] rounded-xl border bg-background p-5 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent">
              <LayoutTemplate size={14} className="text-foreground/70" />
            </div>
            <Dialog.Title className="text-sm font-semibold">
              Save as template
            </Dialog.Title>
            <Dialog.Close className="ml-auto rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <X size={13} />
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[12px] text-muted-foreground mb-1.5 block">
                Template name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                placeholder="e.g. Meeting Notes, Bug Report…"
                className="w-full rounded-lg border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
              />
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
              Saves this note&apos;s structure and properties as a reusable
              template for new notes.
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-md border px-3 py-1.5 text-[13px] hover:bg-accent transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
