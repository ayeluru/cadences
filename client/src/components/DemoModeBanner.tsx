import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfileContext } from "@/contexts/ProfileContext";

export function DemoModeBanner() {
  const { currentProfile, profiles, isAggregatedView, switchToProfileById } =
    useProfileContext();

  if (isAggregatedView) return null;
  if (!currentProfile?.isDemo) return null;

  const realProfile = profiles.find((p) => !p.isDemo);

  return (
    <div
      className="sticky top-0 z-30 border-b border-amber-500/30 bg-amber-500/15 backdrop-blur-md"
      data-testid="demo-mode-banner"
    >
      <div className="container mx-auto max-w-5xl flex items-center gap-3 px-4 py-2 md:px-8 lg:px-12">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 min-w-0 text-sm text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Demo mode</span>
          <span className="hidden text-amber-900/80 dark:text-amber-100/80 sm:inline">
            {" "}— sample data. Changes here won't affect your real profiles.
          </span>
        </p>
        {realProfile ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 border-amber-500/40 bg-background/60 px-2.5 text-xs hover:bg-background"
            onClick={() => switchToProfileById(realProfile.id)}
            data-testid="button-exit-demo"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit demo
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 shrink-0 border-amber-500/40 bg-background/60 px-2.5 text-xs hover:bg-background"
          >
            <a href="/settings" data-testid="link-create-real-profile">
              Create a real profile
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
