import { callLLM } from '../llm.js';
import { PipelineError } from './pipelineError.js';

const VALID_EMOTIONS = ['happy', 'excited', 'grateful', 'calm', 'surprised', 'confused', 'stressed', 'anxious', 'sad', 'angry'];

/**
 * Compute the most frequent emotion in the records array.
 * Defaults to 'calm' if records is empty.
 * @param {Array} records - InteractionRecord[]
 * @returns {string} dominant emotion label
 */
function computeDominantEmotion(records) {
  if (!records || records.length === 0) return 'calm';

  const counts = {};
  for (const record of records) {
    const emotion = record.emotion;
    if (emotion) {
      counts[emotion] = (counts[emotion] || 0) + 1;
    }
  }

  let dominant = 'calm';
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = emotion;
    }
  }

  return dominant;
}

const SYSTEM_PROMPT = `You are a session recap assistant helping autistic users review their conversations.
Given a list of conversation excerpts with emotion labels, produce a structured session recap.

Rules:
- "recap": a 2-4 sentence summary of the session topics and emotional arc
- "dominant_emotion": the single most frequent emotion from this list: happy, excited, grateful, calm, surprised, confused, stressed, anxious, sad, angry
- "confused_moments": an array of up to 5 short excerpts (from the original text) where the user felt confused or stressed; empty array if none

Return ONLY a JSON object with exactly these fields:
{ "recap": string, "dominant_emotion": string, "confused_moments": string[] }

No preamble, no explanation, no markdown fences.`;

/**
 * Generate a session summary from an array of InteractionRecord objects.
 * @param {Array} records - InteractionRecord[]
 * @returns {{ recap: string, dominant_emotion: string, confused_moments: string[] }}
 * @throws {PipelineError} on LLM failure or JSON parse failure
 */
export async function summaryGenerator(records) {
  const dominantEmotion = computeDominantEmotion(records);

  const excerpts = (records || []).map(r =>
    `[emotion: ${r.emotion}] ${r.original_text}`
  ).join('\n');

  const userContent = `Session excerpts:\n${excerpts}\n\nComputed dominant emotion: ${dominantEmotion}`;

  let raw;
  try {
    raw = await callLLM(SYSTEM_PROMPT, userContent);
  } catch (cause) {
    throw new PipelineError('Summary_Generator', cause);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      recap: parsed.recap,
      dominant_emotion: parsed.dominant_emotion,
      confused_moments: Array.isArray(parsed.confused_moments)
        ? parsed.confused_moments.slice(0, 5)
        : [],
    };
  } catch (cause) {
    throw new PipelineError('Summary_Generator', cause);
  }
}
