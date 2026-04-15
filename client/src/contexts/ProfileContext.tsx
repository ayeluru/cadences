import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Profile } from "@shared/schema";
import { useProfiles, useDefaultProfile } from "@/hooks/use-profiles";

interface ProfileContextType {
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile | null) => void;
  profiles: Profile[];
  isLoading: boolean;
  isAggregatedView: boolean;
  setAggregatedView: (enabled: boolean) => void;
  switchToProfileById: (id: number) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const PROFILE_STORAGE_KEY = "cadences-current-profile";
const AGGREGATED_VIEW_KEY = "cadences-aggregated-view";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: defaultProfile, isLoading: defaultLoading } = useDefaultProfile();
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    return saved ? Number(saved) : null;
  });
  const [isAggregatedView, setIsAggregatedView] = useState(() => {
    return localStorage.getItem(AGGREGATED_VIEW_KEY) === "true";
  });
  const hasInitialized = useRef(false);

  // Derive currentProfile from the live profiles array so it's always fresh
  const currentProfile = currentProfileId
    ? profiles.find(p => p.id === currentProfileId) ?? null
    : null;

  // One-time initialization: pick the right profile once data arrives
  useEffect(() => {
    if (profilesLoading || defaultLoading) return;
    if (hasInitialized.current) return;

    hasInitialized.current = true;

    if (isAggregatedView) {
      // In aggregated view we still need a backing profile id for context
      if (!currentProfileId && profiles.length > 0) {
        setCurrentProfileId(profiles[0].id);
      }
      return;
    }

    // If we already have a valid saved profile, keep it
    if (currentProfileId && profiles.some(p => p.id === currentProfileId)) {
      return;
    }

    // Saved profile doesn't exist (deleted, first visit, etc.)
    if (defaultProfile) {
      setCurrentProfileId(defaultProfile.id);
      localStorage.setItem(PROFILE_STORAGE_KEY, String(defaultProfile.id));
    } else if (profiles.length > 0) {
      setCurrentProfileId(profiles[0].id);
      localStorage.setItem(PROFILE_STORAGE_KEY, String(profiles[0].id));
    }
  }, [profiles, defaultProfile, profilesLoading, defaultLoading, currentProfileId, isAggregatedView]);

  // If the currently-selected profile disappears (deleted), recover gracefully
  useEffect(() => {
    if (profilesLoading || !hasInitialized.current) return;
    if (!currentProfileId) return;
    if (profiles.length === 0) return;

    const stillExists = profiles.some(p => p.id === currentProfileId);
    if (!stillExists) {
      const nonDemo = profiles.find(p => !p.isDemo);
      const fallback = nonDemo ?? profiles[0];
      setCurrentProfileId(fallback.id);
      localStorage.setItem(PROFILE_STORAGE_KEY, String(fallback.id));
    }
  }, [profiles, profilesLoading, currentProfileId]);

  const setCurrentProfile = useCallback((profile: Profile | null) => {
    if (profile) {
      setCurrentProfileId(profile.id);
      setIsAggregatedView(false);
      localStorage.setItem(PROFILE_STORAGE_KEY, String(profile.id));
      localStorage.removeItem(AGGREGATED_VIEW_KEY);
    }
  }, []);

  const switchToProfileById = useCallback((id: number) => {
    setCurrentProfileId(id);
    setIsAggregatedView(false);
    localStorage.setItem(PROFILE_STORAGE_KEY, String(id));
    localStorage.removeItem(AGGREGATED_VIEW_KEY);
  }, []);

  const setAggregatedView = useCallback((enabled: boolean) => {
    setIsAggregatedView(enabled);
    if (enabled) {
      localStorage.setItem(AGGREGATED_VIEW_KEY, "true");
    } else {
      localStorage.removeItem(AGGREGATED_VIEW_KEY);
      if (currentProfileId) {
        localStorage.setItem(PROFILE_STORAGE_KEY, String(currentProfileId));
      } else if (profiles.length > 0) {
        const fallback = profiles[0];
        setCurrentProfileId(fallback.id);
        localStorage.setItem(PROFILE_STORAGE_KEY, String(fallback.id));
      }
    }
  }, [currentProfileId, profiles]);

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        setCurrentProfile,
        profiles,
        isLoading: profilesLoading || defaultLoading,
        isAggregatedView,
        setAggregatedView,
        switchToProfileById,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }
  return context;
}
