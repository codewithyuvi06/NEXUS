import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
const credentials = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});
function issueToken(userId: string) {
  return jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}
function publicUser(user: any) {
  return { id: String(user._id), name: user.name, email: user.email, preferences: user.preferences, createdAt: user.createdAt };
}
authRouter.post('/register', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid registration details.', details: parsed.error.flatten() });
  const { email, password, name } = parsed.data;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  return res.status(201).json({ token: issueToken(String(user._id)), user: publicUser(user) });
});
authRouter.post('/login', async (req, res) => {
  const parsed = credentials.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  return res.json({ token: issueToken(String(user._id)), user: publicUser(user) });
});
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: publicUser(user) });
});
