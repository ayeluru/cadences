import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { InsertTask } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useProfileContext } from "@/contexts/ProfileContext";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";

export function useTasks(filters?: { search?: string; categoryId?: number; tagId?: number }) {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;

  return useQuery({
    queryKey: [api.tasks.list.path, isAggregatedView ? "all" : profileId, filters],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions"] });
      toast({ title: "Task deleted", description: "Task and all its history have been permanently removed." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({ title: "Task ended", description: "Task will no longer recur. History is preserved." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({ title: "Task completed", description: "Good job! Maintenance recorded." });
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
