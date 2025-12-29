import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Profile } from "@shared/schema";
import { useProfiles, useDefaultProfile } from "@/hooks/use-profiles";

interface ProfileContextType {
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile) => void;
  profiles: Profile[];
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const PROFILE_STORAGE_KEY = "cadences-current-profile";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: defaultProfile, isLoading: defaultLoading } = useDefaultProfile();
  const [currentProfile, setCurrentProfileState] = useState<Profile | null>(null);

  useEffect(() => {
    if (profilesLoading || defaultLoading) return;
    
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

  const setCurrentProfile = (profile: Profile) => {
    setCurrentProfileState(profile);
    localStorage.setItem(PROFILE_STORAGE_KEY, String(profile.id));
  };

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        setCurrentProfile,
        profiles,
        isLoading: profilesLoading || defaultLoading,
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
