import { Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useCreateDemoProfile } from "@/hooks/use-profiles";
import { cn } from "@/lib/utils";

export function ProfileSwitcher() {
  const { currentProfile, setCurrentProfile, profiles, isLoading } = useProfileContext();
  const createDemoMutation = useCreateDemoProfile();

  if (isLoading || !currentProfile) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  const hasDemoProfile = profiles.some(p => p.isDemo);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-profile-switcher">
          {currentProfile.isDemo && (
            <Badge variant="secondary" className="text-xs">Demo</Badge>
          )}
          <span className="max-w-[100px] truncate">{currentProfile.name}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => setCurrentProfile(profile)}
            className="gap-2"
            data-testid={`menu-item-profile-${profile.id}`}
          >
            <Check
              className={cn(
                "h-4 w-4",
                currentProfile.id === profile.id ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="flex-1">{profile.name}</span>
            {profile.isDemo && (
              <Badge variant="secondary" className="text-xs">Demo</Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {!hasDemoProfile && (
          <DropdownMenuItem
            onClick={() => createDemoMutation.mutate()}
            className="gap-2"
            disabled={createDemoMutation.isPending}
            data-testid="menu-item-create-demo"
          >
            <Sparkles className="h-4 w-4" />
            <span>Try Demo Profile</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href="/settings" className="gap-2" data-testid="link-manage-profiles">
            <Plus className="h-4 w-4" />
            <span>Manage Profiles</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
