import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const SYSTEM_PROMPT = `You are an emotion classifier helping autistic people understand social and emotional context in conversations.
Classify the emotional/cognitive state expressed in the following text.
You MUST respond with exactly one word from this list:

POSITIVE emotions:
- happy: pleased, content, feeling good, positive
- excited: enthusiastic, energized, eager, thrilled
- grateful: thankful, appreciative, touched, relieved
- calm: peaceful, relaxed, at ease, composed
- surprised: unexpected good news, amazed, delighted by something unexpected

NEGATIVE emotions:
- confused: uncertainty, repeated questions, fragmented thoughts, "I don't understand"
- stressed: overwhelm, urgency, too much happening at once, pressure
- anxious: worry, fear, nervousness, "what if" thinking
- sad: disappointment, grief, low energy, loneliness, loss
- angry: frustration, irritation, hostility, complaints, raised tone

Respond with ONLY the single word label. No punctuation, no explanation.`;

export const VALID_EMOTIONS = [
  'happy', 'excited', 'grateful', 'calm', 'surprised',
  'confused', 'stressed', 'anxious', 'sad', 'angry'
];

export async function emotionDetector(ctx) {
  try {
    const raw = await callLLM(SYSTEM_PROMPT, ctx.normalized_text);
    const label = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
    const emotion = VALID_EMOTIONS.includes(label) ? label : 'calm';
    if (!VALID_EMOTIONS.includes(label)) {
      console.warn('Emotion_Detector: unexpected label, defaulting to calm:', raw);
    }
    return { ...ctx, emotion };
  } catch (cause) {
    throw new PipelineError('Emotion_Detector', cause);
  }
}
