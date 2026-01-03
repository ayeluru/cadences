import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskWithDetails, TaskMetric, TaskVariation } from "@shared/schema";
import { useState, useEffect } from "react";
import { Loader2, Calendar, Clock } from "lucide-react";
import { useCompleteTask } from "@/hooks/use-tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, setHours, setMinutes } from "date-fns";

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
  const [completionTime, setCompletionTime] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedVariationId, setSelectedVariationId] = useState<number | undefined>(undefined);
  const [variations, setVariations] = useState<TaskVariation[]>([]);

  useEffect(() => {
    if (open && task.id) {
      fetch(`/api/tasks/${task.id}/variations`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => setVariations(data || []))
        .catch(() => setVariations([]));
    }
  }, [open, task.id]);

  const handleSubmit = () => {
    const metrics = Object.entries(metricValues).map(([metricId, value]) => ({
      metricId: Number(metricId),
      value: isNaN(Number(value)) ? value : Number(value)
    }));

    let finalCompletedAt: string | undefined = undefined;
    if (completedAt) {
      let dateWithTime = completedAt;
      if (completionTime) {
        const [hours, minutes] = completionTime.split(":").map(Number);
        dateWithTime = setMinutes(setHours(completedAt, hours), minutes);
      }
      finalCompletedAt = dateWithTime.toISOString();
    }

    completeMutation.mutate({ 
      id: task.id, 
      notes, 
      metrics,
      completedAt: finalCompletedAt,
      variationId: selectedVariationId
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setMetricValues({});
        setNotes("");
        setCompletedAt(undefined);
        setCompletionTime("");
        setShowDatePicker(false);
        setSelectedVariationId(undefined);
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
      setCompletionTime("");
      setShowDatePicker(false);
      setSelectedVariationId(undefined);
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
                    setCompletionTime("");
                  }
                }}
                data-testid="button-toggle-backdate"
              >
                {showDatePicker ? "Use Today" : "Backdate"}
              </Button>
            </div>
            {showDatePicker ? (
              <div className="space-y-3">
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
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={completionTime}
                    onChange={(e) => setCompletionTime(e.target.value)}
                    placeholder="Time (optional)"
                    className="flex-1"
                    data-testid="input-completion-time"
                  />
                  <span className="text-sm text-muted-foreground">(optional)</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Today, {format(new Date(), "PPP")}</p>
            )}
          </div>

          {variations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="variation">Which variation?</Label>
              <select
                id="variation"
                data-testid="select-variation"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedVariationId ?? ""}
                onChange={(e) => setSelectedVariationId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">No specific variation</option>
                {variations.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Select which variation you performed (optional).
              </p>
            </div>
          )}

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
