# Requirements Document

## Introduction

This document defines requirements for six enhancements to the Clarity — AI Cognitive Copilot application. Clarity helps autistic users navigate conversations in real time by simplifying language, detecting emotion, and providing supportive responses. The enhancements add: a real-time color flash with click-to-view overlay, post-call summaries, suggested replies, adaptive simplification based on user stress state, multi-speaker labeling, and optional calendar/meeting prep integration.

The system builds on the existing pipeline: `Input_Processor → [Simplifier, Explainer, Emotion_Detector] → Response_Generator`, a Node.js/Express backend, and a single-page vanilla JS frontend with face-api.js facial expression detection and Web Speech API voice recognition.

---

## Glossary

- **System**: The Clarity AI Cognitive Copilot application (backend + frontend combined).
- **Pipeline**: The existing processing chain: Input_Processor → [Simplifier, Explainer, Emotion_Detector] → Response_Generator.
- **Confusion_Signal**: A boolean flag set to `true` when the detected emotion is `confused` or `stressed`, or when the Explainer returns one or more complex term explanations.
- **Color_Flash**: A brief, semi-transparent colored overlay element rendered on the frontend camera view to signal a Confusion_Signal.
- **Overlay_Panel**: The existing right-side results panel in the frontend displaying supportive response, simplified text, and emotion badge.
- **Simplification_Level**: The target reading grade level used by the Simplifier — either grade 3 (high-stress mode) or grade 5 (normal mode).
- **User_Stress_State**: The cognitive/emotional state of the autistic user as inferred from the blended emotion (voice + face). Considered elevated when the blended emotion is `confused`, `stressed`, or `anxious`.
- **Speaker_Label**: An identifier (e.g., "Speaker 1", "Speaker 2") assigned to a distinct voice in a multi-speaker audio stream.
- **Session**: A continuous period of microphone activity bounded by the user pressing the mic button to start and stop listening.
- **Summary**: A structured text record capturing the key events, emotional arc, and confusion moments of a completed Session.
- **Summary_Generator**: A new pipeline stage that produces a Summary from a set of interaction records belonging to a Session.
- **Suggested_Replies**: An array of 1–3 short, contextually appropriate response options generated for the autistic user to say next.
- **Reply_Generator**: A new pipeline stage that produces Suggested_Replies.
- **Calendar_Integration**: An optional feature that connects to an external calendar API to retrieve upcoming meeting events.
- **Pre_Call_Briefing**: A structured summary prepared before a meeting, containing past interaction summaries, emotional patterns, and suggested topics.
- **Briefing_Generator**: A new pipeline stage that produces a Pre_Call_Briefing.
- **Memory_Store**: The existing storage layer (`src/storage/`) that persists interaction records.
- **Interaction_Record**: A single stored record with fields: `id`, `timestamp`, `original_text`, `simplified_text`, `explanation`, `emotion`, `response`.

---

## Requirements

### Requirement 1: Real-Time Color Flash

**User Story:** As an autistic user, I want a subtle visual cue when the other person says something potentially confusing, so that I can quickly decide whether to open the full explanation overlay.

#### Acceptance Criteria

1. WHEN the Pipeline completes processing and the Confusion_Signal is `true`, THE Frontend SHALL render a Color_Flash on the camera view within 300ms of receiving the API response.
2. THE Color_Flash SHALL use a distinct color (amber/yellow) that differs from the existing overlay panel accent colors to avoid visual confusion with other UI elements.
3. THE Color_Flash SHALL fade out automatically after 4 seconds if the user does not interact with it.
4. WHEN the user clicks or taps the Color_Flash, THE Frontend SHALL open the Overlay_Panel displaying the simplified text, word explanations, and emotion badge for that interaction.
5. WHEN the Pipeline completes processing and the Confusion_Signal is `false`, THE Frontend SHALL NOT render a Color_Flash.
6. WHILE the Overlay_Panel is already open, THE Frontend SHALL NOT render a new Color_Flash for the same interaction.
7. THE Frontend SHALL compute the Confusion_Signal by evaluating whether the emotion returned by the backend is `confused` or `stressed`, or whether the `explanation` field contains at least one term explanation (i.e., is not equal to "No complex terms found.").

