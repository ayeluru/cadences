import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Profile } from "@shared/schema";
import { useProfiles, useDefaultProfile } from "@/hooks/use-profiles";

interface ProfileContextType {
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile | null) => void;
  profiles: Profile[];
  isLoading: boolean;
  isAggregatedView: boolean;
  setAggregatedView: (enabled: boolean) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const PROFILE_STORAGE_KEY = "cadences-current-profile";
const AGGREGATED_VIEW_KEY = "cadences-aggregated-view";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: defaultProfile, isLoading: defaultLoading } = useDefaultProfile();
  const [currentProfile, setCurrentProfileState] = useState<Profile | null>(null);
  const [isAggregatedView, setIsAggregatedView] = useState(false);

  useEffect(() => {
    if (profilesLoading || defaultLoading) return;
    
    // Check if aggregated view was saved
    const savedAggregated = localStorage.getItem(AGGREGATED_VIEW_KEY);
    if (savedAggregated === "true") {
      setIsAggregatedView(true);
      // Still need a profile for context, use first one
      if (profiles.length > 0) {
        setCurrentProfileState(profiles[0]);
      }
      return;
    }
    
    // Try to restore from localStorage
    const savedProfileId = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (savedProfileId) {
      const savedProfile = profiles.find(p => p.id === Number(savedProfileId));
      if (savedProfile) {
        setCurrentProfileState(savedProfile);
        return;
      }
    }
    
    // Fall back to default profile
    if (defaultProfile) {
      setCurrentProfileState(defaultProfile);
    }
  }, [profiles, defaultProfile, profilesLoading, defaultLoading]);

  const setCurrentProfile = (profile: Profile | null) => {
    if (profile) {
      setCurrentProfileState(profile);
      setIsAggregatedView(false);
      localStorage.setItem(PROFILE_STORAGE_KEY, String(profile.id));
      localStorage.removeItem(AGGREGATED_VIEW_KEY);
    }
  };

  const setAggregatedView = (enabled: boolean) => {
    setIsAggregatedView(enabled);
    if (enabled) {
      localStorage.setItem(AGGREGATED_VIEW_KEY, "true");
      // Keep currentProfile as context reference, just don't use it for filtering
    } else {
      localStorage.removeItem(AGGREGATED_VIEW_KEY);
      // Restore to current profile or first profile if none set
      if (!currentProfile && profiles.length > 0) {
        setCurrentProfileState(profiles[0]);
        localStorage.setItem(PROFILE_STORAGE_KEY, String(profiles[0].id));
      } else if (currentProfile) {
        localStorage.setItem(PROFILE_STORAGE_KEY, String(currentProfile.id));
      }
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        setCurrentProfile,
        profiles,
        isLoading: profilesLoading || defaultLoading,
        isAggregatedView,
        setAggregatedView,
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
