import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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

function hasUnseenNotes(): boolean {
  const lastSeen = localStorage.getItem(STORAGE_KEY);
  if (!lastSeen) return true;
  return lastSeen !== __APP_VERSION__;
}

export function WhatsNewDialog({ externalOpen, onOpenChange }: { externalOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [autoOpen, setAutoOpen] = useState(() => hasUnseenNotes());
  const isOpen = externalOpen ?? autoOpen;

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      localStorage.setItem(STORAGE_KEY, __APP_VERSION__);
      setAutoOpen(false);
    }
    onOpenChange?.(open);
  }, [onOpenChange]);

  useEffect(() => {
    if (externalOpen === true) {
      setAutoOpen(false);
    }
  }, [externalOpen]);

  const entries = parseChangelog(changelog);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>What's New</DialogTitle>
          <DialogDescription>Recent updates and improvements</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto -mx-1 px-1 space-y-5 pb-1">
          {entries.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={entry.version === __APP_VERSION__ ? "default" : "secondary"} className="text-xs font-mono">
                  v{entry.version}
                </Badge>
                {entry.version === __APP_VERSION__ && (
                  <span className="text-[10px] text-primary font-medium">Current</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary/60 mt-1.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useHasUnseenNotes(): boolean {
  return hasUnseenNotes();
}
