import {
  createAgentSession,
  SessionManager,
  AuthStorage,
  ModelRegistry,
  DefaultResourceLoader,
  getAgentDir,
  type AgentSession,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";

const KB_ROOT =
  process.env.KB_ROOT ||
  (await import("path")).resolve(
    (await import("url")).fileURLToPath(import.meta.url),
    "../../../../../.."
  );
const AGENT_DIR = getAgentDir();

// Session store keyed by conversationId (persists across requests in same process)
const sessions = new Map<string, AgentSession>();

async function resolveOllamaCloudModel(modelRegistry: ModelRegistry) {
  let model = modelRegistry.find("ollama-cloud", "kimi-k2.6");
  if (!model) model = modelRegistry.find("ollama-cloud", "kimi-k2.6:cloud");
  if (model) return model;

  const authStorage = AuthStorage.create();
  const key =
    (await authStorage.getApiKey("ollama-cloud")) ||
    process.env.OLLAMA_API_KEY;
  if (!key) return undefined;

  // Mirror what pi-ollama-cloud extension registers
  return {
    id: "kimi-k2.6",
    provider: "ollama-cloud",
    name: "Kimi K2.6 (Ollama Cloud)",
    api: "openai-completions" as const,
    baseUrl: "https://ollama.com/v1",
    reasoning: true,
    input: ["text", "image"] as ("text" | "image")[],
    contextWindow: 262144,
    maxTokens: 32768,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

async function getOrCreateSession(conversationId: string): Promise<AgentSession> {
  const existing = sessions.get(conversationId);
  if (existing) return existing;

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  const model = await resolveOllamaCloudModel(modelRegistry);
  if (!model) {
    throw new Error(
      "Kimi K2.6 model not available. Ensure your Ollama Cloud API key is configured " +
        'in ~/.pi/agent/auth.json under "ollama-cloud", or set OLLAMA_API_KEY.',
    );
  }

  const loader = new DefaultResourceLoader({
    cwd: KB_ROOT,
    agentDir: AGENT_DIR,
  });
  await loader.reload();

  const { session } = await createAgentSession({
    cwd: KB_ROOT,
    agentDir: AGENT_DIR,
    model,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
  });

  sessions.set(conversationId, session);
  return session;
}

function disposeSession(conversationId: string): void {
  const session = sessions.get(conversationId);
  if (session) {
    session.dispose();
    sessions.delete(conversationId);
  }
}

export async function POST(request: Request) {
  let body: { conversationId?: string; message?: string; currentFile?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { conversationId, message, currentFile } = body;

  if (!conversationId || !message?.trim()) {
    return new Response("Missing conversationId or message", { status: 400 });
  }

  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {}
      };

      let unsub: (() => void) | undefined;

      try {
        const session = await getOrCreateSession(conversationId);

        unsub = session.subscribe((event: AgentSessionEvent) => {
          if (
            event.type === "message_update" &&
            "assistantMessageEvent" in event &&
            event.assistantMessageEvent.type === "text_delta"
          ) {
            send({ type: "text_delta", text: event.assistantMessageEvent.delta });
          }

          if (event.type === "tool_execution_start") {
            send({
              type: "tool_start",
              id: event.toolCallId,
              name: event.toolName,
            });
          }

          if (event.type === "tool_execution_end") {
            send({
              type: "tool_done",
              id: event.toolCallId,
              name: event.toolName,
              isError: event.isError,
            });
          }
        });

        // Optionally hint the agent about the open file on first prompt
        const promptText =
          currentFile
            ? `[Currently viewing: \`${currentFile}\`]\n\n${message.trim()}`
            : message.trim();

        await session.prompt(promptText);

        send({ type: "done" });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        unsub?.();
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function DELETE(request: Request) {
  try {
    const { conversationId } = (await request.json()) as {
      conversationId?: string;
    };
    if (conversationId) disposeSession(conversationId);
  } catch {}
  return new Response("ok");
}
