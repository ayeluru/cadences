import { Sparkles, LogOut } from "lucide-react";
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <p className="flex-1 min-w-0 text-sm text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Demo mode</span>
          <span className="hidden text-amber-900/80 dark:text-amber-100/80 sm:inline">
            {" "}— sample data. Changes here won't affect your real profiles.
          </span>
        </p>
        {realProfile ? (
          <button
            type="button"
            onClick={() => switchToProfileById(realProfile.id)}
            className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 px-3 text-xs font-semibold text-white shadow-sm shadow-amber-500/40 transition-all duration-200 hover:shadow-md hover:shadow-amber-500/50 hover:from-amber-500 hover:to-amber-700 active:scale-95"
            data-testid="button-exit-demo"
          >
            <LogOut className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Exit demo
          </button>
        ) : (
          <a
            href="/settings"
            className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 px-3 text-xs font-semibold text-white shadow-sm shadow-amber-500/40 transition-all duration-200 hover:shadow-md hover:shadow-amber-500/50 hover:from-amber-500 hover:to-amber-700 active:scale-95"
            data-testid="link-create-real-profile"
          >
            Create a real profile
          </a>
        )}
      </div>
    </div>
  );
}
