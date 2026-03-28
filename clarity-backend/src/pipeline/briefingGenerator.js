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

const SYSTEM_PROMPT = `You are a pre-call briefing assistant helping autistic users prepare for upcoming conversations.
Given context about an upcoming event and any prior interaction history, produce a structured briefing.

Rules:
- "briefing_text": a 2-3 sentence summary to help the user feel prepared for the upcoming conversation
- "dominant_emotion": the single most frequent emotion from prior history, from this list: happy, excited, grateful, calm, surprised, confused, stressed, anxious, sad, angry
- "suggested_topics": an array of 2-4 short topic strings the user might want to discuss

Return ONLY a JSON object with exactly these fields:
{ "briefing_text": string, "dominant_emotion": string, "suggested_topics": string[] }

No preamble, no explanation, no markdown fences.`;

/**
 * Generate a pre-call briefing for an upcoming event.
 * @param {{ event_id: string, event_title: string, event_start: string }} event
 * @param {Array} records - InteractionRecord[]
 * @returns {{ event_id, event_title, event_start, briefing_text, dominant_emotion, suggested_topics }}
 * @throws {PipelineError} on LLM failure or JSON parse failure
 */
export async function briefingGenerator(event, records) {
  const dominantEmotion = computeDominantEmotion(records);

  let userContent;
  if (!records || records.length === 0) {
    userContent = `Upcoming event: "${event.event_title}" at ${event.event_start}\n\nNote: No prior interaction history exists for this contact.`;
  } else {
    const excerpts = records.map(r =>
      `[emotion: ${r.emotion}] ${r.original_text}`
    ).join('\n');
    userContent = `Upcoming event: "${event.event_title}" at ${event.event_start}\n\nPrior interaction history:\n${excerpts}\n\nComputed dominant emotion: ${dominantEmotion}`;
  }

  let raw;
  try {
    raw = await callLLM(SYSTEM_PROMPT, userContent);
  } catch (cause) {
    throw new PipelineError('Briefing_Generator', cause);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      event_id: event.event_id,
      event_title: event.event_title,
      event_start: event.event_start,
      briefing_text: parsed.briefing_text,
      dominant_emotion: parsed.dominant_emotion,
      suggested_topics: Array.isArray(parsed.suggested_topics)
        ? parsed.suggested_topics.slice(0, 4)
        : [],
    };
  } catch (cause) {
    throw new PipelineError('Briefing_Generator', cause);
  }
}
