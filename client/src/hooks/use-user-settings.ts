import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { useEffect, useRef } from "react";

const USER_SETTINGS_KEY = ["/api/user-settings"];

interface UserSettings {
  timezone: string;
  vacationMode?: boolean;
  vacationUntil?: string | null;
}

export function useUserSettings() {
  return useQuery<UserSettings>({
    queryKey: USER_SETTINGS_KEY,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/user-settings", { headers });
      if (!res.ok) throw new Error("Failed to fetch user settings");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const res = await apiRequest("PUT", "/api/user-settings", updates);
      return res.json();
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: USER_SETTINGS_KEY });
      const previous = queryClient.getQueryData<UserSettings>(USER_SETTINGS_KEY);
      queryClient.setQueryData<UserSettings>(USER_SETTINGS_KEY, (old) => ({
        ...old,
        ...updates,
        timezone: updates.timezone || old?.timezone || "UTC",
      }));
      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(USER_SETTINGS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });
}

export function useTimezone(): string {
  const { data } = useUserSettings();
  return data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function useStartVacation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (until?: string) => {
      const res = await apiRequest("POST", "/api/vacation", { until });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
    },
  });
}

export function useEndVacation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/vacation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
    },
  });
}

export function useVacationMode() {
  const { data } = useUserSettings();
  const isActive = data?.vacationMode === true
    && (!data.vacationUntil || new Date(data.vacationUntil) > new Date());
  return {
    isActive,
    until: data?.vacationUntil ? new Date(data.vacationUntil) : null,
  };
}

export function useTimezoneAutoDetect() {
  const { data: settings, isSuccess } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const didAutoDetect = useRef(false);

  useEffect(() => {
    if (!isSuccess || didAutoDetect.current) return;
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!settings?.timezone || settings.timezone === "UTC") {
      if (detectedTz && detectedTz !== "UTC") {
        didAutoDetect.current = true;
        updateSettings.mutate({ timezone: detectedTz });
      }
    }
  }, [isSuccess, settings?.timezone]);
}
