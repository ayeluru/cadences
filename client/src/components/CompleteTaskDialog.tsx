import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskWithDetails, TaskMetric } from "@shared/schema";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useCompleteTask } from "@/hooks/use-tasks";

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithDetails;
}

export function CompleteTaskDialog({ open, onOpenChange, task }: CompleteTaskDialogProps) {
  const completeMutation = useCompleteTask();
  const [metricValues, setMetricValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const metrics = Object.entries(metricValues).map(([metricId, value]) => ({
      metricId: Number(metricId),
      value: isNaN(Number(value)) ? value : Number(value)
    }));

    completeMutation.mutate({ 
      id: task.id, 
      notes, 
      metrics 
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setMetricValues({});
        setNotes("");
      }
    });
  };

  const updateMetricValue = (metricId: number, value: string) => {
    setMetricValues(prev => ({ ...prev, [metricId]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Complete: {task.title}</DialogTitle>
          <DialogDescription>
            Record your stats for this completion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            onClick={() => onOpenChange(false)}
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
