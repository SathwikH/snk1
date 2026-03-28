# Implementation Plan: Clarity Enhancements

## Overview

Implement six enhancements to the Clarity AI Cognitive Copilot in dependency order: storage extensions first, then new pipeline stages, then route updates, then server registration, then frontend changes. Each task builds directly on the previous.

## Tasks

- [x] 1. Extend storage layer with `getByIds` and `getInRange`
  - Add `getByIds(ids)` to `clarity-backend/src/storage/memoryStore.js` — filters `records` by matching UUID
  - Add `getInRange(from, to)` to `clarity-backend/src/storage/memoryStore.js` — filters by ISO timestamp range (inclusive)
  - Mirror both methods in `clarity-backend/src/storage/fileStore.js`
  - _Requirements: 2.1, 6.3_

  - [ ]* 1.1 Write unit tests for `getByIds` and `getInRange`
    - Test `getByIds` with known IDs, unknown IDs, and empty array
    - Test `getInRange` with records inside, outside, and on the boundary of the window
    - File: `clarity-backend/tests/unit/storage.test.js`
    - _Requirements: 2.1, 6.3_

- [x] 2. Add `replyGenerator` pipeline stage
  - Create `clarity-backend/src/pipeline/replyGenerator.js`
  - System prompt instructs LLM to return a JSON array of 1–3 strings, each ≤ 20 words
  - Parse response with `JSON.parse`; on failure log a warning and return `{ ...ctx, suggested_replies: [] }`
  - Input: `ctx.normalized_text`, `ctx.emotion`, `ctx.simplified_text`; Output: `{ ...ctx, suggested_replies: string[] }`
  - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

  - [ ]* 2.1 Write property test for reply count bounds (Property 4)
    - **Property 4: Reply count is within bounds**
    - **Validates: Requirements 3.1, 3.4**
    - Use `fc.string({minLength:1})` and `fc.constantFrom(...VALID_EMOTIONS)` with MOCK_LLM
    - File: `clarity-backend/tests/property/replyGenerator.test.js`

  - [ ]* 2.2 Write property test for reply word length (Property 5)
    - **Property 5: Each suggested reply is at most 20 words**
    - **Validates: Requirements 3.3**
    - Same arbitraries as P4; assert every item in `suggested_replies` has ≤ 20 whitespace-split tokens
    - File: `clarity-backend/tests/property/replyGenerator.test.js`

  - [ ]* 2.3 Write unit test for malformed JSON fallback
    - Stub `callLLM` to return `"not json"` and assert `suggested_replies` is `[]` and no error is thrown
    - File: `clarity-backend/tests/unit/llm.test.js`
    - _Requirements: 3.7_

- [x] 3. Update `simplifier` for adaptive grade level
  - Modify `clarity-backend/src/pipeline/simplifier.js` to build the system prompt dynamically from `ctx.simplification_level`
  - When `ctx.simplification_level === 3` use `"grade 3 reading level or below"`, otherwise `"grade 5 reading level or below"`
  - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 3.1 Write property test for simplification level mapping (Property 6)
    - **Property 6: Simplification level maps correctly from user_emotion**
    - **Validates: Requirements 4.2, 4.3, 4.7**
    - Use `fc.option(fc.constantFrom(...VALID_EMOTIONS))` and assert `simplification_level` is `3` for `confused/stressed/anxious`, `5` otherwise
    - File: `clarity-backend/tests/property/simplifier.test.js`

- [x] 4. Update `runPipeline` to wire new stages and options
  - Modify `clarity-backend/src/pipeline/index.js` to accept `options = { user_emotion?, speaker_label? }`
  - Compute `simplification_level`: `3` if `user_emotion` is `confused`, `stressed`, or `anxious`; `5` otherwise
  - Inject `simplification_level` and `speaker_label` into `ctx` before the parallel stage
  - Add `replyGenerator` to the `Promise.all` parallel stage alongside `simplifier`, `explainer`, `emotionDetector`
  - Merge `suggested_replies` from `replyGenerator` result into `ctx`
  - _Requirements: 3.8, 4.2, 4.3, 4.7, 5.2_

