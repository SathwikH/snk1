# Implementation Plan: Clarity AI Cognitive Copilot

## Overview

Build the Clarity backend as a Node.js/Express REST API with a multi-stage AI pipeline, dual storage backends, and a full test suite (Jest unit tests + fast-check property tests). Tasks are ordered so each step compiles and runs before the next begins.

## Tasks

- [ ] 1. Project scaffolding
  - Create `clarity-backend/` directory with the folder structure from the design: `src/routes/`, `src/pipeline/`, `src/storage/`, `tests/unit/`, `tests/property/`
  - Create `package.json` with `"type": "module"`, scripts (`start`, `test`), and dependencies: `express`; devDependencies: `jest`, `fast-check`, `supertest`, `@jest/globals`
  - Create `.env` with placeholder values: `OPENAI_API_KEY=`, `STORAGE_TYPE=memory`, `PORT=3000`
  - Create `.gitignore` ignoring `node_modules/`, `memory.json`, `.env`
  - _Requirements: 7.4, 10.1_

- [ ] 2. LLM wrapper (`src/llm.js`)
  - [ ] 2.1 Implement `callLLM(systemPrompt, userContent)` using native `fetch` to POST to `https://api.openai.com/v1/chat/completions` with model `gpt-4o-mini` and temperature `0.3`
    - Read `OPENAI_API_KEY` from `process.env`; throw a typed `LLMError` if the key is missing
    - On HTTP 429, retry once after a 1-second delay; on any other non-2xx, throw `LLMError` with the status and body
    - Return the assistant message content string on success
    - _Requirements: 6.2_
  - [ ]* 2.2 Write unit tests for `llm.js`
    - Mock `fetch` to simulate success, 429-then-success retry, and hard failure
    - Verify `LLMError` is thrown with a descriptive message on failure
    - _Requirements: 6.2_

- [x] 3. Pipeline stage 1 — Input_Processor (`src/pipeline/inputProcessor.js`)
  - [x] 3.1 Implement `inputProcessor(ctx)` as a pure synchronous function
    - Set `ctx.original_text = ctx.raw_text` and `ctx.normalized_text = ctx.raw_text.trim()`
    - Return the enriched context object
    - _Requirements: 1.4_
  - [x]* 3.2 Write unit tests for `inputProcessor.js`
    - Test trimming of leading/trailing whitespace
    - Test that `original_text` preserves the raw value
    - Test that an all-whitespace string produces an empty `normalized_text`
    - _Requirements: 1.4_
  - [ ]* 3.3 Write property test for input normalization (Property 3)
    - `// Feature: clarity-ai-cognitive-copilot, Property 3: Input normalization trims whitespace`
    - For any string with arbitrary leading/trailing whitespace, assert `original_text === raw_text` and `normalized_text === raw_text.trim()`
    - **Property 3: Input normalization trims whitespace**
    - **Validates: Requirements 1.4**

- [x] 4. Pipeline stage 2 — Simplifier (`src/pipeline/simplifier.js`)
  - Implement `simplifier(ctx)` as an async function that calls `callLLM` with the grade-5 simplification system prompt and `ctx.normalized_text`
  - Set `ctx.simplified_text` to the returned string
  - Wrap the `callLLM` call in try/catch and re-throw as `PipelineError('Simplifier', cause)`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.2_

- [x] 5. Pipeline stage 3 — Explainer (`src/pipeline/explainer.js`)
  - Implement `explainer(ctx)` as an async function that calls `callLLM` with the vocabulary-explanation system prompt and `ctx.normalized_text`
  - Set `ctx.explanation` to the returned string
  - Wrap in try/catch and re-throw as `PipelineError('Explainer', cause)`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.2_

- [x] 6. Pipeline stage 4 — Emotion_Detector (`src/pipeline/emotionDetector.js`)
  - Implement `emotionDetector(ctx)` as an async function that calls `callLLM` with the emotion-classification system prompt and `ctx.normalized_text`
  - Lowercase and validate the response against `['confused', 'stressed', 'neutral']`; default to `'neutral'` and log a warning if the LLM returns an unexpected value
  - Set `ctx.emotion` to the validated label
  - Wrap in try/catch and re-throw as `PipelineError('Emotion_Detector', cause)`
  - _Requirements: 4.1, 4.2, 4.3, 6.2_

