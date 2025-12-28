import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { InsertTag } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useTags() {
  return useQuery({
    queryKey: [api.tags.list.path],
    queryFn: async () => {
      const res = await fetch(api.tags.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tags");
      return api.tags.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertTag) => {
      const res = await fetch(api.tags.create.path, {
        method: api.tags.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create tag");
      return api.tags.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tags.list.path] });
      toast({ title: "Tag created" });
    },
  });
}