---

### Requirement 2: Post-Call Summaries

**User Story:** As an autistic user, I want a brief recap after a conversation ends, so that I can review what was said, the emotional tone, and any moments that were confusing.

#### Acceptance Criteria

1. WHEN the user stops a Session (deactivates the microphone), THE Frontend SHALL send a POST request to `/summary` with the list of interaction record IDs collected during that Session.
2. WHEN the `/summary` endpoint receives a valid request, THE Summary_Generator SHALL produce a Summary containing: a 2–4 sentence recap of topics discussed, the dominant emotion across the Session, and a list of up to 5 moments flagged as confusing (where Confusion_Signal was `true`).
3. THE Summary_Generator SHALL call `callLLM` with the concatenated `original_text` values and emotion labels from the provided interaction records.
4. WHEN the `/summary` endpoint successfully generates a Summary, THE System SHALL save the Summary to the Memory_Store with a `type` field set to `"summary"` and return it in the response body with HTTP 201.
5. IF the Session contains zero interaction records, THEN THE `/summary` endpoint SHALL return HTTP 400 with an error message indicating no interactions were provided.
6. IF the `callLLM` call within Summary_Generator fails, THEN THE `/summary` endpoint SHALL return HTTP 502 with a descriptive error message.
7. WHEN the Memory_Store returns records via `GET /memory`, THE Frontend SHALL render Summary records in the Memory Timeline panel with a distinct visual style (e.g., a "📋 Summary" label) separate from individual Interaction_Records.
8. THE Summary SHALL be stored as a single Memory_Store record with fields: `id`, `timestamp`, `type: "summary"`, `recap`, `dominant_emotion`, `confused_moments` (array of strings).

---

### Requirement 3: Suggested Replies

**User Story:** As an autistic user, I want 1–3 suggested replies based on the conversation context and detected emotion, so that I can respond confidently without having to think of words under pressure.

#### Acceptance Criteria

1. WHEN the Pipeline completes processing, THE Reply_Generator SHALL produce an array of 1–3 Suggested_Replies appropriate to the detected emotion and the content of the original message.
2. THE Reply_Generator SHALL call `callLLM` with the `normalized_text`, `emotion`, and `simplified_text` from the pipeline context.
3. THE Reply_Generator SHALL instruct the LLM to return replies as a JSON array of strings, each reply being no longer than 20 words.
4. WHEN the `/process` endpoint returns a result, THE result SHALL include a `suggested_replies` field containing the array produced by Reply_Generator.
5. WHEN the Overlay_Panel is visible, THE Frontend SHALL display the Suggested_Replies as tappable chips below the supportive response card.
6. WHEN the Confusion_Signal is `true` and the Color_Flash is displayed, THE Frontend SHALL also show the Suggested_Replies in the Color_Flash click-through view (Overlay_Panel).
7. IF the Reply_Generator `callLLM` call returns malformed JSON, THEN THE Reply_Generator SHALL return an empty array and log a warning, so that the rest of the pipeline result is not discarded.
8. THE Reply_Generator SHALL be added to the parallel stage of the Pipeline alongside Simplifier, Explainer, and Emotion_Detector.

---

### Requirement 4: Adaptive Simplification

**User Story:** As an autistic user, I want the simplification level to automatically adjust based on how stressed or confused I am, so that I receive language that matches my current cognitive capacity.

#### Acceptance Criteria

1. WHEN the `/process` endpoint receives a request, THE request body SHALL optionally include a `user_emotion` field containing one of the 10 valid emotion labels representing the autistic user's current state.
2. WHEN `user_emotion` is `confused`, `stressed`, or `anxious`, THE Simplifier SHALL rewrite the text at grade 3 reading level or below.
3. WHEN `user_emotion` is absent or is any emotion other than `confused`, `stressed`, or `anxious`, THE Simplifier SHALL rewrite the text at grade 5 reading level (existing behavior).
4. THE Simplifier SHALL receive the Simplification_Level as part of the pipeline context so that the LLM system prompt is constructed dynamically per request.
5. WHEN the Frontend sends a request to `/process`, THE Frontend SHALL include the current User_Stress_State derived from the blended emotion (voice + face) as the `user_emotion` field.
6. WHEN the blended emotion changes between requests, THE Frontend SHALL update the `user_emotion` value sent in subsequent `/process` requests to reflect the most recent blended emotion.
7. THE `/process` endpoint SHALL accept and pass through an unrecognized `user_emotion` value by treating it as absent (defaulting to grade 5 simplification), rather than returning an error.

