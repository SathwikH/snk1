import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are a compassionate cognitive support assistant.
You will receive context about a user's message and their emotional state.
Generate a warm, supportive reply (2-4 sentences) appropriate to their emotional state:
- confused: reassure them, offer to clarify, keep it simple
- stressed: acknowledge their stress, encourage calm, be gentle
- neutral: be warm and affirming
Use the simplified text and explanations as context for your reply.
Respond with ONLY the supportive message, no preamble.`;

export async function responseGenerator(ctx) {
  try {
    const userContent = `Emotional state: ${ctx.emotion}
Original message: ${ctx.normalized_text}
Simplified version: ${ctx.simplified_text}
Key explanations: ${ctx.explanation}`;

    const response = await callLLM(SYSTEM_PROMPT, userContent);
    return { ...ctx, response };
  } catch (cause) {
    throw new PipelineError('Response_Generator', cause);
  }
}
