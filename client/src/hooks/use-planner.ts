import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfileContext } from "@/contexts/ProfileContext";
import { getAuthHeaders } from "@/lib/queryClient";

export type PlannerOccurrence = {
  taskId: number;
  source: 'scheduled' | 'interval' | 'frequency' | 'overdue';
  isPseudoScheduled?: boolean;
};

export type PlannerDay = {
  date: string;
  occurrences: PlannerOccurrence[];
};

export type PlannerRangeResponse = {
  days: PlannerDay[];
};

export function usePlannerRange(startDate: string, endDate: string) {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;

  const query = useQuery<PlannerRangeResponse>({
    queryKey: ["/api/planner/range", startDate, endDate, isAggregatedView ? "all" : profileId],
    queryFn: async () => {
      const url = new URL("/api/planner/range", window.location.origin);
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
      if (profileId) url.searchParams.set("profileId", profileId.toString());
      if (isAggregatedView) url.searchParams.set("excludeDemo", "true");

      const headers = await getAuthHeaders();
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error("Failed to fetch planner range");
      return res.json();
    },
    enabled: !!startDate && !!endDate && (isAggregatedView || !!profileId),
  });

  // dateStr -> Set<taskId> for the natural schedule
  const scheduleByDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    (query.data?.days ?? []).forEach((day) => {
      const set = new Set<number>();
      day.occurrences.forEach((o) => set.add(o.taskId));
      map.set(day.date, set);
    });
    return map;
  }, [query.data]);

  // taskIds that are visually flagged as pseudo-scheduled (frequency suggestions)
  const pseudoScheduledTaskIds = useMemo(() => {
    const ids = new Set<number>();
    (query.data?.days ?? []).forEach((day) => {
      day.occurrences.forEach((o) => {
        if (o.isPseudoScheduled) ids.add(o.taskId);
      });
    });
    return ids;
  }, [query.data]);

  return { scheduleByDate, pseudoScheduledTaskIds, isLoading: query.isLoading };
}