- [x] 5. Update `/process` route for new fields
  - Modify `clarity-backend/src/routes/process.js` to read `user_emotion` and `speaker_label` from `req.body`
  - Validate `speaker_label`: if present and length > 50, return 400 `{ error: "speaker_label must not exceed 50 characters" }`
  - Pass `{ user_emotion, speaker_label }` as the second argument to `runPipeline`
  - _Requirements: 4.1, 4.7, 5.1, 5.6, 5.7_

  - [ ]* 5.1 Write property test for speaker label propagation (Property 7)
    - **Property 7: Speaker label is propagated unchanged**
    - **Validates: Requirements 5.2, 5.6**
    - Use `fc.string({maxLength:50})` for label; POST to `/process` with MOCK_LLM and assert stored record has matching `speaker_label`
    - File: `clarity-backend/tests/property/processRoute.test.js`

  - [ ]* 5.2 Write unit tests for `/process` new validations
    - Test `speaker_label` exactly 50 chars → 200; 51 chars → 400
    - Test `user_emotion` absent → grade 5 (check `simplification_level` in stored record)
    - Test unrecognized `user_emotion` → treated as absent, no 400
    - File: `clarity-backend/tests/unit/routes.test.js`
    - _Requirements: 4.7, 5.7_

- [x] 6. Add `summaryGenerator` pipeline stage
  - Create `clarity-backend/src/pipeline/summaryGenerator.js`
  - Compute `dominant_emotion` by frequency count over `records[].emotion`
  - Build LLM prompt from concatenated `original_text` + emotion labels
  - Instruct LLM to return JSON `{ recap: string, dominant_emotion: string, confused_moments: string[] }` (max 5 items)
  - Parse response; throw `PipelineError('Summary_Generator', cause)` on LLM failure
  - _Requirements: 2.2, 2.3, 2.6_

  - [ ]* 6.1 Write property test for summary output structure (Property 2)
    - **Property 2: Summary output has required structure**
    - **Validates: Requirements 2.2**
    - Use `fc.array(fc.record({ original_text: fc.string(), emotion: fc.constantFrom(...VALID_EMOTIONS) }), {minLength:1})`
    - Assert `recap` is non-empty string, `dominant_emotion` is a valid label, `confused_moments.length <= 5`
    - File: `clarity-backend/tests/property/summaryGenerator.test.js`

  - [ ]* 6.2 Write unit test for dominant_emotion frequency calculation
    - Provide a fixture array with known emotion distribution and assert the correct dominant is returned
    - File: `clarity-backend/tests/unit/routes.test.js`
    - _Requirements: 2.2_

- [x] 7. Add `/summary` route
  - Create `clarity-backend/src/routes/summary.js`
  - `POST /summary` reads `interaction_ids` from body; returns 400 if missing or empty array
  - Fetches records via `store.getByIds(interaction_ids)`
  - Calls `summaryGenerator(records)`
  - Saves `{ type: "summary", recap, dominant_emotion, confused_moments }` via `store.save`
  - Returns 201 with saved record; returns 502 on `PipelineError`
  - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 7.1 Write property test for summary stored with type "summary" (Property 3)
    - **Property 3: Summary is stored with type "summary"**
    - **Validates: Requirements 2.4, 2.8**
    - Use `fc.array(fc.record({...}), {minLength:1})` to generate interaction sets; POST to `/summary` and assert saved record has `type === "summary"` and required fields
    - File: `clarity-backend/tests/property/summaryRoute.test.js`

  - [ ]* 7.2 Write unit tests for `/summary` error cases
    - Test empty `interaction_ids` → 400
    - Test missing `interaction_ids` → 400
    - Test LLM failure → 502
    - File: `clarity-backend/tests/unit/routes.test.js`
    - _Requirements: 2.5, 2.6_

- [x] 8. Add `briefingGenerator` pipeline stage
  - Create `clarity-backend/src/pipeline/briefingGenerator.js`
  - Input: `event: { event_id, event_title, event_start }`, `records: InteractionRecord[]`
  - Compute `dominant_emotion` by frequency (default to `"calm"` if records is empty)
  - Call `callLLM` to produce JSON `{ briefing_text, dominant_emotion, suggested_topics: string[] }` (2–4 topics)
  - If records is empty, include a note in the prompt that no prior history exists
  - Echo `event_id`, `event_title`, `event_start` into the returned object
  - Throw `PipelineError('Briefing_Generator', cause)` on LLM failure
  - _Requirements: 6.4, 6.5, 6.8_

  - [ ]* 8.1 Write property test for briefing output structure (Property 9)
    - **Property 9: Briefing output has required structure**
    - **Validates: Requirements 6.4, 6.5, 6.8**
    - Use `fc.record({ event_id: fc.uuid(), event_title: fc.string({minLength:1}), event_start: fc.date().map(d => d.toISOString()) })` and `fc.array(fc.record({...}))`
    - Assert all required fields present, `suggested_topics.length` between 2 and 4
    - File: `clarity-backend/tests/property/briefingGenerator.test.js`

