import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Routine, InsertRoutine } from "@shared/schema";
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
  
  return useMutation({
    mutationFn: async (data: InsertRoutine) => {
      const res = await apiRequest("POST", "/api/routines", data);
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
