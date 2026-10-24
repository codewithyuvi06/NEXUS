import express from 'express';
import cors from 'cors';
import * as helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from 'mongoose';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { resourcesRouter } from './routes/resources.js';
import { userRouter } from './routes/user.js';
import { analyticsRouter } from './routes/analytics.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet.default());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nexus-api', timestamp: new Date().toISOString() }));
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

mongoose.connect(config.mongoUri).then(() => {
  app.listen(config.port, () => console.log(`NEXUS API listening on http://localhost:${config.port}`));
}).catch(error => {
  console.error('Could not connect to MongoDB:', error);
  process.exit(1);
});
