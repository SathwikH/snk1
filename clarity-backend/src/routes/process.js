import { Router } from 'express';
import { runPipeline, PipelineError } from '../pipeline/index.js';
import { store } from '../storage/index.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { text, user_emotion, speaker_label } = req.body ?? {};

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'text field is required and must be non-empty' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ error: 'text field must not exceed 2000 characters' });
    }

    if (speaker_label && speaker_label.length > 50) {
      return res.status(400).json({ error: 'speaker_label must not exceed 50 characters' });
    }

    const ctx = await runPipeline(text, { user_emotion, speaker_label });

    let result = ctx;
    try {
      result = await store.save(ctx);
    } catch (saveErr) {
      console.error('store.save failed:', saveErr);
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof PipelineError) {
      return res.status(502).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
