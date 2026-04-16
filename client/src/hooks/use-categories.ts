import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { InsertCategory } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useProfileContext } from "@/contexts/ProfileContext";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";

export function useCategories() {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;

  return useQuery({
    queryKey: [api.categories.list.path, isAggregatedView ? "all" : profileId],
    queryFn: async () => {
      const url = new URL(api.categories.list.path, window.location.origin);
      if (profileId) url.searchParams.append("profileId", profileId.toString());
      const headers = await getAuthHeaders();
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return api.categories.list.responses[200].parse(await res.json());
    },
    enabled: isAggregatedView || !!profileId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentProfile } = useProfileContext();

  return useMutation({
    mutationFn: async (data: Omit<InsertCategory, 'profileId'> & { profileId?: number | null }) => {
      const profileId = data.profileId ?? currentProfile?.id;
      if (!profileId) throw new Error("No profile selected");

      const res = await apiRequest(api.categories.create.method, api.categories.create.path, { ...data, profileId });
      return api.categories.create.responses[201].parse(await res.json());
    },
    onSuccess: (newCategory: any) => {
      // Optimistically prepend the new category to every cached categories list so
      // any <select> bound to its id immediately renders the matching <option>.
      // Without this, callers that setValue('categoryId', newId) right after the
      // mutation see a blank-looking select until the list query refetches.
      queryClient.setQueriesData<any[]>(
        { queryKey: [api.categories.list.path] },
        (old) => {
          if (!Array.isArray(old)) return old;
          if (old.some((c) => c?.id === newCategory?.id)) return old;
          return [...old, newCategory];
        }
      );
      queryClient.invalidateQueries({ queryKey: [api.categories.list.path] });
      toast({ title: "Category created" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (categoryId: number) => {
      const res = await apiRequest("DELETE", `/api/categories/${categoryId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.categories.list.path] });
      toast({ title: "Category deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    }
  });
}