- [x] 9. Add `calendarClient` utility
  - Create `clarity-backend/src/calendar/calendarClient.js`
  - Export `class CalendarError extends Error` and `async function getEvent(eventId)`
  - Read `CALENDAR_PROVIDER` and `CALENDAR_API_KEY` from `process.env`
  - Fetch `${CALENDAR_PROVIDER}/events/${eventId}` with `Authorization: Bearer ${CALENDAR_API_KEY}`
  - Return `{ event_id, event_title, event_start }` on success
  - Throw `CalendarError` on non-OK response or network failure
  - _Requirements: 6.2, 6.7_

  - [ ]* 9.1 Write unit tests for `calendarClient`
    - Test successful fetch returns correct shape
    - Test non-OK response throws `CalendarError`
    - Test missing `CALENDAR_API_KEY` throws `CalendarError`
    - File: `clarity-backend/tests/unit/routes.test.js`
    - _Requirements: 6.2, 6.7_

- [x] 10. Add `/briefing` route
  - Create `clarity-backend/src/routes/briefing.js`
  - `GET /briefing?event_id=` returns 404 if `CALENDAR_ENABLED !== "true"`
  - Returns 400 if `event_id` query param is missing
  - Calls `calendarClient.getEvent(event_id)`; returns 502 on `CalendarError`
  - Calls `store.getInRange(from, to)` where `to = event_start`, `from = event_start - 7 days`
  - Calls `briefingGenerator(event, records)`; returns 502 on `PipelineError`
  - Returns 200 with briefing object
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 10.1 Write property test for briefing memory window (Property 8)
    - **Property 8: Briefing memory window is correct**
    - **Validates: Requirements 6.3**
    - Use `fc.date()` for `event_start`; seed the store with records at known timestamps; assert all records passed to `briefingGenerator` fall within `[event_start - 7 days, event_start]`
    - File: `clarity-backend/tests/property/briefingGenerator.test.js`

  - [ ]* 10.2 Write unit tests for `/briefing` error cases
    - Test `CALENDAR_ENABLED` not set → 404
    - Test `CALENDAR_ENABLED=false` → 404
    - Test calendar provider error → 502
    - Test LLM failure → 502
    - File: `clarity-backend/tests/unit/routes.test.js`
    - _Requirements: 6.6, 6.7_

- [x] 11. Register new routes in server
  - Modify `clarity-backend/src/server.js` to import and mount `summaryRouter` at `/summary` and `briefingRouter` at `/briefing`
  - _Requirements: 2.1, 6.1_

- [x] 12. Extend mock LLM responses
  - Modify `clarity-backend/src/llm.js` `MOCK_RESPONSES` and `callLLM` mock branch to handle three new prompt types:
    - `replyGenerator` prompt → return `'["That makes sense.", "Can you say more?", "I understand."]'`
    - `summaryGenerator` prompt → return `'{"recap":"We discussed a medical topic.","dominant_emotion":"anxious","confused_moments":["The doctor said something complex."]}'`
    - `briefingGenerator` prompt → return `'{"briefing_text":"You have a meeting coming up.","dominant_emotion":"calm","suggested_topics":["Check in","Next steps","Any questions"]}'`
  - Detect each by a unique keyword in the system prompt (e.g., `"suggested replies"`, `"session recap"`, `"pre-call briefing"`)
  - _Requirements: 3.1, 2.2, 6.4_

