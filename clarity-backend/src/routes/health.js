import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', calendar_enabled: process.env.CALENDAR_ENABLED === 'true' });
});

export default router;
