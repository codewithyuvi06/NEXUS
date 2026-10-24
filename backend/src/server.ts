import { connectDB } from './db.js';
import express from 'express';
import cors from 'cors';
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from 'mongoose';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { resourcesRouter } from './routes/resources.js';
import { userRouter } from './routes/user.js';
import { analyticsRouter } from './routes/analytics.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'nexus-api',
    timestamp: new Date().toISOString()
  });
});

app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(
  'MongoDB connection failed:',
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)
);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/analytics', analyticsRouter);
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = config.nodeEnv === 'production' ? 'Internal server error.' : (err instanceof Error ? err.message : 'Unknown error.');
  res.status(500).json({ error: message });
});

export default app;