- [x] 13. Checkpoint — ensure all backend tests pass
  - Run `npm test` in `clarity-backend/` and confirm all unit and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add color flash UI element and logic
  - Add `<div id="colorFlash">` to `clarity-frontend/index.html` as a fixed overlay (z-index between camera and overlay panel)
  - Style it amber `rgba(251,191,36,0.35)` with CSS `transition` for fade-in/fade-out and `pointer-events: auto`
  - In `showOverlay(data)`, compute `confusionSignal` per design: `['confused','stressed'].includes(data.emotion) || (data.explanation && data.explanation !== 'No complex terms found.')`
  - If `confusionSignal && !overlayVisible`, call `showColorFlash()` which fades in and auto-dismisses after 4 seconds
  - Clicking the flash calls `openOverlay()`; suppress flash if overlay is already open
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 14.1 Write property test for confusion signal computation (Property 1)
    - **Property 1: Confusion signal is computed correctly**
    - **Validates: Requirements 1.7**
    - Extract `confusionSignal` logic into a pure function in a shared utility; test with `fc.string()` and `fc.constantFrom(...emotions)`
    - Assert `confusionSignal` is `true` iff emotion is `confused`/`stressed` OR explanation ≠ `"No complex terms found."`
    - File: `clarity-backend/tests/property/confusionSignal.test.js`

- [x] 15. Add suggested reply chips to overlay
  - In `clarity-frontend/index.html`, add a `.ov-card.replies` card to `#overlay` (hidden when empty)
  - In `showOverlay(data)`, populate the card with `data.suggested_replies` as `<button class="reply-chip">` elements
  - Clicking a chip copies the text to clipboard via `navigator.clipboard.writeText`
  - Clear and re-render chips on each new `showOverlay` call
  - _Requirements: 3.4, 3.5, 3.6_

- [x] 16. Add speaker label rendering
  - In `showOverlay(data)`, if `data.speaker_label` is present, render a small `<span class="speaker-label">` above the simplified text card
  - Maintain a `speakerColors` map (up to 6 entries) that assigns a CSS accent color from a predefined palette per label per session
  - Apply the accent color as a `border-left` tint on the simplified card when a speaker label is present
  - In `loadMemory()`, render `item.speaker_label` as a badge alongside the emotion badge and timestamp when present
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 17. Add `user_emotion` and `speaker_label` to `processText`
  - Modify `processText(text)` in `clarity-frontend/index.html` to read `currentBlendedEmotion` and include it as `user_emotion` in the POST body
  - Accept an optional `speakerLabel` parameter and include it as `speaker_label` in the POST body when provided
  - Accumulate `data.id` into a `sessionInteractionIds` array on each successful response
  - _Requirements: 4.5, 4.6, 5.1_

- [x] 18. Add post-call summary trigger
  - Declare `sessionInteractionIds = []` at the top of the script in `clarity-frontend/index.html`; reset it when `toggleMic()` starts a new session
  - In `toggleMic()`, when stopping (autoMode → false), if `sessionInteractionIds.length > 0`, POST to `/summary` with `{ interaction_ids: sessionInteractionIds }`
  - On success, call `loadMemory()` to refresh the timeline; on failure, `console.error` silently
  - In `loadMemory()`, render records with `item.type === "summary"` using a distinct style: `📋 Summary` header and a different background color
  - _Requirements: 2.1, 2.7_

- [x] 19. Add calendar prep button and briefing panel
  - Add `<button id="prepBtn">📅 Prep</button>` to the top bar in `clarity-frontend/index.html`; hide it by default
  - On init, check if `CALENDAR_ENABLED` is available (via a `/health` response field or a `window.CALENDAR_ENABLED` flag); show `#prepBtn` if enabled
  - Set a 60-second polling interval that calls `GET /briefing?event_id={nextEventId}` when a next event ID is known
  - When a meeting is found within 60 minutes, add a `pulsing` CSS animation to `#prepBtn`
  - Clicking `#prepBtn` opens a briefing panel `<div id="briefingPanel">` showing `briefing_text`, `dominant_emotion`, and `suggested_topics` as tappable chips
  - Clicking a suggested topic chip populates the reply chips area (same as `suggested_replies`)
  - On `GET /briefing` failure, show a brief toast error and keep the button clickable
  - _Requirements: 6.9, 6.10_

- [x] 20. Final checkpoint — ensure all tests pass
  - Run `npm test` in `clarity-backend/` and confirm all tests pass end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 13 and 20 ensure incremental validation
- Property tests use **fast-check** with a minimum of 100 iterations each
- All property tests include a comment: `// Feature: clarity-enhancements, Property N: <property_text>`
- Mock LLM (`MOCK_LLM=true`) must be extended before property tests can run reliably