- [x] 7. Pipeline stage 5 — Response_Generator (`src/pipeline/responseGenerator.js`)
  - Implement `responseGenerator(ctx)` as an async function that calls `callLLM` with the compassionate-support system prompt
  - Build the user content string from `ctx.emotion`, `ctx.normalized_text`, `ctx.simplified_text`, and `ctx.explanation`
  - Set `ctx.response` to the returned string
  - Wrap in try/catch and re-throw as `PipelineError('Response_Generator', cause)`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.2_

- [x] 8. Pipeline orchestrator (`src/pipeline/index.js`)
  - [x] 8.1 Define `PipelineError` class extending `Error` with `stageName` and `cause` properties
    - _Requirements: 6.2_
  - [x] 8.2 Implement `runPipeline(text)` that initializes `ctx = { raw_text: text }`, runs all five stages in order, and returns the final context
    - _Requirements: 6.1, 6.3_
  - [ ]* 8.3 Write property test for emotion enum invariant (Property 4)
    - `// Feature: clarity-ai-cognitive-copilot, Property 4: Emotion label is always a valid enum value`
    - Mock `callLLM` to return valid stage outputs; for any non-empty string ≤ 200 chars, assert `result.emotion` is one of `['confused', 'stressed', 'neutral']`
    - **Property 4: Emotion label is always a valid enum value**
    - **Validates: Requirements 4.1**
  - [ ]* 8.4 Write property test for pipeline stage failure → 502 (Property 5)
    - `// Feature: clarity-ai-cognitive-copilot, Property 5: Pipeline stage failure returns 502 with stage name`
    - For each stage name, mock that stage to throw `LLMError`; assert `runPipeline` throws `PipelineError` with the correct `stageName`
    - **Property 5: Pipeline stage failure returns 502 with stage name**
    - **Validates: Requirements 6.2**
  - [ ]* 8.5 Write property test for valid pipeline response fields (Property 1)
    - `// Feature: clarity-ai-cognitive-copilot, Property 1: Valid /process response contains all required fields`
    - For any non-empty string ≤ 2000 chars with mocked LLM, assert the returned context contains all of: `id`, `original_text`, `simplified_text`, `explanation`, `emotion`, `response`, `timestamp` (fields added after storage)
    - **Property 1: Valid /process response contains all required fields**
    - **Validates: Requirements 1.1, 2.4, 3.4, 4.3, 5.6**

- [ ] 9. Checkpoint — pipeline smoke test
  - Ensure all pipeline unit and property tests pass before proceeding to storage
  - Ask the user if any questions arise.

- [ ] 10. In-memory storage (`src/storage/memoryStore.js`)
  - [ ] 10.1 Implement `createMemoryStore()` factory returning `{ save, getAll, getByDate }`
    - `save(interaction)`: assign `id` via `crypto.randomUUID()`, set `timestamp` to `new Date().toISOString()`, push to internal array, return the stored record
    - `getAll()`: return a copy of the array sorted by `timestamp` descending
    - `getByDate(dateStr)`: filter records whose `timestamp.slice(0, 10) === dateStr`, return sorted descending
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2_
  - [ ]* 10.2 Write property test for storage round-trip (Property 6)
    - `// Feature: clarity-ai-cognitive-copilot, Property 6: Storage round-trip preserves all interaction fields`
    - For any valid interaction record, assert `getAll()` returns a record matching all original fields, with a UUID `id` and valid ISO 8601 `timestamp`
    - **Property 6: Storage round-trip preserves all interaction fields**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  - [ ]* 10.3 Write property test for unique IDs (Property 7)
    - `// Feature: clarity-ai-cognitive-copilot, Property 7: All stored interaction IDs are unique`
    - Save N interactions (N between 2 and 20); assert all `id` values in `getAll()` are distinct
    - **Property 7: All stored interaction IDs are unique**
    - **Validates: Requirements 7.2**
  - [ ]* 10.4 Write property test for newest-first ordering (Property 9)
    - `// Feature: clarity-ai-cognitive-copilot, Property 9: GET /memory returns records sorted newest-first`
    - Save interactions with distinct timestamps; assert `getAll()` returns them in descending timestamp order
    - **Property 9: GET /memory returns records sorted newest-first**
    - **Validates: Requirements 8.1**
  - [ ]* 10.5 Write property test for date filter (Property 10)
    - `// Feature: clarity-ai-cognitive-copilot, Property 10: Date filter returns only matching records`
    - Save interactions across multiple dates; for any valid date string, assert every record returned by `getByDate` has a matching UTC calendar date and no records from other dates appear
    - **Property 10: Date filter returns only matching records**
    - **Validates: Requirements 8.2**

