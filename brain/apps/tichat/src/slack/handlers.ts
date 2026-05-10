import type { App, SayFn } from '@slack/bolt';
import { runAgent, isThreadActive } from '../agent/index.js';
import { slackify, chunkSlackText, postSlackChunk, SLACK_CHUNK_MAX } from './formatter.js';

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

  const placeholderRes = await say({ text: '_thinking..._', thread_ts: threadTs });
  const placeholderTs = placeholderRes.ts as string;

  try {
    const reply = await runAgent(trimmed, threadTs);
    const formatted = slackify(reply?.trim() || 'No result.');
    const chunks = chunkSlackText(formatted, SLACK_CHUNK_MAX);

    console.log(`[slack] raw=${reply?.length ?? 0} formatted=${formatted.length} chunks=${chunks.length}`);

    // First chunk replaces the placeholder
    await postSlackChunk(client, channelId, chunks[0], { ts: placeholderTs });

    // Remaining chunks go into the thread
    for (let i = 1; i < chunks.length; i++) {
      await postSlackChunk(client, channelId, chunks[i], { threadTs });
    }
  } catch (err: any) {
    const msg = `Error: ${err.message ?? 'Unknown error'}`;
    await client.chat.update({ channel: channelId, ts: placeholderTs, text: msg });
  }
}

export function registerHandlers(app: App): void {
  app.message(async ({ message, say, client }) => {
    const msg = message as any;
    if (msg.subtype) return;

    const isDM = msg.channel_type === 'im';
    const threadTs = msg.thread_ts ?? msg.ts;
    const isActiveThread = msg.thread_ts != null && isThreadActive(msg.thread_ts);

    if (!isDM && !isActiveThread) return;

    await handle({
      text: msg.text ?? '',
      threadTs,
      channelId: msg.channel,
      say,
      client,
    });
  });

  app.event('app_mention', async ({ event, say, client }) => {
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
