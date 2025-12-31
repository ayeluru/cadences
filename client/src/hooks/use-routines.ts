import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Routine, InsertRoutine, TaskWithDetails, RoutineComponent, RoutineRun } from "@shared/schema";
import { useProfileContext } from "@/contexts/ProfileContext";

export type RoutineComponentWithTask = RoutineComponent & { task: TaskWithDetails };

export function useRoutines() {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;

  return useQuery<Routine[]>({
    queryKey: ["/api/routines", isAggregatedView ? "all" : profileId],
    queryFn: async () => {
      const url = new URL("/api/routines", window.location.origin);
      if (profileId) url.searchParams.append("profileId", profileId.toString());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch routines");
      return res.json();
    },
    enabled: isAggregatedView || !!profileId,
  });
}

export function useCreateRoutine() {
  const { toast } = useToast();
  const { currentProfile } = useProfileContext();
  
  return useMutation({
    mutationFn: async (data: Omit<InsertRoutine, 'profileId'> & { profileId?: number | null }) => {
      const profileId = data.profileId ?? currentProfile?.id;
      if (!profileId) throw new Error("No profile selected");
      
      const res = await apiRequest("POST", "/api/routines", { ...data, profileId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      toast({ title: "Routine created", description: "Your new routine has been created." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteRoutine() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/routines/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Routine deleted", description: "The routine has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRoutineTasks(routineId: number | undefined) {
  return useQuery<TaskWithDetails[]>({
    queryKey: ["/api/routines", routineId, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/routines/${routineId}/tasks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch routine tasks");
      return res.json();
    },
    enabled: !!routineId,
  });
}

export function useCompleteRoutine() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (routineId: number) => {
      const res = await apiRequest("POST", `/api/routines/${routineId}/complete-all`);
      return res.json();
    },
    onSuccess: (data: { completedCount: number; totalTasks: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({ 
        title: "Routine completed", 
        description: `Completed ${data.completedCount} of ${data.totalTasks} tasks.` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useAddTaskToRoutine() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ routineId, taskId, orderIndex }: { routineId: number; taskId: number; orderIndex?: number }) => {
      const res = await apiRequest("POST", `/api/routines/${routineId}/links`, { taskId, orderIndex });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoveTaskFromRoutine() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ routineId, taskId }: { routineId: number; taskId: number }) => {
      const res = await apiRequest("DELETE", `/api/routines/${routineId}/links/${taskId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useLinkedTasks(routineId: number | undefined) {
  return useQuery<TaskWithDetails[]>({
    queryKey: ["/api/routines", routineId, "linked-tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/routines/${routineId}/linked-tasks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch linked tasks");
      return res.json();
    },
    enabled: !!routineId,
  });
}

// ==================== New Routine Components System ====================

export function useRoutineComponents(routineId: number | undefined) {
  return useQuery<RoutineComponentWithTask[]>({
    queryKey: ["/api/routines", routineId, "components"],
    queryFn: async () => {
      const res = await fetch(`/api/routines/${routineId}/components`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch routine components");
      return res.json();
    },
    enabled: !!routineId,
  });
}

export function useAddRoutineComponent() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ routineId, taskId, orderIndex, ruleType, ruleValue }: { 
      routineId: number; 
      taskId: number; 
      orderIndex?: number;
      ruleType?: string;
      ruleValue?: number;
    }) => {
      const res = await apiRequest("POST", `/api/routines/${routineId}/components`, { 
        taskId, orderIndex, ruleType, ruleValue 
      });
      return res.json();
    },
    onSuccess: (_, { routineId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "components"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateRoutineComponent() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ routineId, componentId, ruleType, ruleValue, orderIndex }: { 
      routineId: number;
      componentId: number; 
      ruleType?: string;
      ruleValue?: number;
      orderIndex?: number;
    }) => {
      const res = await apiRequest("PUT", `/api/routines/${routineId}/components/${componentId}`, { 
        ruleType, ruleValue, orderIndex 
      });
      return res.json();
    },
    onSuccess: (_, { routineId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "components"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoveRoutineComponent() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ routineId, componentId }: { routineId: number; componentId: number }) => {
      const res = await apiRequest("DELETE", `/api/routines/${routineId}/components/${componentId}`);
      return res.json();
    },
    onSuccess: (_, { routineId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "components"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== Routine Runs ====================

export function useRoutineRuns(routineId: number | undefined, limit?: number) {
  return useQuery<RoutineRun[]>({
    queryKey: ["/api/routines", routineId, "runs"],
    queryFn: async () => {
      const url = new URL(`/api/routines/${routineId}/runs`, window.location.origin);
      if (limit) url.searchParams.append("limit", limit.toString());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch routine runs");
      return res.json();
    },
    enabled: !!routineId,
  });
}

export function useEligibleTasks(routineId: number | undefined) {
  return useQuery<{ eligibleTasks: RoutineComponentWithTask[]; nextRunNumber: number }>({
    queryKey: ["/api/routines", routineId, "eligible-tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/routines/${routineId}/eligible-tasks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch eligible tasks");
      return res.json();
    },
    enabled: !!routineId,
  });
}

export function useStartRoutineRun() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (routineId: number) => {
      const res = await apiRequest("POST", `/api/routines/${routineId}/runs`, {});
      return res.json();
    },
    onSuccess: (_, routineId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "eligible-tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useCompleteRoutineRun() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ routineId, runId, taskIds, notes }: { 
      routineId: number; 
      runId: number; 
      taskIds: number[];
      notes?: string;
    }) => {
      const res = await apiRequest("POST", `/api/routines/${routineId}/runs/${runId}/complete`, { 
        taskIds, notes 
      });
      return res.json();
    },
    onSuccess: (data, { routineId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines", routineId, "eligible-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      toast({ 
        title: "Routine completed", 
        description: `Completed ${data.completedCount} tasks.` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