- [ ] 11. File-based storage (`src/storage/fileStore.js`)
  - Implement `createFileStore(filePath = 'memory.json')` with the same `{ save, getAll, getByDate }` interface
  - On `save`: read the file (or start with `[]` if missing), push the new record, write back with `writeFileSync`
  - `getAll` and `getByDate` read the file and apply the same sort/filter logic as the memory store
  - _Requirements: 7.4_

- [ ] 12. Storage factory (`src/storage/index.js`)
  - Implement `getStore()` that reads `process.env.STORAGE_TYPE`; return `createFileStore()` if `'file'`, otherwise `createMemoryStore()`
  - Export a singleton store instance
  - _Requirements: 7.4_
  - [ ]* 12.1 Write property test for storage backend equivalence (Property 8)
    - `// Feature: clarity-ai-cognitive-copilot, Property 8: Both storage backends satisfy the same interface contract`
    - For any sequence of save operations, assert that the memory store and file store return identical records (same fields, same order) from `getAll()` and `getByDate()`
    - **Property 8: Both storage backends produce identical results**
    - **Validates: Requirements 7.4**
  - [ ]* 12.2 Write unit tests for `storage/memoryStore.js` and `storage/fileStore.js`
    - Test `save` assigns `id` and `timestamp`
    - Test `getAll` returns newest-first
    - Test `getByDate` filters correctly and returns `[]` for a date with no records
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_

- [ ] 13. Checkpoint — storage smoke test
  - Ensure all storage unit and property tests pass before proceeding to routes
  - Ask the user if any questions arise.

- [ ] 14. Health route (`src/routes/health.js`)
  - Implement `GET /health` handler returning `{ status: 'ok' }` with HTTP 200
  - _Requirements: 10.1_
  - [ ]* 14.1 Write unit test for `GET /health`
    - Assert HTTP 200 and `{ status: 'ok' }` body
    - _Requirements: 10.1_

- [ ] 15. Process route (`src/routes/process.js`)
  - [ ] 15.1 Implement `POST /process` handler
    - Validate `text` is present and non-empty; return 400 with `{ error: "..." }` if not
    - Validate `text.length <= 2000`; return 400 if exceeded
    - Call `runPipeline(text)`, then `store.save(ctx)` to persist the interaction
    - If `store.save` throws, log the error and continue (do not fail the request)
    - Catch `PipelineError` and return 502 with `{ error: error.message }`; catch all other errors and return 500
    - Return the stored interaction as HTTP 200 JSON
    - _Requirements: 1.1, 1.2, 1.3, 6.2, 7.1, 7.5_
  - [ ]* 15.2 Write unit tests for `POST /process`
    - Test 400 on missing `text`, empty `text`, whitespace-only `text`
    - Test 400 on `text` exceeding 2000 characters
    - Test 502 when `runPipeline` throws `PipelineError`
    - Test 200 with full response body on success
    - Test that storage failure does not prevent 200 response
    - _Requirements: 1.1, 1.2, 1.3, 6.2, 7.5_
  - [ ]* 15.3 Write property test for empty/whitespace rejection (Property 2)
    - `// Feature: clarity-ai-cognitive-copilot, Property 2: Empty or missing text is rejected with 400`
    - For any string that is empty or all-whitespace, assert POST `/process` returns 400 with an `error` field
    - **Property 2: Empty or missing text is rejected with 400**
    - **Validates: Requirements 1.2**

