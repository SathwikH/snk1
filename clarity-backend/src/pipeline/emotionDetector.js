import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are an emotion classifier for a cognitive support system.
Classify the emotional/cognitive state of the following text.
You MUST respond with exactly one word: confused, stressed, or neutral.
- confused: repeated questions, uncertainty, fragmented thoughts
- stressed: urgency, distress, overwhelm indicators
- neutral: calm, clear, no distress signals
Respond with ONLY the single word label.`;

const VALID_EMOTIONS = ['confused', 'stressed', 'neutral'];

export async function emotionDetector(ctx) {
  try {
    const raw = await callLLM(SYSTEM_PROMPT, ctx.normalized_text);
    const label = raw.trim().toLowerCase();
    const emotion = VALID_EMOTIONS.includes(label) ? label : 'neutral';
    if (!VALID_EMOTIONS.includes(label)) {
      console.warn('Emotion_Detector: unexpected label, defaulting to neutral:', raw);
    }
    return { ...ctx, emotion };
  } catch (cause) {
    throw new PipelineError('Emotion_Detector', cause);
  }
}
