import { Check, ChevronsUpDown, Plus, Sparkles, Layers, Loader2 } from "lucide-react";
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
  const { currentProfile, setCurrentProfile, profiles, isLoading, isAggregatedView, setAggregatedView, switchToProfileById } = useProfileContext();
  const createDemoMutation = useCreateDemoProfile();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="max-w-[100px] truncate">Loading...</span>
      </Button>
    );
  }

  const hasDemoProfile = profiles.some(p => p.isDemo);
  const displayName = isAggregatedView ? "All Profiles" : (currentProfile?.name || "Select Profile");

  const handleCreateDemo = () => {
    createDemoMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data?.profile?.id) {
          switchToProfileById(data.profile.id);
        }
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-profile-switcher">
          {isAggregatedView ? (
            <Layers className="h-4 w-4" />
          ) : currentProfile?.isDemo ? (
            <Badge variant="secondary" className="text-xs">Demo</Badge>
          ) : null}
          <span className="max-w-[100px] truncate">{displayName}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setAggregatedView(true)}
          className="gap-2"
          data-testid="menu-item-all-profiles"
        >
          <Check
            className={cn(
              "h-4 w-4",
              isAggregatedView ? "opacity-100" : "opacity-0"
            )}
          />
          <Layers className="h-4 w-4" />
          <span className="flex-1">All Profiles</span>
        </DropdownMenuItem>
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
                !isAggregatedView && currentProfile?.id === profile.id ? "opacity-100" : "opacity-0"
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
            onClick={handleCreateDemo}
            className="gap-2"
            disabled={createDemoMutation.isPending}
            data-testid="menu-item-create-demo"
          >
            {createDemoMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{createDemoMutation.isPending ? "Creating demo..." : "Try Demo Profile"}</span>
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
