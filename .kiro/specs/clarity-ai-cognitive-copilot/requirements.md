# Requirements Document

## Introduction

Clarity is an AI-powered cognitive copilot backend system designed to assist people with cognitive challenges — including dementia, Alzheimer's, autism, and cognitive overload — in better understanding conversations in real time. The system accepts natural language input, simplifies it, detects emotional and cognitive state, generates supportive responses, and stores all interactions in a structured memory timeline for later retrieval.

The backend exposes a REST API that a frontend can call via `fetch()`. The AI pipeline is multi-stage and modular, making it easy to test, extend, and demo within a hackathon timeframe (~10 hours).

---

## Glossary

- **System**: The Clarity backend application as a whole
- **Pipeline**: The multi-stage AI processing sequence applied to each user input
- **Input_Processor**: The first pipeline stage that normalizes and prepares raw user text
- **Simplifier**: The pipeline stage that rewrites text at a lower cognitive complexity level
- **Explainer**: The pipeline stage that identifies and explains complex words or phrases
- **Emotion_Detector**: The pipeline stage that classifies the emotional/cognitive state of the input
- **Response_Generator**: The pipeline stage that produces a supportive, context-aware reply
- **Memory_Store**: The storage layer that persists interaction records
- **Interaction**: A single processed unit containing original text, simplified text, explanation, emotion, response, and timestamp
- **Timeline**: The ordered collection of all stored Interactions
- **Emotion_Label**: One of three classification values: `confused`, `stressed`, or `neutral`
- **LLM**: A large language model API used by pipeline stages to perform AI tasks

---

## Requirements

### Requirement 1: Text Input Processing

**User Story:** As a caregiver or user, I want to submit a piece of text or conversation snippet, so that the system can process it through the AI pipeline and return a structured, understandable response.

#### Acceptance Criteria

1. WHEN a POST request is received at `/process` with a JSON body containing a non-empty `text` field, THE System SHALL pass the text through all pipeline stages in sequence and return a JSON response.
2. IF the `text` field is missing or empty in a POST `/process` request, THEN THE System SHALL return an HTTP 400 status with a descriptive error message.
3. IF the `text` field exceeds 2000 characters, THEN THE System SHALL return an HTTP 400 status with an error message indicating the character limit.
4. THE Input_Processor SHALL normalize the input text by trimming leading and trailing whitespace before passing it to subsequent pipeline stages.

---

### Requirement 2: Text Simplification

**User Story:** As a person with cognitive challenges, I want complex text rewritten in simpler language, so that I can understand conversations without feeling overwhelmed.

#### Acceptance Criteria

1. WHEN the Input_Processor passes normalized text to the Simplifier, THE Simplifier SHALL produce a rewritten version of the text using vocabulary and sentence structures appropriate for a reading level of grade 5 or below.
2. THE Simplifier SHALL preserve the original meaning and factual content of the input text in the simplified output.
3. IF the input text is already at or below grade 5 reading complexity, THE Simplifier SHALL return the text with minimal or no changes.
4. THE System SHALL include the simplified text in the `/process` response under the key `simplified_text`.

---

### Requirement 3: Word and Phrase Explanation

**User Story:** As a person with cognitive challenges, I want complex words or phrases in a conversation explained in plain language, so that I can follow along without confusion.

#### Acceptance Criteria

1. WHEN the Input_Processor passes normalized text to the Explainer, THE Explainer SHALL identify words or phrases that are likely to be unfamiliar or cognitively demanding.
2. THE Explainer SHALL produce a plain-language explanation of the identified terms, written at a grade 5 reading level or below.
3. IF no complex words or phrases are detected in the input, THE Explainer SHALL return a message indicating the text contains no terms requiring explanation.
4. THE System SHALL include the explanation in the `/process` response under the key `explanation`.

---

### Requirement 4: Emotion and Confusion Detection

**User Story:** As a caregiver, I want the system to detect whether the user sounds confused, stressed, or neutral, so that the response can be tailored to their emotional state.

#### Acceptance Criteria

1. WHEN the Input_Processor passes normalized text to the Emotion_Detector, THE Emotion_Detector SHALL classify the text and return exactly one Emotion_Label: `confused`, `stressed`, or `neutral`.
2. THE Emotion_Detector SHALL base its classification on linguistic cues present in the input text, such as repeated questions, fragmented sentences, or distress indicators.
3. THE System SHALL include the emotion classification in the `/process` response under the key `emotion`.

---

### Requirement 5: Supportive Response Generation

**User Story:** As a person with cognitive challenges, I want to receive a kind, supportive reply that acknowledges how I'm feeling, so that I feel understood and not alone.

