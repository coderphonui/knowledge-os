import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { buildSystemPrompt } from './base-prompt.js';
import { loadSkills } from './skill-loader.js';
import { allTools } from './tools.js';
import * as path from 'path';

const KB_ROOT = process.env.KB_ROOT || process.cwd();
const SKILLS_DIR = path.join(KB_ROOT, 'brain/skills');

let agent: ReturnType<typeof createReactAgent> | null = null;
let systemPrompt: string | null = null;

export async function initAgent(): Promise<void> {
  const model = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  const skills = await loadSkills(SKILLS_DIR);
  systemPrompt = await buildSystemPrompt(KB_ROOT, skills);

  agent = createReactAgent({
    llm: model,
    tools: allTools,
  });

  console.log(`Agent ready — ${skills.length} skills loaded, model: ${process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}`);
}

export async function runAgent(
  userMessage: string,
  history: BaseMessage[] = []
): Promise<string> {
  if (!agent || !systemPrompt) {
    await initAgent();
  }

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt!),
    ...history,
    new HumanMessage(userMessage),
  ];

  try {
    const result = await agent!.invoke(
      { messages },
      { recursionLimit: 25 }
    );

    // Find last AI message with non-empty text content
    const resultMessages = result.messages;

    // Debug: log message types and content shapes
    console.debug('[agent] message trace:');
    for (const msg of resultMessages) {
      const t = (msg as any)._getType?.() ?? msg.constructor?.name;
      const c = msg.content;
      const shape = Array.isArray(c)
        ? `array[${c.length}] types=${(c as any[]).map((x: any) => x.type).join(',')}`
        : typeof c === 'string'
        ? `string(${c.length})`
        : typeof c;
      console.debug(`  [${t}] ${shape}`);
    }

    for (let i = resultMessages.length - 1; i >= 0; i--) {
      const msg = resultMessages[i];
      const msgType = (msg as any)._getType?.() ?? msg.constructor?.name;
      // Only consider AI messages
      if (msgType !== 'ai' && msgType !== 'AIMessage') continue;

      const content = msg.content;
      if (typeof content === 'string' && content.trim()) return content;
      if (Array.isArray(content)) {
        const text = content
          .filter((c: any) => (c.type === 'text' || c.type === 'model') && (c.text || c.parts))
          .map((c: any) => c.text ?? c.parts?.map((p: any) => p.text).join('') ?? '')
          .join('');
        if (text.trim()) return text;
      }
    }
    console.warn('[agent] no parseable AI message found in result');
    return 'No data available.';
  } catch (error: any) {
    console.error('Agent error:', error);
    throw error;
  }
}
