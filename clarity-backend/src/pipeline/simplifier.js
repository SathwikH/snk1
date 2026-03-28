import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are a text simplification assistant helping people with cognitive challenges.
Rewrite the following text at a grade 5 reading level or below.
Preserve all factual content and meaning. Use short sentences and simple words.
If the text is already simple, return it with minimal changes.
Respond with ONLY the simplified text, no preamble.`;

export async function simplifier(ctx) {
  try {
    const simplified_text = await callLLM(SYSTEM_PROMPT, ctx.normalized_text);
    return { ...ctx, simplified_text };
  } catch (cause) {
    throw new PipelineError('Simplifier', cause);
  }
}
