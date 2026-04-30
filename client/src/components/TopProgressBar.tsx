import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function TopProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const visible = fetching > 0 || mutating > 0;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] h-0.5 overflow-hidden pointer-events-none transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-1/4 bg-primary rounded-r-full top-progress-bar" />
    </div>
  );
}
