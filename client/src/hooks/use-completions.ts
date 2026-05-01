import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type CalendarCompletionDay = {
  date: string;
  count: number;
  tasks: { id: number; title: string; completedAt: string }[];
};

export function useCompletionsByDay(startDate: string, endDate: string) {
  const query = useQuery<CalendarCompletionDay[]>({
    queryKey: ["/api/completions/calendar", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/completions/calendar?start=${startDate}&end=${endDate}`,
      );
      return res.json();
    },
    enabled: !!startDate && !!endDate,
  });

  const completionsByTask = useMemo(() => {
    const map = new Map<number, Set<string>>();
    (query.data ?? []).forEach((day) => {
      day.tasks.forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, new Set());
        map.get(t.id)!.add(day.date);
      });
    });
    return map;
  }, [query.data]);

  return { completionsByTask, isLoading: query.isLoading };
}
