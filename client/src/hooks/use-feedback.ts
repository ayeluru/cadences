import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { FeedbackSubmission, FeedbackComment } from "@shared/schema";

export type FeedbackWithCounts = FeedbackSubmission & {
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
  displayName?: string;
  submitterEmail?: string;
};

export type FeedbackStats = {
  total: number;
  unreviewed: number;
  public: number;
  byStatus: Record<string, number>;
};

export function useFeedbackStats(enabled = true) {
  return useQuery<FeedbackStats>({
    queryKey: ["/api/feedback/stats"],
    enabled,
    refetchInterval: 60000,
  });
}

export function useFeedbackList(filters?: { type?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  const url = `/api/feedback${qs ? `?${qs}` : ""}`;

  return useQuery<FeedbackWithCounts[]>({
    queryKey: [url],
  });
}

export function useFeedbackDetail(id: number | null) {
  return useQuery<FeedbackSubmission & { voteCount: number }>({
    queryKey: [`/api/feedback/${id}`],
    enabled: id !== null,
  });
}

export function useFeedbackComments(feedbackId: number | null) {
  return useQuery<FeedbackComment[]>({
    queryKey: [`/api/feedback/${feedbackId}/comments`],
    enabled: feedbackId !== null,
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; title: string; description: string; isAnonymous?: boolean }) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: any }) => {
      const res = await apiRequest("PATCH", `/api/feedback/${id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${variables.id}`] });
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/feedback/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });
}

export function useToggleVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (feedbackId: number) => {
      const res = await apiRequest("POST", `/api/feedback/${feedbackId}/vote`);
      return res.json();
    },
    onSuccess: (_data, feedbackId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${feedbackId}`] });
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, content, isAnonymous, isOfficialResponse }: { feedbackId: number; content: string; isAnonymous?: boolean; isOfficialResponse?: boolean }) => {
      const res = await apiRequest("POST", `/api/feedback/${feedbackId}/comments`, { content, isAnonymous, isOfficialResponse });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${variables.feedbackId}/comments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${variables.feedbackId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });
}

export function useToggleOfficialResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, commentId, isOfficialResponse }: { feedbackId: number; commentId: number; isOfficialResponse: boolean }) => {
      const res = await apiRequest("PATCH", `/api/feedback/${feedbackId}/comments/${commentId}`, { isOfficialResponse });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${variables.feedbackId}/comments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${variables.feedbackId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, commentId }: { feedbackId: number; commentId: number }) => {
      await apiRequest("DELETE", `/api/feedback/${feedbackId}/comments/${commentId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/feedback/${variables.feedbackId}/comments`] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });
}
