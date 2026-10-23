import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

export const userRouter = Router();
userRouter.use(requireAuth);
userRouter.get('/me', async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ id: String(user._id), name: user.name, email: user.email, preferences: user.preferences, createdAt: user.createdAt });
});
userRouter.patch('/me', async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(1).max(80).optional(), preferences: z.object({
    theme: z.enum(['light', 'dark']).optional(), weekStartsOn: z.number().int().min(0).max(6).optional(), notificationsEnabled: z.boolean().optional()
  }).optional() }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile update.', details: parsed.error.flatten() });
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (parsed.data.name !== undefined) user.name = parsed.data.name;
  if (parsed.data.preferences) user.set('preferences', { ...user.preferences, ...parsed.data.preferences });
  await user.save();
  return res.json({ id: String(user._id), name: user.name, email: user.email, preferences: user.preferences, updatedAt: user.updatedAt });
});
