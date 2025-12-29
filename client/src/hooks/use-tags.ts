import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { InsertTag } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useProfileContext } from "@/contexts/ProfileContext";

export function useTags() {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;

  return useQuery({
    queryKey: [api.tags.list.path, isAggregatedView ? "all" : profileId],
    queryFn: async () => {
      const url = new URL(api.tags.list.path, window.location.origin);
      if (profileId) url.searchParams.append("profileId", profileId.toString());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tags");
      return api.tags.list.responses[200].parse(await res.json());
    },
    enabled: isAggregatedView || !!profileId,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentProfile } = useProfileContext();

  return useMutation({
    mutationFn: async (data: Omit<InsertTag, 'profileId'> & { profileId?: number | null }) => {
      const profileId = data.profileId ?? currentProfile?.id;
      if (!profileId) throw new Error("No profile selected");
      
      const res = await fetch(api.tags.create.path, {
        method: api.tags.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, profileId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create tag");
      return api.tags.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tags.list.path] });
      toast({ title: "Tag created" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
