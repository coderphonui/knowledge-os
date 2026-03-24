import type { App, SayFn } from '@slack/bolt';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { runAgent } from '../agent/index.js';

// Thread-scoped conversation history: thread_ts → messages
const history = new Map<string, BaseMessage[]>();
const MAX_HISTORY = 20;

function getHistory(threadTs: string): BaseMessage[] {
  return history.get(threadTs) ?? [];
}

function updateHistory(threadTs: string, human: string, ai: string): void {
  const h = getHistory(threadTs);
  h.push(new HumanMessage(human), new AIMessage(ai));
  if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
  history.set(threadTs, h);
}

interface HandleCtx {
  text: string;
  threadTs: string;
  channelId: string;
  say: SayFn;
  client: any;
}

async function handle({ text, threadTs, channelId, say, client }: HandleCtx): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Send placeholder while working
  const placeholderRes = await say({ text: '_thinking..._', thread_ts: threadTs });
  const placeholderTs = placeholderRes.ts as string;

  try {
    const reply = await runAgent(trimmed, getHistory(threadTs));
    updateHistory(threadTs, trimmed, reply);

    const safeReply = reply?.trim() || 'No result.';
    await client.chat.update({
      channel: channelId,
      ts: placeholderTs,
      text: safeReply,
    });
  } catch (err: any) {
    const msg = `Error: ${err.message ?? 'Unknown error'}`;
    await client.chat.update({ channel: channelId, ts: placeholderTs, text: msg });
  }
}

export function registerHandlers(app: App): void {
  // Direct messages + follow-up replies in active threads (no mention needed)
  app.message(async ({ message, say, client }) => {
    const msg = message as any;
    if (msg.subtype) return; // skip edits, bot messages

    const isDM = msg.channel_type === 'im';
    const threadTs = msg.thread_ts ?? msg.ts;
    // In a channel thread: respond if the bot has already replied in this thread
    const isActiveThread = msg.thread_ts != null && history.has(msg.thread_ts);

    if (!isDM && !isActiveThread) return;

    await handle({
      text: msg.text ?? '',
      threadTs,
      channelId: msg.channel,
      say,
      client,
    });
  });

  // @tichat mentions in channels — starts a new thread conversation
  app.event('app_mention', async ({ event, say, client }) => {
    // Strip the @mention from the text
    const text = (event.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim();

    await handle({
      text,
      threadTs: event.thread_ts ?? event.ts,
      channelId: event.channel,
      say,
      client,
    });
  });
}
