import { inputProcessor } from './inputProcessor.js';
import { simplifier } from './simplifier.js';
import { explainer } from './explainer.js';
import { emotionDetector } from './emotionDetector.js';
import { replyGenerator } from './replyGenerator.js';
import { taskExtractor } from './taskExtractor.js';
import { responseGenerator } from './responseGenerator.js';

export { PipelineError } from './pipelineError.js';

const STRESSED_EMOTIONS = new Set(['confused', 'stressed', 'anxious']);

// Valence map for blending text emotion with face emotion
const EMOTION_VALENCE = {
  excited: 0.9, happy: 0.8, grateful: 0.7, surprised: 0.5, calm: 0.3,
  confused: -0.2, anxious: -0.5, sad: -0.6, stressed: -0.7, angry: -0.9,
};

function blendEmotions(textEmotion, faceEmotion) {
  if (!faceEmotion || !EMOTION_VALENCE[faceEmotion]) return textEmotion;
  if (!textEmotion || !EMOTION_VALENCE[textEmotion]) return textEmotion;
  const avg = (EMOTION_VALENCE[textEmotion] + EMOTION_VALENCE[faceEmotion]) / 2;
  return Object.entries(EMOTION_VALENCE)
    .sort((a, b) => Math.abs(a[1] - avg) - Math.abs(b[1] - avg))[0][0];
}

export async function runPipeline(text, options = {}) {
  const { user_emotion, face_emotion, speaker_label } = options;

  const simplification_level = STRESSED_EMOTIONS.has(user_emotion) ? 3 : 5;

  let ctx = { raw_text: text, simplification_level };
  if (speaker_label) ctx.speaker_label = speaker_label;

  ctx = inputProcessor(ctx);

  // Run all parallel stages
  const [simplifiedCtx, explainedCtx, emotionCtx, replyCtx, taskCtx] = await Promise.all([
    simplifier(ctx),
    explainer(ctx),
    emotionDetector(ctx),
    replyGenerator(ctx),
    taskExtractor(ctx),
  ]);

  // Blend text-detected emotion with face emotion for more accurate stored result
  const blendedEmotion = blendEmotions(emotionCtx.emotion, face_emotion);

  // Merge parallel results
  ctx = {
    ...ctx,
    simplified_text: simplifiedCtx.simplified_text,
    explanation: explainedCtx.explanation,
    emotion: blendedEmotion,
    suggested_replies: replyCtx.suggested_replies,
    extracted_task: taskCtx.extracted_task,
  };

  // Response generator needs all outputs
  ctx = await responseGenerator(ctx);
  return ctx;
}
