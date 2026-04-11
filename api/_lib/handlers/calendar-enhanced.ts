import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseISO, eachDayOfInterval, format, isBefore, isAfter, isSameDay } from 'date-fns';
import { verifyAuth, unauthorized } from '../auth';
import { storage, enrichTask } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return handleGet(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;
    const profileIdStr = req.query.profileId as string | undefined;
    const excludeDemo = req.query.excludeDemo === "true";

    if (!startStr || !endStr) {
      return res.status(400).json({ message: "Start and end dates required" });
    }

    const startDate = parseISO(startStr);
    const endDate = parseISO(endStr);
    const today = new Date();
    const profileId = profileIdStr ? parseInt(profileIdStr, 10) : undefined;

    const completionsData = await storage.getCompletionsForCalendar(userId, startDate, endDate, profileId, excludeDemo);

    const allTasks = await storage.getTasks(userId, profileId, excludeDemo);
    const enrichedTasks = await Promise.all(allTasks.map((t) => enrichTask(t, userId)));

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const calendarMap = new Map<string, {
      date: string;
      completions: Array<{ id: number; title: string; completedAt: string; taskId: number }>;
      missed: Array<{ id: number; title: string; dueDate: string }>;
      dueSoon: Array<{ id: number; title: string; dueDate: string }>;
    }>();

    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      calendarMap.set(dateStr, { date: dateStr, completions: [], missed: [], dueSoon: [] });
    });

    completionsData.forEach((dayData: any) => {
      const existing = calendarMap.get(dayData.date);
      if (existing) {
        existing.completions = dayData.tasks.map((t: any) => ({
          id: t.id, title: t.title, completedAt: t.completedAt, taskId: t.taskId || t.id,
        }));
      }
    });

    for (const task of enrichedTasks) {
      if (task.isArchived || task.parentTaskId) continue;

      const nextDueDate = new Date(task.nextDue);
      const nextDueDateStr = format(nextDueDate, "yyyy-MM-dd");

      if (task.status === 'overdue' && isBefore(nextDueDate, today) && !isSameDay(nextDueDate, today)) {
        const entry = calendarMap.get(nextDueDateStr);
        if (entry) {
          entry.missed.push({ id: task.id, title: task.title, dueDate: task.nextDue });
        }
      }

      if ((isAfter(nextDueDate, today) || isSameDay(nextDueDate, today)) && task.status !== 'later') {
        const entry = calendarMap.get(nextDueDateStr);
        if (entry) {
          entry.dueSoon.push({ id: task.id, title: task.title, dueDate: task.nextDue });
        }
      }
    }

    return res.status(200).json(Array.from(calendarMap.values()));
  } catch (error) {
    console.error('Error fetching enhanced calendar:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
