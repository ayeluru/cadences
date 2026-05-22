import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHardReload } from "@/hooks/use-hard-reload";

type Variant = "default" | "compact";

interface Props {
  variant?: Variant;
}

// Hard-reload affordance. iOS standalone PWAs have no native pull-to-refresh
// and our React Query persisted cache makes stale states sticky — so we
// always need a visible button.
export function RefreshButton({ variant = "default" }: Props) {
  const { reload, isReloading } = useHardReload();

  if (variant === "compact") {
    return (
      <button
        onClick={reload}
        title="Refresh app"
        aria-label="Refresh app"
        disabled={isReloading}
        className="flex items-center justify-center shrink-0 w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isReloading ? "animate-spin" : ""}`} />
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={reload}
      title="Refresh app"
      aria-label="Refresh app"
      disabled={isReloading}
    >
      <RefreshCw className={`w-5 h-5 ${isReloading ? "animate-spin" : ""}`} />
    </Button>
  );
}
