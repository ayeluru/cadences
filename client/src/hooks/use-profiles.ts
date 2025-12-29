import { useQuery, useMutation } from "@tanstack/react-query";
import { Profile } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
  });
}

export function useDefaultProfile() {
  return useQuery<Profile>({
    queryKey: ['/api/profiles/default'],
  });
}

export function useCreateProfile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { name: string; slug?: string; isDemo?: boolean }) => {
      const res = await apiRequest('POST', '/api/profiles', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      toast({ title: "Profile created", description: "New profile has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useUpdateProfile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; slug?: string }) => {
      const res = await apiRequest('PATCH', `/api/profiles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      toast({ title: "Profile updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useDeleteProfile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      toast({ title: "Profile deleted", description: "Profile and all its data have been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useCreateDemoProfile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/profiles/demo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      toast({ title: "Demo profile created", description: "Sample data is ready to explore." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useRegenerateDemoProfile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (profileId: number) => {
      const res = await apiRequest('POST', `/api/profiles/${profileId}/demo-seed`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/tasks') ||
            key.startsWith('/api/categories') ||
            key.startsWith('/api/tags') ||
            key.startsWith('/api/routines') ||
            key.startsWith('/api/streaks') ||
            key.startsWith('/api/calendar') ||
            key.startsWith('/api/completions') ||
            key.startsWith('/api/metrics') ||
            key.startsWith('/api/stats')
          );
        }
      });
      toast({ title: "Demo data regenerated", description: "Fresh sample data is ready to explore." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useClearProfileData() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (profileId: number) => {
      await apiRequest('DELETE', `/api/profiles/${profileId}/data`);
    },
    onSuccess: () => {
      // Invalidate all profile-scoped queries - use predicate to catch all variations
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/tasks') ||
            key.startsWith('/api/categories') ||
            key.startsWith('/api/tags') ||
            key.startsWith('/api/routines') ||
            key.startsWith('/api/streaks') ||
            key.startsWith('/api/calendar') ||
            key.startsWith('/api/completions') ||
            key.startsWith('/api/metrics') ||
            key.startsWith('/api/stats')
          );
        }
      });
      toast({ title: "Profile data cleared", description: "All data in this profile has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useClearAllProfilesData() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/profiles/all/data');
    },
    onSuccess: () => {
      // Invalidate all data queries across all profiles
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/tasks') ||
            key.startsWith('/api/categories') ||
            key.startsWith('/api/tags') ||
            key.startsWith('/api/routines') ||
            key.startsWith('/api/streaks') ||
            key.startsWith('/api/calendar') ||
            key.startsWith('/api/completions') ||
            key.startsWith('/api/metrics') ||
            key.startsWith('/api/stats')
          );
        }
      });
      toast({ title: "All data cleared", description: "All data across all profiles has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useImportFromProfile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ targetProfileId, sourceProfileId }: { targetProfileId: number; sourceProfileId: number }) => {
      const res = await apiRequest('POST', `/api/profiles/${targetProfileId}/import/${sourceProfileId}`);
      return res.json();
    },
    onSuccess: (data: { tasksCreated: number; categoriesCreated: number; tagsCreated: number }) => {
      // Invalidate all profile-scoped queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/tasks') ||
            key.startsWith('/api/categories') ||
            key.startsWith('/api/tags') ||
            key.startsWith('/api/routines') ||
            key.startsWith('/api/streaks') ||
            key.startsWith('/api/calendar') ||
            key.startsWith('/api/completions') ||
            key.startsWith('/api/metrics') ||
            key.startsWith('/api/stats')
          );
        }
      });
      toast({ 
        title: "Tasks imported", 
        description: `Imported ${data.tasksCreated} tasks, ${data.categoriesCreated} categories, and ${data.tagsCreated} tags.` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}
