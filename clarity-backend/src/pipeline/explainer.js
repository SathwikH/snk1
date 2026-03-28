import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are a vocabulary assistant helping people with cognitive challenges.
Identify any words or phrases in the following text that might be unfamiliar or hard to understand.
Explain them in plain language at a grade 5 reading level.
Format your response as: "Word/phrase: plain explanation." on separate lines.
If there are no complex terms, respond with: "No complex terms found."
Respond with ONLY the explanations, no preamble.`;

export async function explainer(ctx) {
  try {
    const explanation = await callLLM(SYSTEM_PROMPT, ctx.normalized_text);
    return { ...ctx, explanation };
  } catch (cause) {
    throw new PipelineError('Explainer', cause);
  }
}
