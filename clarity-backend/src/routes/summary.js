import { Router } from 'express';
import { summaryGenerator } from '../pipeline/summaryGenerator.js';
import { PipelineError } from '../pipeline/index.js';
import { store } from '../storage/index.js';

const router = Router();

router.post('/', async (req, res) => {
  const { interaction_ids } = req.body ?? {};

  if (!interaction_ids || !Array.isArray(interaction_ids) || interaction_ids.length === 0) {
    return res.status(400).json({ error: 'interaction_ids must be a non-empty array' });
  }

  try {
    const records = await store.getByIds(interaction_ids);
    const summaryResult = await summaryGenerator(records);
    const saved = await store.save({ type: 'summary', ...summaryResult });
    return res.status(201).json(saved);
  } catch (error) {
    if (error instanceof PipelineError) {
      return res.status(502).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

export default router;
