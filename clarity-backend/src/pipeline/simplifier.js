import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

function buildSystemPrompt(simplification_level) {
  const grade = simplification_level === 3 ? 'grade 3 reading level or below' : 'grade 5 reading level or below';
  return `You are a text simplification assistant helping people with cognitive challenges.
Rewrite the following text at a ${grade}.
Preserve all factual content and meaning. Use short sentences and simple words.
If the text is already simple, return it with minimal changes.
Respond with ONLY the simplified text, no preamble.`;
}

export async function simplifier(ctx) {
  try {
    const systemPrompt = buildSystemPrompt(ctx.simplification_level);
    const simplified_text = await callLLM(systemPrompt, ctx.normalized_text);
    return { ...ctx, simplified_text };
  } catch (cause) {
    throw new PipelineError('Simplifier', cause);
  }
}
