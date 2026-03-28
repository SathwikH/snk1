import { inputProcessor } from './inputProcessor.js';
import { simplifier } from './simplifier.js';
import { explainer } from './explainer.js';
import { emotionDetector } from './emotionDetector.js';
import { responseGenerator } from './responseGenerator.js';

export { PipelineError } from './pipelineError.js';

export async function runPipeline(text) {
  let ctx = { raw_text: text };
  ctx = inputProcessor(ctx);

  // Run simplifier, explainer, and emotion detector in parallel
  const [simplifiedCtx, explainedCtx, emotionCtx] = await Promise.all([
    simplifier(ctx),
    explainer(ctx),
    emotionDetector(ctx),
  ]);

  // Merge parallel results
  ctx = {
    ...ctx,
    simplified_text: simplifiedCtx.simplified_text,
    explanation: explainedCtx.explanation,
    emotion: emotionCtx.emotion,
  };

  // Response generator needs all three outputs
  ctx = await responseGenerator(ctx);
  return ctx;
}
