import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Routine, InsertRoutine, TaskWithDetails } from "@shared/schema";
import { useProfileContext } from "@/contexts/ProfileContext";

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
