import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from './auth.js';
import { storage, enrichTask } from './task-utils.js';
import { supabaseAdmin } from './supabase.js';
import { parseISO, eachDayOfInterval, format, isBefore, isAfter, isSameDay } from 'date-fns';

// ---------------------------------------------------------------------------
// auth-user
// ---------------------------------------------------------------------------

export async function authUser(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return res.status(200).json({ id: user.id, email: user.email });
  } else if (req.method === 'PATCH') {
    return authUserHandlePatch(req, res, user.id);
  } else if (req.method === 'DELETE') {
    return authUserHandleDelete(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function authUserHandlePatch(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { firstName, lastName } = req.body;
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { firstName, lastName },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ id: data.user.id, email: data.user.email });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function authUserHandleDelete(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    await storage.deleteAllUserData(userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// calendar-enhanced
// ---------------------------------------------------------------------------

export async function calendarEnhanced(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return calendarEnhancedHandleGet(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function calendarEnhancedHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
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

// ---------------------------------------------------------------------------
// categories-index
// ---------------------------------------------------------------------------

export async function categoriesIndex(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return categoriesIndexHandleGet(req, res, user.id);
  } else if (req.method === 'POST') {
    return categoriesIndexHandlePost(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function categoriesIndexHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { profileId } = req.query;
    const profileIdNum = profileId ? parseInt(profileId as string, 10) : undefined;

    const categories = await storage.getCategories(userId, profileIdNum);
    return res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function categoriesIndexHandlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const category = await storage.createCategory(userId, req.body);
    return res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// categories-id
// ---------------------------------------------------------------------------

export async function categoriesId(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const categoryId = parseInt(req.query.id as string, 10);

  if (isNaN(categoryId)) {
    return res.status(400).json({ error: 'Invalid category ID' });
  }

  try {
    await storage.deleteCategory(categoryId, user.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// clear-data
// ---------------------------------------------------------------------------

export async function clearData(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    await storage.clearUserData(user.id);
    return res.status(200).json({ success: true, message: 'All data cleared' });
  } catch (error) {
    console.error('Error clearing user data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// completions-id
// ---------------------------------------------------------------------------

export async function completionsId(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const completionId = parseInt(req.query.id as string, 10);

  if (isNaN(completionId)) {
    return res.status(400).json({ error: 'Invalid completion ID' });
  }

  try {
    await storage.deleteCompletion(completionId, user.id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting completion:', error);
    if (error.message === 'Completion not found') {
      return res.status(404).json({ message: 'Completion not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ message: 'Access denied' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// completions-calendar
// ---------------------------------------------------------------------------

export async function completionsCalendar(req: VercelRequest, res: VercelResponse) {
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

// ---------------------------------------------------------------------------
// metrics-id
// ---------------------------------------------------------------------------

export async function metricsId(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const metricId = parseInt(req.query.id as string, 10);

  if (isNaN(metricId)) {
    return res.status(400).json({ error: 'Invalid metric ID' });
  }

  try {
    const metric = await storage.getTaskMetric(metricId);
    if (!metric) {
      return res.status(404).json({ message: 'Metric not found' });
    }

    const task = await storage.getTask(metric.taskId);
    if (!task || task.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await storage.deleteTaskMetric(metricId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting metric:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// metrics-id-history
// ---------------------------------------------------------------------------

export async function metricsIdHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const metricId = parseInt(req.query.id as string, 10);

  if (isNaN(metricId)) {
    return res.status(400).json({ error: 'Invalid metric ID' });
  }

  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = await storage.getMetricHistory(metricId, limit);
    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching metric history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-index
// ---------------------------------------------------------------------------

export async function profilesIndex(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return profilesIndexHandleGet(req, res, user.id);
  } else if (req.method === 'POST') {
    return profilesIndexHandlePost(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function profilesIndexHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const profiles = await storage.getProfiles(userId);
    return res.status(200).json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function profilesIndexHandlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const profile = await storage.createProfile(userId, req.body);
    return res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-default
// ---------------------------------------------------------------------------

export async function profilesDefault(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const profile = await storage.getOrCreateDefaultProfile(user.id);
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error getting default profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-demo
// ---------------------------------------------------------------------------

export async function profilesDemo(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const existingProfiles = await storage.getProfiles(user.id);
    const demoProfile = existingProfiles.find(p => p.isDemo);
    if (demoProfile) {
      return res.status(200).json({ success: true, message: 'Demo profile already exists.', profile: demoProfile });
    }

    const profile = await storage.createProfile(user.id, { name: 'Demo', slug: 'demo', isDemo: true });
    await storage.seedDemoProfile(user.id, profile.id);
    return res.status(201).json({ success: true, message: 'Demo profile created with sample data', profile });
  } catch (error) {
    console.error('Error creating demo profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-all-data
// ---------------------------------------------------------------------------

export async function profilesAllData(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    await storage.deleteAllProfilesData(user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all profiles data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-id
// ---------------------------------------------------------------------------

export async function profilesId(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const profileId = parseInt(id as string, 10);

  if (isNaN(profileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  if (req.method === 'PATCH') {
    return profilesIdHandlePatch(req, res, user.id, profileId);
  } else if (req.method === 'DELETE') {
    return profilesIdHandleDelete(req, res, user.id, profileId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function profilesIdHandlePatch(req: VercelRequest, res: VercelResponse, userId: string, profileId: number) {
  try {
    const profile = await storage.updateProfile(profileId, userId, req.body);
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function profilesIdHandleDelete(req: VercelRequest, res: VercelResponse, userId: string, profileId: number) {
  try {
    const allProfiles = await storage.getProfiles(userId);
    if (allProfiles.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last profile' });
    }

    await storage.deleteProfile(profileId, userId);
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-id-data
// ---------------------------------------------------------------------------

export async function profilesIdData(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const profileId = parseInt(id as string, 10);

  if (isNaN(profileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  try {
    await storage.deleteProfileData(profileId, user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting profile data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-id-demo-seed
// ---------------------------------------------------------------------------

export async function profilesIdDemoSeed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const profileId = parseInt(id as string, 10);

  if (isNaN(profileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  try {
    const profiles = await storage.getProfiles(user.id);
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.isDemo) {
      return res.status(400).json({ error: 'Profile is not a demo profile' });
    }

    await storage.deleteProfileData(profileId, user.id);
    await storage.seedDemoProfile(user.id, profileId);
    return res.json({ success: true, message: 'Demo data regenerated successfully', profile });
  } catch (error) {
    console.error('Error regenerating demo data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// profiles-id-import-sourceId
// ---------------------------------------------------------------------------

export async function profilesIdImportSource(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id, sourceId } = req.query;
  const targetProfileId = parseInt(id as string, 10);
  const sourceProfileId = parseInt(sourceId as string, 10);

  if (isNaN(targetProfileId) || isNaN(sourceProfileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  try {
    const sourceProfile = await storage.getProfile(sourceProfileId, user.id);
    if (!sourceProfile) {
      return res.status(404).json({ error: 'Source profile not found' });
    }

    const targetProfile = await storage.getProfile(targetProfileId, user.id);
    if (!targetProfile) {
      return res.status(404).json({ error: 'Target profile not found' });
    }

    const result = await storage.importTasksFromProfile(sourceProfileId, targetProfileId, user.id);
    return res.json(result);
  } catch (error) {
    console.error('Error importing tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// stats-index
// ---------------------------------------------------------------------------

export async function statsIndex(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return statsIndexHandleGet(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function statsIndexHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const excludeDemo = profileId === undefined;

    const completions = await storage.getAllCompletions(userId, profileId, excludeDemo);
    const tasks = await storage.getTasks(userId, profileId, excludeDemo);
    const enrichedTasks = await Promise.all(tasks.map(t => enrichTask(t, userId)));

    const totalCompletions = completions.length;

    const completionsByMonthMap = new Map<string, number>();
    completions.forEach(c => {
      const month = c.completedAt.toISOString().slice(0, 7);
      completionsByMonthMap.set(month, (completionsByMonthMap.get(month) || 0) + 1);
    });

    const completionsByMonth = Array.from(completionsByMonthMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const overdueCount = enrichedTasks.filter(t => t.status === 'overdue' || t.status === 'never_done').length;
    const overdueRate = tasks.length > 0 ? overdueCount / tasks.length : 0;

    return res.status(200).json({ totalCompletions, completionsByMonth, overdueRate });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// streaks-index
// ---------------------------------------------------------------------------

export async function streaksIndex(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return streaksIndexHandleGet(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function streaksIndexHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const excludeDemo = profileId === undefined;
    const allStreaks = await storage.getAllStreaks(userId, profileId, excludeDemo);

    const enrichedStreaks = await Promise.all(allStreaks.map(async (streak) => {
      const task = await storage.getTask(streak.taskId);
      return {
        ...streak,
        taskTitle: task?.title || "Unknown Task"
      };
    }));

    return res.status(200).json(enrichedStreaks);
  } catch (error) {
    console.error('Error fetching streaks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tags-index
// ---------------------------------------------------------------------------

export async function tagsIndex(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return tagsIndexHandleGet(req, res, user.id);
  } else if (req.method === 'POST') {
    return tagsIndexHandlePost(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function tagsIndexHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { profileId } = req.query;
    const profileIdNum = profileId ? parseInt(profileId as string, 10) : undefined;

    const tags = await storage.getTags(userId, profileIdNum);
    return res.status(200).json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function tagsIndexHandlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const tag = await storage.createTag(userId, req.body);
    return res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-index
// ---------------------------------------------------------------------------

export async function tasksIndex(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return tasksIndexHandleGet(req, res, user.id);
  } else if (req.method === 'POST') {
    return tasksIndexHandlePost(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function tasksIndexHandleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { profileId, search, categoryId, tagId, excludeDemo } = req.query;

    const profileIdNum = profileId ? parseInt(profileId as string, 10) : undefined;
    const excludeDemoFlag = excludeDemo === 'true';

    let tasks = await storage.getTasks(userId, profileIdNum, excludeDemoFlag);

    if (search) {
      const searchLower = (search as string).toLowerCase();
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description?.toLowerCase().includes(searchLower))
      );
    }

    if (categoryId) {
      const catId = parseInt(categoryId as string, 10);
      tasks = tasks.filter(task => task.categoryId === catId);
    }

    const enrichedTasks = await Promise.all(
      tasks.map(task => enrichTask(task, userId))
    );

    let filteredTasks = enrichedTasks;
    if (tagId) {
      const tagIdNum = parseInt(tagId as string, 10);
      filteredTasks = enrichedTasks.filter(task =>
        task.tags?.some((t: any) => t.id === tagIdNum)
      );
    }

    filteredTasks.sort((a, b) => b.urgency - a.urgency);

    return res.status(200).json(filteredTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function tasksIndexHandlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { tagIds, metrics, ...taskData } = req.body;

    const task = await storage.createTask(userId, taskData, tagIds, metrics);
    const enrichedTask = await enrichTask(task, userId);

    return res.status(201).json(enrichedTask);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-migrate
// ---------------------------------------------------------------------------

export async function tasksMigrate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const { taskIds, targetProfileId } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds must be a non-empty array' });
    }
    if (!targetProfileId) {
      return res.status(400).json({ error: 'targetProfileId is required' });
    }

    const updatedTasks = await storage.migrateTasksToProfile(taskIds.map(Number), Number(targetProfileId), user.id);
    res.json({ success: true, tasks: updatedTasks });
  } catch (error) {
    console.error('Error migrating tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id
// ---------------------------------------------------------------------------

export async function tasksId(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  if (req.method === 'GET') {
    return tasksIdHandleGet(req, res, user.id, taskId);
  } else if (req.method === 'PUT') {
    return tasksIdHandlePut(req, res, user.id, taskId);
  } else if (req.method === 'DELETE') {
    return tasksIdHandleDelete(req, res, user.id, taskId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function tasksIdHandleGet(req: VercelRequest, res: VercelResponse, userId: string, taskId: number) {
  try {
    const task = await storage.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const enrichedTask = await enrichTask(task, userId);
    return res.status(200).json(enrichedTask);
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function tasksIdHandlePut(req: VercelRequest, res: VercelResponse, userId: string, taskId: number) {
  try {
    const existing = await storage.getTask(taskId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { tagIds, metrics, ...updates } = req.body;

    const task = await storage.updateTask(taskId, updates, tagIds, metrics);
    const enrichedTask = await enrichTask(task, userId);

    return res.status(200).json(enrichedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function tasksIdHandleDelete(req: VercelRequest, res: VercelResponse, userId: string, taskId: number) {
  try {
    const existing = await storage.getTask(taskId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await storage.deleteTask(taskId);
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-archive
// ---------------------------------------------------------------------------

export async function tasksIdArchive(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const archived = await storage.archiveTask(taskId, user.id);
    const enriched = await enrichTask(archived, user.id);
    res.json(enriched);
  } catch (error) {
    console.error('Error archiving task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-cascade
// ---------------------------------------------------------------------------

export async function tasksIdCascade(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    await storage.deleteTaskWithCascade(taskId, user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task with cascade:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-complete
// ---------------------------------------------------------------------------

export async function tasksIdComplete(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const existing = await storage.getTask(taskId);
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { completedAt, notes, metrics, variationId } = req.body;

    const result = await storage.completeTask(
      taskId,
      completedAt ? new Date(completedAt) : undefined,
      notes,
      metrics,
      user.id,
      variationId
    );

    const enrichedTask = await enrichTask(result.task, user.id);

    return res.status(200).json({
      task: enrichedTask,
      completion: result.completion,
      streak: result.streak,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-completions
// ---------------------------------------------------------------------------

export async function tasksIdCompletions(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const task = await storage.getTask(taskId);
    if (!task || task.userId !== user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskCompletions = await storage.getCompletions(taskId);
    res.json(taskCompletions);
  } catch (error) {
    console.error('Error fetching completions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-history
// ---------------------------------------------------------------------------

export async function tasksIdHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const task = await storage.getTask(taskId);
    if (!task || task.userId !== user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskCompletions = await storage.getCompletions(taskId);
    const taskMetrics = await storage.getTaskMetrics(taskId);

    const completionsWithMetrics = await Promise.all(
      taskCompletions.map(async (completion) => {
        const metricValuesData = await storage.getMetricValues(completion.id);
        return { ...completion, metricValues: metricValuesData };
      })
    );

    res.json({
      task: await enrichTask(task, user.id),
      completions: completionsWithMetrics,
      metrics: taskMetrics,
    });
  } catch (error) {
    console.error('Error fetching task history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-metrics
// ---------------------------------------------------------------------------

export async function tasksIdMetrics(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    if (req.method === 'GET') {
      const metricsData = await storage.getTaskMetrics(taskId);
      return res.json(metricsData);
    }

    if (req.method === 'POST') {
      const existing = await storage.getTask(taskId);
      if (!existing || existing.userId !== user.id) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const metric = await storage.createTaskMetric({ ...req.body, taskId });
      return res.status(201).json(metric);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling task metrics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-reassign
// ---------------------------------------------------------------------------

export async function tasksIdReassign(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const { targetProfileId } = req.body;
    if (!targetProfileId) {
      return res.status(400).json({ error: 'targetProfileId is required' });
    }

    const updatedTask = await storage.reassignTaskToProfile(taskId, Number(targetProfileId), user.id);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error reassigning task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// tasks-id-variations
// ---------------------------------------------------------------------------

export async function tasksIdVariations(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    if (req.method === 'GET') {
      const variationsList = await storage.getTaskVariations(taskId);
      return res.json(variationsList);
    }

    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Variation name is required' });
      }

      const task = await storage.getTask(taskId);
      if (!task || task.userId !== user.id) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const variation = await storage.createTaskVariation(taskId, name.trim());
      return res.status(201).json(variation);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling task variations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// variations-id
// ---------------------------------------------------------------------------

export async function variationsId(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const variationId = parseInt(req.query.id as string, 10);

  if (isNaN(variationId)) {
    return res.status(400).json({ error: 'Invalid variation ID' });
  }

  try {
    const allTasks = await storage.getTasks(user.id);
    let foundTask = null;
    for (const task of allTasks) {
      const variations = await storage.getTaskVariations(task.id);
      if (variations.some(v => v.id === variationId)) {
        foundTask = task;
        break;
      }
    }

    if (!foundTask || foundTask.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await storage.deleteTaskVariation(variationId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting variation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
