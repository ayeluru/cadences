import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Sparkles } from "lucide-react";
import changelog from "../../../CHANGELOG.md?raw";

declare const __APP_VERSION__: string;

interface ReleaseEntry {
  version: string;
  items: string[];
}

function parseChangelog(raw: string): ReleaseEntry[] {
  const entries: ReleaseEntry[] = [];
  let current: ReleaseEntry | null = null;

  for (const line of raw.split("\n")) {
    const versionMatch = line.match(/^## (.+)/);
    if (versionMatch) {
      if (current) entries.push(current);
      current = { version: versionMatch[1].trim(), items: [] };
      continue;
    }
    if (current) {
      const itemMatch = line.match(/^- (.+)/);
      if (itemMatch) current.items.push(itemMatch[1].trim());
    }
  }
  if (current) entries.push(current);
  return entries;
}

const STORAGE_KEY = "whatsNewLastSeen";

export function hasUnseenNotes(): boolean {
  if (typeof window === "undefined") return false;
  const lastSeen = localStorage.getItem(STORAGE_KEY);
  if (!lastSeen) return true;
  return lastSeen !== __APP_VERSION__;
}

export function useHasUnseenNotes(): boolean {
  return hasUnseenNotes();
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsNewDialog({ open, onOpenChange }: Props) {
  const [showOlder, setShowOlder] = useState(false);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      // Mark this version as seen on any close (Esc, backdrop, or explicit).
      localStorage.setItem(STORAGE_KEY, __APP_VERSION__);
      setShowOlder(false);
    }
    onOpenChange(next);
  }, [onOpenChange]);

  const entries = parseChangelog(changelog);
  const current = entries.find(e => e.version === __APP_VERSION__) ?? entries[0];
  const older = entries.filter(e => e.version !== current?.version);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            What&apos;s New
          </DialogTitle>
          <DialogDescription>
            {current ? `Recent updates in v${current.version}` : "Recent updates and improvements"}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto -mx-1 px-1 space-y-5 pb-1">
          {current && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default" className="text-xs font-mono">v{current.version}</Badge>
                <span className="text-[10px] text-primary font-medium">Current</span>
              </div>
              <ul className="space-y-2">
                {current.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2 leading-relaxed">
                    <span className="text-primary/60 mt-1.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {older.length > 0 && (
            <Collapsible open={showOlder} onOpenChange={setShowOlder}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOlder ? "rotate-0" : "-rotate-90"}`} />
                {showOlder ? "Hide older versions" : `Show older versions (${older.length})`}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-5 mt-3 pt-3 border-t">
                {older.map((entry) => (
                  <div key={entry.version}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs font-mono">v{entry.version}</Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {entry.items.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2 leading-relaxed">
                          <span className="text-primary/60 mt-1.5 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
