import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TaskAssignment } from "@shared/schema";

export function useAssignments(startDate: string, endDate: string) {
  return useQuery<TaskAssignment[]>({
    queryKey: ["/api/assignments", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/assignments?start=${startDate}&end=${endDate}`);
      return res.json();
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { taskId: number; plannedDate: string; originalDate?: string }) => {
      const res = await apiRequest("POST", "/api/assignments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await apiRequest("DELETE", `/api/assignments/${assignmentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useResetAssignments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { start: string; end: string }) => {
      const res = await apiRequest("DELETE", `/api/assignments?start=${data.start}&end=${data.end}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Week reset", description: "All manual changes have been cleared." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
