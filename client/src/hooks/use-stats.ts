import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { getAuthHeaders } from "@/lib/queryClient";

export function useStats(profileId?: number | null) {
  const queryParams = profileId ? `?profileId=${profileId}` : '';
  return useQuery({
    queryKey: [api.stats.get.path, profileId],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${api.stats.get.path}${queryParams}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
  });
}
