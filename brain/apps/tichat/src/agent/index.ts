import {
  createAgentSession,
  SessionManager,
  AuthStorage,
  ModelRegistry,
  DefaultResourceLoader,
  getAgentDir,
  type AgentSession,
} from '@mariozechner/pi-coding-agent';

const KB_ROOT = process.env.KB_ROOT || process.cwd();
const AGENT_DIR = getAgentDir();

// Thread-scoped Pi sessions
const sessions = new Map<string, AgentSession>();

async function resolveOllamaCloudModel(modelRegistry: ModelRegistry) {
  // 1. Check if pi-ollama-cloud extension already registered the model
  let model = modelRegistry.find('ollama-cloud', 'kimi-k2.6');
  if (!model) {
    model = modelRegistry.find('ollama-cloud', 'kimi-k2.6:cloud');
  }
  if (model) return model;

  // 2. Fallback: inline model definition (standalone, no extension needed)
  //    This mirrors the config pi-ollama-cloud would register.
  const authStorage = AuthStorage.create();
  const key = (await authStorage.getApiKey('ollama-cloud')) || process.env.OLLAMA_API_KEY;
  if (!key) {
    console.warn('[agent] No ollama-cloud API key found. Inline model unavailable.');
    return undefined;
  }

  return {
    id: 'kimi-k2.6',
    provider: 'ollama-cloud',
    name: 'Kimi K2.6 (Ollama Cloud)',
    api: 'openai-completions',
    baseUrl: 'https://ollama.com/v1',
    reasoning: true,
    input: ['text', 'image'] as ('text' | 'image')[],
    contextWindow: 262144,
    maxTokens: 32768,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

export async function initAgent(): Promise<void> {
  // Ensure OLLAMA_API_KEY env var is set from auth.json
  const authStorage = AuthStorage.create();
  const ollamaKey = await authStorage.getApiKey('ollama-cloud');
  if (ollamaKey && !process.env.OLLAMA_API_KEY) {
    process.env.OLLAMA_API_KEY = ollamaKey;
  }

  console.log(`Pi agent ready — KB_ROOT: ${KB_ROOT}`);
}

export async function runAgent(
  userMessage: string,
  threadTs: string
): Promise<string> {
  let session = sessions.get(threadTs);

  if (!session) {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);

    const model = await resolveOllamaCloudModel(modelRegistry);
    if (!model) {
      const available = await modelRegistry.getAvailable();
      const ollamaModels = available
        .filter((m) => m.provider === 'ollama-cloud')
        .map((m) => m.id);
      throw new Error(
        'Model kimi-k2.6 not available.\n' +
        'Ensure your Ollama Cloud API key is configured in ~/.pi/agent/auth.json ' +
        'under the "ollama-cloud" key, or set the OLLAMA_API_KEY env var.\n' +
        'Available ollama-cloud models: ' +
        (ollamaModels.length ? ollamaModels.join(', ') : 'none')
      );
    }

    const loader = new DefaultResourceLoader({
      cwd: KB_ROOT,
      agentDir: AGENT_DIR,
    });
    await loader.reload();

    const { session: newSession } = await createAgentSession({
      cwd: KB_ROOT,
      agentDir: AGENT_DIR,
      model,
      authStorage,
      modelRegistry,
      sessionManager: SessionManager.inMemory(),
      resourceLoader: loader,
    });

    session = newSession;
    sessions.set(threadTs, session);
  }

  return new Promise((resolve, reject) => {
    let output = '';

    const unsub = session!.subscribe((event) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        output += event.assistantMessageEvent.delta;
      }
    });

    session!
      .prompt(userMessage)
      .then(() => {
        unsub();
        resolve(output.trim() || 'Done.');
      })
      .catch((err) => {
        unsub();
        reject(err);
      });
  });
}

export function isThreadActive(threadTs: string): boolean {
  return sessions.has(threadTs);
}

export function disposeThread(threadTs: string): void {
  const s = sessions.get(threadTs);
  if (s) {
    s.dispose();
    sessions.delete(threadTs);
  }
}
