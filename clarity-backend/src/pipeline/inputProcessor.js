/**
 * Stage 1 — Input_Processor
 * Pure synchronous function that normalizes raw input text.
 */

export function inputProcessor(ctx) {
  const original_text = ctx.raw_text;
  const normalized_text = ctx.raw_text.trim();
  return { ...ctx, original_text, normalized_text };
}

export default inputProcessor;
