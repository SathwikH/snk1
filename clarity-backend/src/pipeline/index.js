import { inputProcessor } from './inputProcessor.js';
import { simplifier } from './simplifier.js';
import { explainer } from './explainer.js';
import { emotionDetector } from './emotionDetector.js';
import { responseGenerator } from './responseGenerator.js';

export { PipelineError } from './pipelineError.js';

export async function runPipeline(text) {
  let ctx = { raw_text: text };
  ctx = inputProcessor(ctx);
  ctx = await simplifier(ctx);
  ctx = await explainer(ctx);
  ctx = await emotionDetector(ctx);
  ctx = await responseGenerator(ctx);
  return ctx;
}