#### Acceptance Criteria

1. WHEN the Emotion_Detector returns an Emotion_Label, THE Response_Generator SHALL produce a supportive reply that is appropriate to that Emotion_Label.
2. WHILE the Emotion_Label is `confused`, THE Response_Generator SHALL produce a response that reassures the user and offers to clarify further.
3. WHILE the Emotion_Label is `stressed`, THE Response_Generator SHALL produce a response that acknowledges the stress and encourages calm.
4. WHILE the Emotion_Label is `neutral`, THE Response_Generator SHALL produce a response that is warm and affirming.
5. THE Response_Generator SHALL incorporate the simplified text and explanation context when generating the supportive reply.
6. THE System SHALL include the supportive reply in the `/process` response under the key `response`.

---

### Requirement 6: Multi-Stage AI Pipeline Execution

**User Story:** As a developer, I want the AI processing to be broken into discrete, ordered stages, so that each stage can be tested, replaced, or improved independently.

#### Acceptance Criteria

1. THE Pipeline SHALL execute stages in the following fixed order: Input_Processor → Simplifier → Explainer → Emotion_Detector → Response_Generator.
2. WHEN any pipeline stage fails due to an LLM API error, THE System SHALL return an HTTP 502 status with an error message identifying which stage failed.
3. THE System SHALL pass the output of each stage as input context to the next stage in the sequence.
4. THE Pipeline SHALL complete all stages within 30 seconds for inputs up to 2000 characters under normal LLM API response conditions.

---

### Requirement 7: Memory Storage

**User Story:** As a caregiver or user, I want each processed interaction to be saved automatically, so that I can review what was discussed and how the user was feeling over time.

#### Acceptance Criteria

1. WHEN the Pipeline completes successfully for a `/process` request, THE Memory_Store SHALL persist an Interaction record containing: `id`, `original_text`, `simplified_text`, `explanation`, `emotion`, `response`, and `timestamp`.
2. THE Memory_Store SHALL assign a unique `id` to each Interaction at the time of storage.
3. THE Memory_Store SHALL record the `timestamp` as an ISO 8601 UTC datetime string at the time the Interaction is stored.
4. THE System SHALL support both in-memory and JSON file-based storage, selectable via a configuration value.
5. IF the Memory_Store fails to persist an Interaction, THEN THE System SHALL log the error and still return the pipeline response to the caller.

---

### Requirement 8: Memory Timeline Retrieval

**User Story:** As a caregiver, I want to ask "what happened today?" and get a structured summary of recent interactions, so that I can review the user's cognitive and emotional state over time.

#### Acceptance Criteria

1. WHEN a GET request is received at `/memory`, THE System SHALL return a JSON array of all stored Interaction records ordered by `timestamp` descending (most recent first).
2. WHEN a GET request is received at `/memory` with a query parameter `date` in `YYYY-MM-DD` format, THE System SHALL return only Interaction records whose `timestamp` falls within that calendar date in UTC.
3. IF no Interaction records exist, THE System SHALL return an empty JSON array with HTTP 200.
4. IF the `date` query parameter is provided but does not match `YYYY-MM-DD` format, THEN THE System SHALL return an HTTP 400 status with a descriptive error message.

---

### Requirement 9: Manual Memory Entry (Optional)

**User Story:** As a developer or caregiver, I want to manually store an interaction record via the API, so that I can seed test data or log interactions that occurred outside the pipeline.

#### Acceptance Criteria

1. WHERE manual memory entry is enabled, WHEN a POST request is received at `/memory` with a valid Interaction JSON body, THE Memory_Store SHALL persist the record and return HTTP 201 with the stored Interaction including its assigned `id` and `timestamp`.
2. WHERE manual memory entry is enabled, IF the POST `/memory` request body is missing required fields (`original_text`, `simplified_text`, `explanation`, `emotion`, `response`), THEN THE System SHALL return HTTP 400 with a descriptive error message.
3. WHERE manual memory entry is enabled, IF the `emotion` field value is not one of `confused`, `stressed`, or `neutral`, THEN THE System SHALL return HTTP 400 with an error message listing valid Emotion_Label values.

---

### Requirement 10: API Observability and Health

**User Story:** As a developer, I want a health check endpoint and structured error responses, so that I can verify the service is running and debug failures quickly during the hackathon demo.

#### Acceptance Criteria

1. WHEN a GET request is received at `/health`, THE System SHALL return HTTP 200 with a JSON body containing a `status` field set to `"ok"`.
2. THE System SHALL return all error responses as JSON objects containing at least a `error` field with a human-readable message.
3. THE System SHALL log each incoming request method, path, and response status code to standard output.
