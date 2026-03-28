import { Router } from 'express';
import { getEvent, CalendarError } from '../calendar/calendarClient.js';
import { briefingGenerator } from '../pipeline/briefingGenerator.js';
import { PipelineError } from '../pipeline/index.js';
import { store } from '../storage/index.js';

const router = Router();

router.get('/', async (req, res) => {
  if (process.env.CALENDAR_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Calendar integration is not enabled' });
  }

  const { event_id } = req.query;
  if (!event_id) {
    return res.status(400).json({ error: 'event_id query parameter is required' });
  }

  let event;
  try {
    event = await getEvent(event_id);
  } catch (err) {
    if (err instanceof CalendarError) {
      return res.status(502).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }

  const to = event.event_start;
  const from = new Date(new Date(event.event_start).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const records = await store.getInRange(from, to);

  let briefing;
  try {
    briefing = await briefingGenerator(event, records);
  } catch (err) {
    if (err instanceof PipelineError) {
      return res.status(502).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json(briefing);
});

export default router;
