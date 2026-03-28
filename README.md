# Clarity — AI Cognitive Copilot

Built for the CS Careers x AWS Kiro Hackathon.

Clarity is a real-time AI assistant designed to help people with cognitive challenges — including autistic individuals — understand and navigate conversations as they happen. It listens to spoken audio, analyzes the emotional context, simplifies complex language, extracts action items, and generates supportive responses, all in real time.

---

## What it does

- **Live speech processing** — continuously listens via microphone and processes spoken audio automatically after each pause
- **Emotion detection** — classifies the emotional state of the conversation (happy, anxious, stressed, confused, sad, angry, and more)
- **Text simplification** — rewrites complex language at an accessible reading level
- **Task extraction** — identifies any action items or instructions in the conversation
- **Suggested replies** — generates 1–3 short, natural responses the user can use
- **Supportive response** — produces a warm, context-aware message tailored to the detected emotion
- **Session memory** — stores all interactions and supports session summaries and pre-call briefings
- **Face emotion detection** — uses face-api.js via the camera feed to detect facial expressions and blend them with voice emotion

---

## Stack

- **Frontend** — plain HTML/JS with camera feed, face-api.js, and Web Speech API
- **Backend** — Node.js + Express
- **AI** — Gemini 2.5 Flash via the OpenAI-compatible API endpoint
- **Storage** — in-memory (default) or file-based

---

## Running locally

### Backend

```bash
cd clarity-backend
npm install
```

Create a `.env` file:

```env
KIRO_API_KEY=your_gemini_api_key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
LLM_MODEL=gemini-2.5-flash
MOCK_LLM=false
PORT=3000
STORAGE_TYPE=memory
```

```bash
npm start
```

### Frontend

Open `clarity-frontend/index.html` directly in Chrome, or serve it:

```bash
npx serve clarity-frontend
```

Grant camera and microphone permissions when prompted. Click the mic button to start listening.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/process` | Process spoken text through the full pipeline |
| GET | `/memory` | Retrieve all stored interactions |
| POST | `/summary` | Generate a session recap from interaction IDs |
| POST | `/briefing` | Generate a pre-call briefing |

### POST `/process`

```json
{
  "text": "Don't forget to pick up your prescription today",
  "user_emotion": "anxious",
  "speaker_label": "Doctor"
}
```

Response includes: `simplified_text`, `explanation`, `emotion`, `suggested_replies`, `extracted_task`, `response`.

---

## Mock mode

Set `MOCK_LLM=true` in `.env` to run without an API key — useful for testing the pipeline without hitting Gemini.
