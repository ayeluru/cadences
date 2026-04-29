import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Pause, Calendar } from "lucide-react";
import { usePauseTask } from "@/hooks/use-tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useTimezone } from "@/hooks/use-user-settings";
import { formatLocal } from "@/lib/tz";

interface PauseTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number;
  taskTitle: string;
}

export function PauseTaskDialog({ open, onOpenChange, taskId, taskTitle }: PauseTaskDialogProps) {
  const tz = useTimezone();
  const pauseMutation = usePauseTask();
  const [mode, setMode] = useState<'indefinite' | 'until'>('indefinite');
  const [untilDate, setUntilDate] = useState<Date | undefined>(undefined);

  const handlePause = () => {
    const until = mode === 'until' && untilDate ? untilDate.toISOString() : undefined;
    pauseMutation.mutate(
      { id: taskId, until },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5" />
            Pause Task
          </DialogTitle>
          <DialogDescription>
            Pause "{taskTitle}" to preserve your streak while you're away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label>Pause duration</Label>
            <div className="flex flex-col gap-2">
              <Button
                variant={mode === 'indefinite' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => setMode('indefinite')}
              >
                Pause indefinitely
                <span className="text-xs ml-auto opacity-70">Resume manually</span>
              </Button>
              <Button
                variant={mode === 'until' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => setMode('until')}
              >
                Pause until a date
                <span className="text-xs ml-auto opacity-70">Auto-resumes</span>
              </Button>
            </div>
          </div>

          {mode === 'until' && (
            <div className="space-y-2">
              <Label>Resume date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <Calendar className="w-4 h-4 mr-2" />
                    {untilDate
                      ? formatLocal(untilDate, tz, "MMMM d, yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={untilDate}
                    onSelect={setUntilDate}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePause}
            disabled={pauseMutation.isPending || (mode === 'until' && !untilDate)}
          >
            {pauseMutation.isPending ? "Pausing..." : "Pause Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
