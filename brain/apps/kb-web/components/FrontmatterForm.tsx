"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { X, Plus, Tag, Calendar, AlignLeft, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface FrontmatterFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

type FieldType = "text" | "tags" | "date" | "number";

interface Field {
  id: string;
  key: string;
  type: FieldType;
  value: unknown;
}

let _counter = 0;
const uid = () => String(++_counter);

const DATE_KEYS = new Set([
  "date", "created", "created_at", "updated", "updated_at",
  "modified", "published", "due", "deadline", "timestamp",
]);

function inferType(key: string, value: unknown): FieldType {
  const k = key.toLowerCase();
  if (Array.isArray(value)) return "tags";
  if (value instanceof Date) return "date";
  if (["tags", "keywords", "labels", "categories", "topics"].includes(k))
    return "tags";
  // Match exact keys OR date_* prefix OR *_date / *_at suffix
  if (
    DATE_KEYS.has(k) ||
    k.startsWith("date_") ||
    k.endsWith("_date") ||
    k.endsWith("_at")
  )
    return "date";
  if (typeof value === "number") return "number";
  return "text";
}

function dataToFields(data: Record<string, unknown>): Field[] {
  return Object.entries(data).map(([key, value]) => ({
    id: uid(),
    key,
    type: inferType(key, value),
    value,
  }));
}

function fieldsToData(fields: Field[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.key.trim()) continue;
    result[f.key] = f.value;
  }
  return result;
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  // Date objects from YAML parsing
  if (value instanceof Date) return value.toISOString().split("T")[0];
  // Avoid "[object Object]" for unexpected types
  return "";
}

function toTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toStr).filter(Boolean);
  if (typeof value === "string" && value.trim())
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

// ---------- TagsInput ----------

function TagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };

  const removeTag = (i: number) =>
    onChange(tags.filter((_, idx) => idx !== i));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1 min-h-[32px] rounded-md border bg-background px-2 py-1.5 cursor-text focus-within:ring-1 focus-within:ring-ring transition-shadow"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-0.5 rounded bg-secondary text-secondary-foreground px-1.5 py-0.5 text-[11px] font-medium leading-none"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="text-muted-foreground/60 hover:text-foreground transition-colors ml-0.5"
          >
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={tags.length === 0 ? "Add tag, press Enter…" : ""}
        className="flex-1 min-w-[80px] bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/30"
      />
    </div>
  );
}

// ---------- Config ----------

type LucideIcon = React.FC<{ size?: number; className?: string }>;

const ICONS: Record<FieldType, LucideIcon> = {
  text: AlignLeft,
  tags: Tag,
  date: Calendar,
  number: Hash,
};

const PRESETS: Array<{ key: string; type: FieldType; label: string }> = [
  { key: "status", type: "text", label: "Status" },
  { key: "tags", type: "tags", label: "Tags" },
  { key: "date", type: "date", label: "Date" },
  { key: "author", type: "text", label: "Author" },
  { key: "priority", type: "text", label: "Priority" },
  { key: "due", type: "date", label: "Due date" },
];

// ---------- Main component ----------

export default function FrontmatterForm({
  data,
  onChange,
}: FrontmatterFormProps) {
  const [fields, setFields] = useState<Field[]>(() => dataToFields(data));
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ownDataRef = useRef<Record<string, unknown>>(data);

  // Sync when file reloads externally
  useEffect(() => {
    if (data === ownDataRef.current) return;
    ownDataRef.current = data;
    setFields(dataToFields(data));
  }, [data]);

  // Close add-menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const notify = useCallback(
    (next: Field[]) => {
      const result = fieldsToData(next);
      ownDataRef.current = result;
      onChange(result);
    },
    [onChange]
  );

  const update = (id: string, patch: Partial<Field>) => {
    const next = fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
    setFields(next);
    notify(next);
  };

  const remove = (id: string) => {
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    notify(next);
  };

  const addPreset = (key: string, type: FieldType) => {
    if (fields.some((f) => f.key === key)) return;
    const defaultValue: unknown =
      type === "tags"
        ? []
        : type === "date"
        ? new Date().toISOString().split("T")[0]
        : "";
    const next = [...fields, { id: uid(), key, type, value: defaultValue }];
    setFields(next);
    notify(next);
    setShowMenu(false);
  };

  const addCustom = () => {
    setFields((prev) => [...prev, { id: uid(), key: "", type: "text", value: "" }]);
    setShowMenu(false);
  };

  const available = PRESETS.filter((p) => !fields.some((f) => f.key === p.key));

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const Icon = ICONS[field.type];
        return (
          <div key={field.id} className="group space-y-1">
            {/* Key label row */}
            <div className="flex items-center gap-1.5">
              <Icon
                size={10}
                className="text-muted-foreground/40 shrink-0 mt-px"
              />
              <input
                type="text"
                value={field.key}
                onChange={(e) => update(field.id, { key: e.target.value })}
                placeholder="property"
                className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 bg-transparent outline-none placeholder:text-muted-foreground/25 hover:text-foreground focus:text-foreground transition-colors"
              />
              <button
                onClick={() => remove(field.id)}
                className={cn(
                  "opacity-0 group-hover:opacity-100 rounded p-0.5",
                  "text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10",
                  "transition-all duration-150"
                )}
                aria-label="Remove property"
              >
                <X size={10} />
              </button>
            </div>

            {/* Value input */}
            <div className="ml-3.5">
              {field.type === "tags" ? (
                <TagsInput
                  tags={toTags(field.value)}
                  onChange={(tags) => update(field.id, { value: tags })}
                />
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={toStr(field.value)}
                  onChange={(e) =>
                    update(field.id, { value: e.target.value })
                  }
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                />
              ) : field.type === "number" ? (
                <input
                  type="number"
                  value={toStr(field.value)}
                  onChange={(e) =>
                    update(field.id, {
                      value:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <input
                  type="text"
                  value={toStr(field.value)}
                  onChange={(e) =>
                    update(field.id, { value: e.target.value })
                  }
                  placeholder="Empty"
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/25"
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Add property */}
      <div className="relative pt-1" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground/40 hover:text-muted-foreground transition-colors py-0.5"
        >
          <Plus size={12} />
          Add property
        </button>

        {showMenu && (
          <div className="absolute left-0 top-full mt-1 z-30 w-[190px] rounded-lg border bg-popover shadow-lg p-1 text-[12px]">
            {available.map((preset) => {
              const Icon = ICONS[preset.type];
              return (
                <button
                  key={preset.key}
                  onClick={() => addPreset(preset.key, preset.type)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent transition-colors text-foreground/80"
                >
                  <Icon size={12} className="text-muted-foreground/50 shrink-0" />
                  {preset.label}
                </button>
              );
            })}
            {available.length > 0 && (
              <div className="my-1 h-px bg-border mx-1" />
            )}
            <button
              onClick={addCustom}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent transition-colors text-foreground/80"
            >
              <Plus size={12} className="text-muted-foreground/50 shrink-0" />
              Custom property
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
