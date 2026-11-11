import { ConversationApiError, type HitlApproval } from './api/conversations';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseApproval(source: string): HitlApproval | null {
  try {
    const event: unknown = JSON.parse(source);
    if (!isRecord(event) || event.type !== 'HITL' || !isRecord(event.content)) return null;
    const { executionId, actions } = event.content;
    if (typeof executionId !== 'string' || !executionId || !Array.isArray(actions)) return null;
    if (!actions.every((action) => isRecord(action) && typeof action.name === 'string'
      && isRecord(action.args) && (action.description === undefined || typeof action.description === 'string'))) return null;
    return { executionId, actions };
  } catch {
    return null;
  }
}

// NestJS interleaves plain text with JSON.stringify({type: 'HITL', content}) + '\n'.
// Network chunks can split anywhere, including inside the event prefix or UTF-8.
export function createChatStreamReader(
  onText: (text: string) => void,
  onApproval: (approval: HitlApproval) => void,
  format: 'text' | 'ndjson' = 'text',
) {
  let lineBuffer = '';
  function readEvent(line: string) {
    if (!line.trim()) return;
    const event: unknown = JSON.parse(line);
    if (isRecord(event) && event.type === 'error' && isRecord(event.content)
      && event.content.code === 'HITL_EXPIRED') {
      throw new ConversationApiError('hitlExpired', typeof event.content.message === 'string' ? event.content.message : '');
    }
    if (isRecord(event) && event.type === 'text' && typeof event.content === 'string') {
      onText(event.content);
      return;
    }
    const approval = parseApproval(line);
    if (approval) {
      onApproval(approval);
      return;
    }
    // Error events and invalid envelopes must not resolve an approval as successful.
    throw new Error('Invalid resume stream event');
  }
  let candidate = '';
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let eventStarted = false;
  let skipNewline = false;
  const prefix = '{"type":"HITL",';

  return {
    push(chunk: string) {
      if (format === 'ndjson') {
        lineBuffer += chunk;
        let newline: number;
        while ((newline = lineBuffer.indexOf('\n')) !== -1) {
          readEvent(lineBuffer.slice(0, newline));
          lineBuffer = lineBuffer.slice(newline + 1);
        }
        return;
      }
      let text = '';
      for (const character of chunk) {
        if (skipNewline) {
          skipNewline = false;
          if (character === '\n') continue;
        }
        if (!candidate && character !== '{') {
          text += character;
          continue;
        }
        candidate += character;
        if (!eventStarted) {
          const compact = candidate.replace(/\s/g, '');
          if (!prefix.startsWith(compact)) {
            text += candidate;
            candidate = '';
            continue;
          }
          if (compact !== prefix) continue;
          eventStarted = true;
          depth = 1;
          quoted = false;
          escaped = false;
          continue;
        }
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') quoted = false;
        } else if (character === '"') quoted = true;
        else if (character === '{') depth += 1;
        else if (character === '}') depth -= 1;

        if (depth === 0) {
          const approval = parseApproval(candidate);
          if (approval) {
            if (text) onText(text);
            text = '';
            onApproval(approval);
            skipNewline = true;
          } else text += candidate;
          candidate = '';
          eventStarted = false;
        }
      }
      if (text) onText(text);
    },
    finish() {
      if (format === 'ndjson') {
        readEvent(lineBuffer);
        lineBuffer = '';
        return;
      }
      // Incomplete or malformed candidates remain ordinary text.
      if (candidate) onText(candidate);
      candidate = '';
    },
  };
}
