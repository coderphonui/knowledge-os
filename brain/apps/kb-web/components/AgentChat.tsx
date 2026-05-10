"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BrainCircuit,
  X,
  Trash2,
  Send,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UIMessage, SSEEvent } from "@/lib/chat-types";

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ── Markdown renderer ──────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-[13px] leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-0.5 marker:text-muted-foreground/50">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-0.5 marker:text-muted-foreground/50">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-[14px] font-semibold mb-2 mt-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[13px] font-semibold mb-1.5 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-medium mb-1 mt-2 first:mt-0 text-foreground/80">{children}</h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = !!className;
            if (isBlock) {
              return (
                <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2 text-[12px]">
                  <code className={cn("font-mono", className)} {...props}>{children}</code>
                </pre>
              );
            }
            return (
              <code className="bg-muted rounded px-1 py-0.5 text-[11.5px] font-mono" {...props}>
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground my-2">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-foreground hover:text-foreground/70 transition-colors"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-border my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── Message views ──────────────────────────────────────────────────────────

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: UIMessage }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-5 h-5 rounded-full border bg-background flex items-center justify-center shrink-0 mt-0.5">
        <BrainCircuit size={10} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        {message.streaming ? (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60">
            <Loader2 size={11} className="animate-spin" />
            <span>Thinking…</span>
          </div>
        ) : message.error ? (
          <div className="flex items-center gap-1.5 text-[12px] text-destructive">
            <AlertCircle size={12} />
            <span>{message.error}</span>
          </div>
        ) : message.text ? (
          <MarkdownContent content={message.text} />
        ) : null}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export interface AgentChatProps {
  currentFile?: string;
  onClose: () => void;
}

export function AgentChat({ currentFile, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const conversationIdRef = useRef<string>(genId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const assistantId = genId();

    setMessages((prev) => [
      ...prev,
      { id: genId(), role: "user", text },
      { id: assistantId, role: "assistant", streaming: true },
    ]);

    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // Accumulate the full response in memory — don't stream to UI
    let accumulatedText = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: text,
          currentFile,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;

            if (event.type === "text_delta" && event.text) {
              accumulatedText += event.text;
            }

            if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, text: accumulatedText || undefined }
                    : m,
                ),
              );
            }

            if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, error: event.message ?? "Unknown error" }
                    : m,
                ),
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  error: "Connection failed. Ensure the pi Ollama Cloud key is configured.",
                }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      // Ensure streaming flag is cleared even if done event was missed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.streaming
            ? { ...m, streaming: false, text: accumulatedText || m.text }
            : m,
        ),
      );
    }
  }, [input, isStreaming, currentFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
  };

  const clearConversation = useCallback(async () => {
    abortRef.current?.abort();
    fetch("/api/chat", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversationIdRef.current }),
    }).catch(() => {});
    conversationIdRef.current = genId();
    setMessages([]);
    setIsStreaming(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const fileLabel = currentFile?.split("/").pop()?.replace(/\.md$/, "");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit size={14} className="text-muted-foreground/70" />
          <span className="text-[13px] font-semibold">Knowledge Agent</span>
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              title="Clear conversation"
              className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close agent"
            className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Context badge */}
      {fileLabel && (
        <div className="px-4 py-1.5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <FileText size={10} className="shrink-0" />
            <span className="truncate">{fileLabel}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={(s) => setInput(s)} />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserMessage key={msg.id} text={msg.text ?? ""} />
              ) : (
                <AssistantMessage key={msg.id} message={msg} />
              ),
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            rows={1}
            disabled={isStreaming}
            className={cn(
              "w-full resize-none rounded-md border bg-background px-3 py-2 text-[13px] leading-relaxed",
              "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              "min-h-[38px] max-h-[128px]",
              isStreaming && "opacity-60 cursor-not-allowed",
            )}
            style={{ height: "38px" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] text-muted-foreground/40 select-none">
              ↵ send · ⇧↵ newline · ⌘⇧A toggle
            </span>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                input.trim() && !isStreaming
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              {isStreaming ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const suggestions = [
    "What topics have I been researching lately?",
    "Summarise my active projects",
    "Find notes related to React or frontend",
    "Create a journal entry for today",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-8 select-none">
      <div className="w-9 h-9 rounded-full border flex items-center justify-center mb-4 text-muted-foreground/40">
        <BrainCircuit size={16} />
      </div>
      <p className="text-[13px] font-medium text-foreground/70 mb-1 text-center">
        Knowledge Agent
      </p>
      <p className="text-[12px] text-muted-foreground/50 text-center max-w-[200px] leading-relaxed mb-6">
        Powered by pi · Kimi K2.6. Search, create, and synthesise notes from your knowledge base.
      </p>
      <div className="w-full space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="w-full text-left rounded-md border px-3 py-2 text-[12px] text-muted-foreground/70 hover:bg-accent hover:text-foreground transition-colors leading-relaxed"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
