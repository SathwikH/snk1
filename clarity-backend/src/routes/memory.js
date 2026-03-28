import { Router } from 'express';
import { store } from '../storage/index.js';

const router = Router();

const REQUIRED_FIELDS = ['original_text', 'simplified_text', 'explanation', 'emotion', 'response'];
const VALID_EMOTIONS = ['neutral', 'excited', 'grateful', 'calm', 'surprised', 'confused', 'stressed', 'anxious', 'sad', 'angry'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res) => {
  const { date } = req.query;

  if (date !== undefined) {
    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const records = await store.getByDate(date);
    return res.status(200).json(records);
  }

  const records = await store.getAll();
  return res.status(200).json(records);
});

router.post('/', async (req, res) => {
  const body = req.body ?? {};

  const missing = REQUIRED_FIELDS.filter(f => !body[f]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  if (!VALID_EMOTIONS.includes(body.emotion)) {
    return res.status(400).json({ error: 'emotion must be one of: confused, stressed, neutral' });
  }

  const saved = await store.save(body);
  return res.status(201).json(saved);
});

router.delete('/:id', (req, res) => {
  store.deleteById(req.params.id);
  return res.status(204).end();
});

router.delete('/', (req, res) => {
  store.clear();
  return res.status(204).end();
});

export default router;