---

### Requirement 5: Multi-Speaker Labeling

**User Story:** As an autistic user in a group call, I want each speaker's text to be labeled with a speaker identifier, so that I can follow who said what alongside the simplified text and emotion indicators.

#### Acceptance Criteria

1. WHEN the Frontend sends a request to `/process`, THE request body SHALL optionally include a `speaker_label` field (a non-empty string, e.g., `"Speaker 1"`) identifying the source of the transcribed text.
2. WHEN a `speaker_label` is provided, THE Pipeline SHALL propagate the `speaker_label` through all stages without modification and include it in the stored Interaction_Record.
3. WHEN the Overlay_Panel displays a result that includes a `speaker_label`, THE Frontend SHALL render the Speaker_Label visibly above the simplified text card.
4. WHEN the Memory Timeline panel renders an Interaction_Record that includes a `speaker_label`, THE Frontend SHALL display the Speaker_Label alongside the emotion badge and timestamp.
5. THE Frontend SHALL maintain a registry of up to 6 active Speaker_Labels per Session, assigning a consistent color accent to each label for visual differentiation.
6. WHEN a `speaker_label` is absent from the request, THE System SHALL process the interaction normally and store the record without a `speaker_label` field, maintaining backward compatibility.
7. IF a `speaker_label` value exceeds 50 characters, THEN THE `/process` endpoint SHALL return HTTP 400 with a descriptive error message.

---

### Requirement 6: Calendar / Meeting Prep Integration

**User Story:** As an autistic user, I want to receive a pre-call briefing before an upcoming meeting, so that I can prepare emotionally and know what topics to expect based on past conversations.

#### Acceptance Criteria

1. WHERE Calendar_Integration is enabled (configured via a `CALENDAR_ENABLED` environment variable set to `"true"`), THE System SHALL expose a `GET /briefing` endpoint that accepts an `event_id` query parameter.
2. WHEN `GET /briefing` is called with a valid `event_id`, THE System SHALL retrieve the calendar event details from the configured calendar provider using the `CALENDAR_API_KEY` and `CALENDAR_PROVIDER` environment variables.
3. WHEN the calendar event is retrieved, THE Briefing_Generator SHALL query the Memory_Store for all Interaction_Records and Summaries from the 7 days prior to the event start time.
4. WHEN the Memory_Store returns relevant records, THE Briefing_Generator SHALL call `callLLM` to produce a Pre_Call_Briefing containing: a 2–3 sentence context summary, the most frequent emotion observed in past interactions, and 2–4 suggested conversation topics.
5. WHEN `GET /briefing` returns successfully, THE response SHALL include the fields: `event_id`, `event_title`, `event_start`, `briefing_text`, `dominant_emotion`, `suggested_topics` (array of strings), and HTTP 200.
6. IF `CALENDAR_ENABLED` is not set to `"true"`, THEN THE `GET /briefing` endpoint SHALL return HTTP 404.
7. IF the calendar provider API returns an error, THEN THE `GET /briefing` endpoint SHALL return HTTP 502 with a descriptive error message.
8. IF no Memory_Store records exist within the 7-day window, THEN THE Briefing_Generator SHALL produce a Pre_Call_Briefing based solely on the event title and return it with a note indicating no prior conversation history was found.
9. WHERE Calendar_Integration is enabled, THE Frontend SHALL display a "📅 Prep" button in the top bar that opens a briefing panel when an upcoming meeting is detected within the next 60 minutes.
10. WHEN the Frontend detects an upcoming meeting, THE Frontend SHALL call `GET /briefing?event_id={id}` and render the Pre_Call_Briefing in the briefing panel, including the suggested topics as tappable chips that pre-populate the Suggested_Replies area.
