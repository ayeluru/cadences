import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskWithDetails, TaskMetric } from "@shared/schema";
import { useState } from "react";
import { Loader2, Calendar } from "lucide-react";
import { useCompleteTask } from "@/hooks/use-tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithDetails;
}

export function CompleteTaskDialog({ open, onOpenChange, task }: CompleteTaskDialogProps) {
  const completeMutation = useCompleteTask();
  const [metricValues, setMetricValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [completedAt, setCompletedAt] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSubmit = () => {
    const metrics = Object.entries(metricValues).map(([metricId, value]) => ({
      metricId: Number(metricId),
      value: isNaN(Number(value)) ? value : Number(value)
    }));

    completeMutation.mutate({ 
      id: task.id, 
      notes, 
      metrics,
      completedAt: completedAt ? completedAt.toISOString() : undefined
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setMetricValues({});
        setNotes("");
        setCompletedAt(undefined);
        setShowDatePicker(false);
      }
    });
  };

  const updateMetricValue = (metricId: number, value: string) => {
    setMetricValues(prev => ({ ...prev, [metricId]: value }));
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMetricValues({});
      setNotes("");
      setCompletedAt(undefined);
      setShowDatePicker(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Complete: {task.title}</DialogTitle>
          <DialogDescription>
            Record your stats for this completion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Completion Date</Label>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowDatePicker(!showDatePicker);
                  if (showDatePicker) {
                    setCompletedAt(undefined);
                  }
                }}
                data-testid="button-toggle-backdate"
              >
                {showDatePicker ? "Use Today" : "Backdate"}
              </Button>
            </div>
            {showDatePicker ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-date-picker"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {completedAt ? format(completedAt, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={completedAt}
                    onSelect={setCompletedAt}
                    disabled={(date) => date > new Date() || date < new Date(task.createdAt || 0)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <p className="text-sm text-muted-foreground">Today, {format(new Date(), "PPP")}</p>
            )}
          </div>

          {task.metrics?.map((metric: TaskMetric) => (
            <div key={metric.id} className="space-y-2">
              <Label htmlFor={`metric-${metric.id}`}>
                {metric.name} {metric.unit && `(${metric.unit})`}
              </Label>
              <Input
                id={`metric-${metric.id}`}
                type={metric.dataType === 'number' ? 'number' : 'text'}
                placeholder={`Enter ${metric.name.toLowerCase()}...`}
                value={metricValues[metric.id] || ""}
                onChange={(e) => updateMetricValue(metric.id, e.target.value)}
                data-testid={`input-metric-${metric.id}`}
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-completion-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            data-testid="button-cancel-complete"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={completeMutation.isPending}
            data-testid="button-submit-complete"
          >
            {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
