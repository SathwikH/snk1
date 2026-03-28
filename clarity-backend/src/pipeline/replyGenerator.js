import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are a communication assistant helping autistic people respond to messages.
Given the emotional context and content of a message, generate 1-3 short suggested replies.

Rules:
- Each reply must be 20 words or fewer
- Replies should be natural, clear, and appropriate to the emotional context
- Return ONLY a JSON array of strings, no preamble or explanation

Example output:
["Thank you for letting me know.", "I understand, that makes sense.", "Could you explain a bit more?"]

Generate suggested replies now.`;

export async function replyGenerator(ctx) {
  let raw;
  try {
    const userContent = `Emotional state: ${ctx.emotion}
Original message: ${ctx.normalized_text}
Simplified version: ${ctx.simplified_text}`;

    raw = await callLLM(SYSTEM_PROMPT, userContent);
  } catch (cause) {
    throw new PipelineError('Reply_Generator', cause);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[replyGenerator] Parsed result is not an array, returning []');
      return { ...ctx, suggested_replies: [] };
    }
    const suggested_replies = parsed
      .filter(item => typeof item === 'string')
      .map(item => item.trim());
    return { ...ctx, suggested_replies };
  } catch (err) {
    console.warn('[replyGenerator] Failed to parse LLM response as JSON, returning []', err.message);
    return { ...ctx, suggested_replies: [] };
  }
}
