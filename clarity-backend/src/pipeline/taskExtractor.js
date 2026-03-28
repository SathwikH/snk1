import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are a task extraction assistant helping autistic users remember things they need to do.
Given a spoken message, determine if it contains an actionable task or instruction directed at the listener.

Examples of task-containing messages:
- "Get your medications from the hospital" → "Get medications from the hospital"
- "Don't forget to call the doctor tomorrow" → "Call the doctor tomorrow"
- "You need to pick up your prescription" → "Pick up prescription"
- "Make sure you drink water today" → "Drink water today"

Examples of non-task messages:
- "How are you feeling today?" → null
- "The weather is nice" → null
- "I understand what you mean" → null

Rules:
- If the message contains a clear action/task for the listener, return ONLY the short task as a plain string (max 10 words)
- If there is no actionable task, return ONLY the word: null
- No punctuation at the end, no explanation, no preamble`;

export async function taskExtractor(ctx) {
  try {
    const raw = await callLLM(SYSTEM_PROMPT, ctx.normalized_text);
    const trimmed = raw.trim();
    const extracted_task = (trimmed === 'null' || trimmed === '') ? null : trimmed;
    return { ...ctx, extracted_task };
  } catch (cause) {
    // Non-fatal — if task extraction fails, just return null
    console.warn('[taskExtractor] failed, skipping:', cause.message);
    return { ...ctx, extracted_task: null };
  }
}
