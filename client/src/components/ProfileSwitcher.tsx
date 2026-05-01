import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Sparkles, Layers, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useCreateDemoProfile } from "@/hooks/use-profiles";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}

export function ProfileSwitcher() {
  const {
    currentProfile,
    setCurrentProfile,
    profiles,
    isLoading,
    isAggregatedView,
    setAggregatedView,
    switchToProfileById,
  } = useProfileContext();
  const createDemoMutation = useCreateDemoProfile();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-2.5 text-sm text-muted-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="max-w-[100px] truncate">Loading...</span>
      </button>
    );
  }

  const realProfiles = profiles.filter((p) => !p.isDemo);
  const demoProfiles = profiles.filter((p) => p.isDemo);
  const hasDemoProfile = demoProfiles.length > 0;
  const displayName = isAggregatedView
    ? "All Profiles"
    : currentProfile?.name || "Select Profile";
  const inDemoMode = !isAggregatedView && !!currentProfile?.isDemo;

  const handleCreateDemo = async () => {
    try {
      const data = await createDemoMutation.mutateAsync();
      await queryClient.refetchQueries({ queryKey: ["/api/profiles"] });
      if (data?.profile?.id) {
        switchToProfileById(data.profile.id);
      }
    } finally {
      setDropdownOpen(false);
    }
  };

  const triggerAvatar = isAggregatedView ? (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-foreground">
      <Layers className="h-3.5 w-3.5" />
    </div>
  ) : inDemoMode ? (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30">
      <Sparkles className="h-3.5 w-3.5" />
    </div>
  ) : (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-[11px] font-bold text-white shadow-sm shadow-primary/25">
      {currentProfile ? getInitial(currentProfile.name) : "?"}
    </div>
  );

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex h-9 items-center gap-2 rounded-xl border px-1.5 pr-2 text-left text-sm transition-all duration-200",
            "hover:shadow-sm",
            inDemoMode
              ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
              : "border-border/60 bg-card/50 hover:bg-muted backdrop-blur-sm"
          )}
          data-testid="button-profile-switcher"
        >
          {triggerAvatar}
          <span
            className={cn(
              "max-w-[110px] truncate font-medium",
              inDemoMode && "text-amber-900 dark:text-amber-100"
            )}
          >
            {displayName}
          </span>
          {inDemoMode && (
            <span className="rounded-md border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100">
              Demo
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5">
        {/* Aggregated view */}
        <DropdownMenuItem
          onClick={() => setAggregatedView(true)}
          className="gap-2.5 rounded-lg p-2 cursor-pointer"
          data-testid="menu-item-all-profiles"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-foreground">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium leading-tight">All Profiles</p>
            <p className="text-[10px] text-muted-foreground">Aggregated view</p>
          </div>
          {isAggregatedView && (
            <Check className="h-4 w-4 shrink-0 text-primary" />
          )}
        </DropdownMenuItem>

        {/* Real profiles */}
        {realProfiles.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your profiles
            </DropdownMenuLabel>
            {realProfiles.map((profile) => {
              const isActive = !isAggregatedView && currentProfile?.id === profile.id;
              return (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => setCurrentProfile(profile)}
                  className="gap-2.5 rounded-lg p-2 cursor-pointer"
                  data-testid={`menu-item-profile-${profile.id}`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-[11px] font-bold text-white shadow-sm shadow-primary/25">
                    {getInitial(profile.name)}
                  </div>
                  <span className="flex-1 truncate text-sm font-medium">
                    {profile.name}
                  </span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        {/* Demo section */}
        {hasDemoProfile && (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuLabel className="flex items-baseline gap-1.5 px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Demo
              </span>
              <span className="text-[10px] font-normal normal-case text-muted-foreground">
                — sample data
              </span>
            </DropdownMenuLabel>
            {demoProfiles.map((profile) => {
              const isActive = !isAggregatedView && currentProfile?.id === profile.id;
              return (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => setCurrentProfile(profile)}
                  className="gap-2.5 rounded-lg p-2 cursor-pointer focus:bg-amber-500/15 dark:focus:bg-amber-500/20"
                  data-testid={`menu-item-profile-${profile.id}`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 truncate text-sm font-medium">
                    {profile.name}
                  </span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        {!hasDemoProfile && (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuLabel className="flex items-baseline gap-1.5 px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Demo
              </span>
              <span className="text-[10px] font-normal normal-case text-muted-foreground">
                — sample data
              </span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleCreateDemo();
              }}
              className="gap-2.5 rounded-lg p-2 cursor-pointer focus:bg-amber-500/15 dark:focus:bg-amber-500/20"
              disabled={createDemoMutation.isPending}
              data-testid="menu-item-create-demo"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {createDemoMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="flex-1 truncate text-sm font-medium">
                {createDemoMutation.isPending ? "Creating demo..." : "Try Demo Profile"}
              </span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuItem asChild className="gap-2.5 rounded-lg p-2 cursor-pointer">
          <a href="/settings" data-testid="link-manage-profiles">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-background text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 truncate text-sm font-medium text-muted-foreground">
              Manage Profiles
            </span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
