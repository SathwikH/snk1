import { inputProcessor } from './inputProcessor.js';
import { simplifier } from './simplifier.js';
import { explainer } from './explainer.js';
import { emotionDetector } from './emotionDetector.js';
import { replyGenerator } from './replyGenerator.js';
import { taskExtractor } from './taskExtractor.js';
import { responseGenerator } from './responseGenerator.js';

export { PipelineError } from './pipelineError.js';

const STRESSED_EMOTIONS = new Set(['confused', 'stressed', 'anxious']);

export async function runPipeline(text, options = {}) {
  const { user_emotion, speaker_label } = options;

  const simplification_level = STRESSED_EMOTIONS.has(user_emotion) ? 3 : 5;

  let ctx = { raw_text: text, simplification_level };
  if (speaker_label) {
    ctx.speaker_label = speaker_label;
  }

  ctx = inputProcessor(ctx);

  // Run simplifier, explainer, emotion detector, reply generator, and task extractor in parallel
  const [simplifiedCtx, explainedCtx, emotionCtx, replyCtx, taskCtx] = await Promise.all([
    simplifier(ctx),
    explainer(ctx),
    emotionDetector(ctx),
    replyGenerator(ctx),
    taskExtractor(ctx),
  ]);

  // Merge parallel results
  ctx = {
    ...ctx,
    simplified_text: simplifiedCtx.simplified_text,
    explanation: explainedCtx.explanation,
    emotion: emotionCtx.emotion,
    suggested_replies: replyCtx.suggested_replies,
    extracted_task: taskCtx.extracted_task,
  };

  // Response generator needs all outputs
  ctx = await responseGenerator(ctx);
  return ctx;
}
