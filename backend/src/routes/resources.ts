import { Router } from 'express';
import { z } from 'zod';
import { Resource } from '../models/Resource.js';
import { requireAuth } from '../middleware/auth.js';

export const resourcesRouter = Router();
resourcesRouter.use(requireAuth);
const kinds = ['task', 'project', 'goal', 'habit', 'note', 'focus-session', 'notification', 'event'] as const;
const kindSchema = z.enum(kinds);
const payloadSchema = z.record(z.unknown());

resourcesRouter.get('/:kind', async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind);
  if (!kind.success) return res.status(404).json({ error: 'Unknown resource type.' });
  const items = await Resource.find({ userId: req.userId, kind: kind.data, archived: false }).sort({ updatedAt: -1 }).lean();
  return res.json({ items: items.map((item: any) => ({ ...item.data, id: String(item._id), createdAt: item.createdAt, updatedAt: item.updatedAt })) });
});
resourcesRouter.post('/:kind', async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind);
  const data = payloadSchema.safeParse(req.body);
  if (!kind.success) return res.status(404).json({ error: 'Unknown resource type.' });
  if (!data.success || Object.keys(data.data).length === 0) return res.status(400).json({ error: 'A non-empty JSON object is required.' });
  const item = await Resource.create({ userId: req.userId, kind: kind.data, data: data.data });
  return res.status(201).json({ item: { ...item.data, id: String(item._id), createdAt: item.createdAt, updatedAt: item.updatedAt } });
});
resourcesRouter.get('/:kind/:id', async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind);
  if (!kind.success) return res.status(404).json({ error: 'Unknown resource type.' });
  const item = await Resource.findOne({ _id: req.params.id, userId: req.userId, kind: kind.data, archived: false }).lean() as any;
  if (!item) return res.status(404).json({ error: 'Resource not found.' });
  return res.json({ item: { ...item.data, id: String(item._id), createdAt: item.createdAt, updatedAt: item.updatedAt } });
});
resourcesRouter.patch('/:kind/:id', async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind);
  const data = payloadSchema.safeParse(req.body);
  if (!kind.success) return res.status(404).json({ error: 'Unknown resource type.' });
  if (!data.success || Object.keys(data.data).length === 0) return res.status(400).json({ error: 'A non-empty JSON object is required.' });
  const item = await Resource.findOne({ _id: req.params.id, userId: req.userId, kind: kind.data, archived: false });
  if (!item) return res.status(404).json({ error: 'Resource not found.' });
  item.data = { ...item.data, ...data.data };
  await item.save();
  return res.json({ item: { ...item.data, id: String(item._id), createdAt: item.createdAt, updatedAt: item.updatedAt } });
});
resourcesRouter.delete('/:kind/:id', async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind);
  if (!kind.success) return res.status(404).json({ error: 'Unknown resource type.' });
  const item = await Resource.findOneAndUpdate({ _id: req.params.id, userId: req.userId, kind: kind.data, archived: false }, { archived: true }, { new: true });
  if (!item) return res.status(404).json({ error: 'Resource not found.' });
  return res.status(204).end();
});
