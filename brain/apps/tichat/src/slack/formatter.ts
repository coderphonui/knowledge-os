
/**
 * Slack mrkdwn limit: 3000 chars per block/text field is generally safe,
 * but we keep margin for overhead from formatting conversions.
 */
export const SLACK_CHUNK_MAX = 2800;

// Slack mrkdwn does not support standard Markdown syntax fully.
// This converts common Pi/terminal output into Slack-friendly mrkdwn.
export function slackify(text: string): string {
  let s = text;

  // 1. Remove carriage returns
  s = s.replace(/\r/g, '');

  // 2. Collapse 3+ consecutive newlines → 2
  s = s.replace(/\n{3,}/g, '\n\n');

  // 3. Convert markdown links [text](url) → Slack <url|text>
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // 4. Convert **bold** → *bold* (Slack mrkdwn uses single asterisk)
  //    Avoid replacing inside code blocks → we do a naive pass,
  //    then restore code blocks below if needed. Safer: simple regex outside backticks.
  s = replaceOutsideCodeBlocks(s, /\*\*(.+?)\*\*/g, (_, inner) => `*${inner}*`);

  // 5. Convert __bold__ → *bold*
  s = replaceOutsideCodeBlocks(s, /__(.+?)__/g, (_, inner) => `*${inner}*`);

  // 6. Convert headings # ## ### → *Heading* (bold) outside code blocks
  s = replaceOutsideCodeBlocks(s, /^#{1,6}\s+(.+)$/gm, (_, inner) => `*${inner}*`);

  // 7. Horizontal rules --- / *** / ___ → divider placeholder removed later
  s = replaceOutsideCodeBlocks(s, /^(?:\s*[-*_]){3,}\s*$/gm, '');

  // 8. Trim trailing whitespace per line
  s = s.replace(/[ \t]+$/gm, '');

  // 9. Remove any mention of @tichat in output to avoid self-ping loops
  s = s.replace(/@(tichat)\b/gi, '$1');

  return s.trim();
}

/** Replace pattern only outside triple-backtick code blocks. */
function replaceOutsideCodeBlocks(
  text: string,
  pattern: RegExp,
  replacer: string | ((substring: string, ...args: any[]) => string)
): string {
  const parts: string[] = [];
  const BLOCK = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  // Reset pattern g flag
  pattern.lastIndex = 0;

  // We process text by alternating non-code / code blocks.
  // Re-instantiate BLOCK each time.
  while ((m = BLOCK.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    parts.push(before.replace(pattern, replacer as any));
    parts.push(m[0]); // code block untouched
    lastIndex = m.index + m[0].length;
  }
  const tail = text.slice(lastIndex);
  parts.push(tail.replace(pattern, replacer as any));

  return parts.join('');
}

/** Chunk a long Slack text into pieces that stay under the char limit. */
export function chunkSlackText(text: string, maxLen = SLACK_CHUNK_MAX): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt <= 0) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

/** Post a message chunk, with graceful retry if Slack still complains. */
export async function postSlackChunk(
  client: any,
  channelId: string,
  text: string,
  options: { threadTs?: string; ts?: string } = {}
): Promise<void> {
  const base: any = { channel: channelId, text };
  if (options.threadTs) base.thread_ts = options.threadTs;
  if (options.ts) base.ts = options.ts;

  try {
    if (options.ts) {
      await client.chat.update(base);
    } else {
      await client.chat.postMessage(base);
    }
  } catch (err: any) {
    if (err?.data?.error === 'msg_too_long' && text.length > 500) {
      const half = Math.floor(text.length / 2);
      await postSlackChunk(client, channelId, text.slice(0, half), options);
      await postSlackChunk(client, channelId, text.slice(half), { threadTs: options.threadTs });
      return;
    }
    throw err;
  }
}
