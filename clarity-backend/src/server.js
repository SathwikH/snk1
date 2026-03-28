import express from 'express';
import { fileURLToPath } from 'node:url';
import healthRouter from './routes/health.js';
import processRouter from './routes/process.js';
import memoryRouter from './routes/memory.js';
import summaryRouter from './routes/summary.js';
import briefingRouter from './routes/briefing.js';

export const app = express();

// Allow requests from any origin (needed for local file:// frontend)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

app.use((req, res, next) => {
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode}`));
  next();
});

app.use('/health', healthRouter);
app.use('/process', processRouter);
app.use('/memory', memoryRouter);
app.use('/summary', summaryRouter);
app.use('/briefing', briefingRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Clarity backend running on port ${port}`));
}