- [ ] 16. Memory route (`src/routes/memory.js`)
  - [ ] 16.1 Implement `GET /memory` handler
    - If `date` query param is present, validate it matches `/^\d{4}-\d{2}-\d{2}$/`; return 400 if not
    - Call `store.getByDate(date)` or `store.getAll()` accordingly and return the array as HTTP 200 JSON
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ] 16.2 Implement `POST /memory` handler
    - Validate all required fields are present (`original_text`, `simplified_text`, `explanation`, `emotion`, `response`); return 400 listing missing fields if not
    - Validate `emotion` is one of `['confused', 'stressed', 'neutral']`; return 400 if not
    - Call `store.save(body)` and return HTTP 201 with the stored interaction
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ]* 16.3 Write unit tests for memory routes
    - Test `GET /memory` returns `[]` with 200 when no records exist
    - Test `GET /memory?date=2024-01-15` returns filtered records
    - Test `GET /memory?date=bad-format` returns 400
    - Test `POST /memory` with valid body returns 201 with `id` and `timestamp`
    - Test `POST /memory` with missing fields returns 400
    - Test `POST /memory` with invalid emotion returns 400
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_
  - [ ]* 16.4 Write property test for invalid date format → 400 (Property 11)
    - `// Feature: clarity-ai-cognitive-copilot, Property 11: Invalid date format returns 400`
    - For any string that does not match `YYYY-MM-DD` (wrong separators, non-numeric, wrong length), assert `GET /memory?date=<value>` returns 400 with an `error` field
    - **Property 11: Invalid date format returns 400**
    - **Validates: Requirements 8.4**
  - [ ]* 16.5 Write property test for all error responses contain error field (Property 12)
    - `// Feature: clarity-ai-cognitive-copilot, Property 12: All error responses are JSON with an error field`
    - For any request that triggers a 4xx or 5xx, assert the response body is valid JSON with a non-empty `error` string field
    - **Property 12: All error responses are JSON with an error field**
    - **Validates: Requirements 10.2**
  - [ ]* 16.6 Write property test for invalid emotion in POST /memory → 400 (Property 13)
    - `// Feature: clarity-ai-cognitive-copilot, Property 13: POST /memory with invalid emotion returns 400`
    - For any string not in `['confused', 'stressed', 'neutral']`, assert `POST /memory` with that `emotion` value returns 400 with an `error` field
    - **Property 13: POST /memory with invalid emotion returns 400**
    - **Validates: Requirements 9.3**
  - [ ]* 16.7 Write property test for missing fields in POST /memory → 400 (Property 14)
    - `// Feature: clarity-ai-cognitive-copilot, Property 14: POST /memory with missing required fields returns 400`
    - For any subset of required fields omitted from the request body, assert `POST /memory` returns 400 with an `error` field
    - **Property 14: POST /memory with missing required fields returns 400**
    - **Validates: Requirements 9.2**

- [ ] 17. Express server (`src/server.js`)
  - Create the Express app, apply `express.json()` body parsing, and attach the request-logging middleware (`res.on('finish', ...)` pattern from the design)
  - Mount routes: `health.js` at `/health`, `process.js` at `/process`, `memory.js` at `/memory`
  - Add a global error handler that returns `{ error: 'Internal server error' }` with HTTP 500 for unhandled exceptions
  - Export the `app` for testing and start listening on `process.env.PORT` (default `3000`) when run directly
  - _Requirements: 10.2, 10.3_
  - [ ]* 17.1 Write unit test for request logger
    - Assert that a request to any route writes `METHOD /path STATUS` to stdout
    - _Requirements: 10.3_

- [x] 18. Checkpoint — full test suite
  - Run `npm test` and ensure all unit tests and property tests pass
  - Ask the user if any questions arise.

- [x] 19. Wire everything together and verify end-to-end
  - [x] 19.1 Confirm `src/routes/process.js` imports `runPipeline` from `src/pipeline/index.js` and `getStore` from `src/storage/index.js`
  - [x] 19.2 Confirm `src/routes/memory.js` imports `getStore` from `src/storage/index.js`
  - [x] 19.3 Confirm `src/server.js` imports and mounts all three route modules
  - [x] 19.4 Add `"start": "node src/server.js"` and `"test": "node --experimental-vm-modules node_modules/.bin/jest"` scripts to `package.json`
  - _Requirements: 6.1, 6.3_

- [x] 20. Final checkpoint — all tests pass
  - Run `npm test` one final time; ensure zero failures across all unit and property test files
  - Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 9, 13, 18, and 20 ensure incremental validation
- Property tests use `numRuns: 100` and are tagged with `// Feature: clarity-ai-cognitive-copilot, Property N: ...`
- Unit tests and property tests are complementary — both are needed for full coverage
- The `PipelineError` class (task 8.1) is the single source of truth for 502 error propagation
