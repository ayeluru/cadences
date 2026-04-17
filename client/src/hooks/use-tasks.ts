import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { InsertTask, TaskWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useProfileContext } from "@/contexts/ProfileContext";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";

export function useTasks(filters?: { search?: string; categoryId?: number; tagId?: number }) {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;

  // Normalize filters so {categoryId: undefined} and undefined produce the same key
  const activeFilters: Record<string, string | number> = {};
  if (filters?.search) activeFilters.search = filters.search;
  if (filters?.categoryId) activeFilters.categoryId = filters.categoryId;
  if (filters?.tagId) activeFilters.tagId = filters.tagId;
  const filterKey = Object.keys(activeFilters).length > 0 ? activeFilters : undefined;

  return useQuery({
    queryKey: [api.tasks.list.path, isAggregatedView ? "all" : profileId, filterKey],
    queryFn: async () => {
      const url = new URL(api.tasks.list.path, window.location.origin);
      if (profileId) url.searchParams.append("profileId", profileId.toString());
      if (filters?.search) url.searchParams.append("search", filters.search);
      if (filters?.categoryId) url.searchParams.append("categoryId", filters.categoryId.toString());
      if (filters?.tagId) url.searchParams.append("tagId", filters.tagId.toString());

      const headers = await getAuthHeaders();
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return api.tasks.list.responses[200].parse(await res.json());
    },
    enabled: isAggregatedView || !!profileId,
  });
}

export function useTask(id: number) {
  return useQuery({
    queryKey: [api.tasks.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.tasks.get.path, { id });
      const headers = await getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch task");
      return api.tasks.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentProfile } = useProfileContext();

  return useMutation({
    mutationFn: async (data: Omit<InsertTask, 'profileId'> & { tagIds?: number[]; profileId?: number | null }) => {
      const profileId = data.profileId ?? currentProfile?.id;
      if (!profileId) throw new Error("No profile selected");

      const res = await apiRequest(api.tasks.create.method, api.tasks.create.path, { ...data, profileId });
      return api.tasks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({ title: "Task created", description: "Your new maintenance task is ready." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertTask> & { tagIds?: number[] }) => {
      const url = buildUrl(api.tasks.update.path, { id });
      const res = await apiRequest(api.tasks.update.method, url, updates);
      return api.tasks.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({ title: "Task updated", description: "Changes saved successfully." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tasks.delete.path, { id });
      await apiRequest(api.tasks.delete.method, url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({ title: "Task deleted", description: "Task removed from your list." });
    },
  });
}

export function useDeleteTaskWithCascade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/tasks/${id}/cascade`);
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [api.tasks.list.path] });
      const previous = queryClient.getQueriesData<TaskWithDetails[]>({ queryKey: [api.tasks.list.path] });
      queryClient.setQueriesData<TaskWithDetails[]>({ queryKey: [api.tasks.list.path] }, (old) =>
        Array.isArray(old) ? old.filter(t => t.id !== id && t.parentTaskId !== id) : old
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions"] });
    },
    onSuccess: () => {
      toast({ title: "Task deleted", description: "Task and all its history have been permanently removed." });
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/archive`);
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [api.tasks.list.path] });
      const previous = queryClient.getQueriesData<TaskWithDetails[]>({ queryKey: [api.tasks.list.path] });
      queryClient.setQueriesData<TaskWithDetails[]>({ queryKey: [api.tasks.list.path] }, (old) =>
        Array.isArray(old) ? old.filter(t => t.id !== id) : old
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
    },
    onSuccess: () => {
      toast({ title: "Task ended", description: "Task will no longer recur. History is preserved." });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
      completedAt,
      metrics,
      variationId
    }: {
      id: number;
      notes?: string;
      completedAt?: string;
      metrics?: { metricId: number; value: number | string }[];
      variationId?: number;
    }) => {
      const url = buildUrl(api.tasks.complete.path, { id });
      const res = await apiRequest(api.tasks.complete.method, url, { notes, completedAt, metrics, variationId });
      return res.json();
    },
    onMutate: async ({ id, completedAt }) => {
      await queryClient.cancelQueries({ queryKey: [api.tasks.list.path] });
      const previous = queryClient.getQueriesData<TaskWithDetails[]>({ queryKey: [api.tasks.list.path] });
      const nowDate = completedAt ? new Date(completedAt) : new Date();
      queryClient.setQueriesData<TaskWithDetails[]>({ queryKey: [api.tasks.list.path] }, (old) =>
        Array.isArray(old) ? old.map((t): TaskWithDetails => {
          if (t.id !== id) return t;
          const isFrequency = t.taskType === 'frequency';
          const newCompletionsThisPeriod = (t.completionsThisPeriod || 0) + 1;
          const targetMet = isFrequency && newCompletionsThisPeriod >= (t.targetCount || 0);
          return {
            ...t,
            lastCompletedAt: nowDate,
            status: targetMet || !isFrequency ? 'later' : t.status,
            completionsThisPeriod: isFrequency ? newCompletionsThisPeriod : t.completionsThisPeriod,
            targetProgress: isFrequency && t.targetCount
              ? Math.min(100, (newCompletionsThisPeriod / t.targetCount) * 100)
              : t.targetProgress,
            streak: (() => {
              if (!t.streak) return t.streak;
              const lastCompleted = t.streak.lastCompletedAt ? new Date(t.streak.lastCompletedAt) : null;
              const isSameDay = lastCompleted &&
                nowDate.getFullYear() === lastCompleted.getFullYear() &&
                nowDate.getMonth() === lastCompleted.getMonth() &&
                nowDate.getDate() === lastCompleted.getDate();
              if (isSameDay) {
                return t.streak;
              }
              const next = t.streak.currentStreak + 1;
              return {
                ...t.streak,
                currentStreak: next,
                longestStreak: Math.max(t.streak.longestStreak, next),
                lastCompletedAt: nowDate,
              };
            })(),
          };
        }) : old
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
    },
    onSuccess: () => {
      toast({ title: "Task completed", description: "Good job! Maintenance recorded." });
    },
  });
}

export function useUpdateCompletion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ completionId, ...data }: {
      completionId: number;
      completedAt?: string;
      notes?: string | null;
      variationId?: number | null;
      metrics?: { metricId: number; value: number | string }[];
    }) => {
      const res = await apiRequest("PATCH", `/api/completions/${completionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
      toast({ title: "Completion updated", description: "Changes saved." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useReassignTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, targetProfileId }: { taskId: number; targetProfileId: number }) => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/reassign`, { targetProfileId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
      toast({ title: "Task moved", description: "Task has been moved to the new profile." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useMigrateTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskIds, targetProfileId }: { taskIds: number[]; targetProfileId: number }) => {
      const res = await apiRequest("POST", "/api/tasks/migrate", { taskIds, targetProfileId });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
      toast({ 
        title: "Tasks migrated", 
        description: `${variables.taskIds.length} task(s) moved to the new profile.` 
      });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
