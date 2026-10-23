import { Router } from 'express';
import { Resource } from '../models/Resource.js';
import { requireAuth } from '../middleware/auth.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.get('/', async (req, res) => {
  const rows = await Resource.find({ userId: req.userId, archived: false, kind: { $in: ['task', 'focus-session', 'habit', 'goal'] } }).lean() as any[];
  const tasks = rows.filter(x => x.kind === 'task').map(x => x.data);
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const focusSessions = rows.filter(x => x.kind === 'focus-session').map(x => x.data);
  const focusMinutes = focusSessions.reduce((sum, x) => sum + Math.max(0, Number(x.durationMinutes) || 0), 0);
  return res.json({
    tasks: { total: tasks.length, completed, remaining: tasks.length - completed, completionRate: tasks.length ? Math.round(completed / tasks.length * 100) : 0 },
    focus: { sessions: focusSessions.length, totalMinutes: focusMinutes },
    goals: rows.filter(x => x.kind === 'goal').length,
    habits: rows.filter(x => x.kind === 'habit').length
  });
});
