import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';
import { parseISO } from 'date-fns';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    if (!startStr || !endStr) {
      return res.status(400).json({ message: 'Start and end dates required' });
    }

    const startDate = parseISO(startStr);
    const endDate = parseISO(endStr);
    const calendarData = await storage.getCompletionsForCalendar(user.id, startDate, endDate);
    return res.status(200).json(calendarData);
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
