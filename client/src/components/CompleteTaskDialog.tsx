import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskWithDetails, TaskMetric, TaskVariation } from "@shared/schema";
import { useState } from "react";
import { Loader2, Calendar, Clock, Plus } from "lucide-react";
import { useCompleteTask } from "@/hooks/use-tasks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, setHours, setMinutes } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithDetails;
  defaultDate?: Date;
}

export function CompleteTaskDialog({ open, onOpenChange, task, defaultDate }: CompleteTaskDialogProps) {
  const completeMutation = useCompleteTask();
  const [metricValues, setMetricValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [completedAt, setCompletedAt] = useState<Date | undefined>(defaultDate);
  const [completionTime, setCompletionTime] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(!!defaultDate);
  const [selectedVariationId, setSelectedVariationId] = useState<number | undefined>(undefined);
  const [showAddVariation, setShowAddVariation] = useState(false);
  const [newVariationName, setNewVariationName] = useState("");
  const [localVariations, setLocalVariations] = useState<TaskVariation[]>([]);

  // Use variations from task payload, merged with any newly added local variations (avoiding duplicates)
  const taskVariationIds = new Set((task.variations || []).map(v => v.id));
  const uniqueLocalVariations = localVariations.filter(v => !taskVariationIds.has(v.id));
  const variations = [...(task.variations || []), ...uniqueLocalVariations];

  const hasMetrics = task.metrics && task.metrics.length > 0;
  const hasExistingVariations = (task.variations || []).length > 0;

  const addVariationMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/tasks/${task.id}/variations`, { name });
      return res.json();
    },
    onSuccess: (newVariation: TaskVariation) => {
      setLocalVariations(prev => [...prev, newVariation]);
      setSelectedVariationId(newVariation.id);
      setNewVariationName("");
      setShowAddVariation(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    }
  });

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
      setShowAddVariation(false);
      setNewVariationName("");
      setLocalVariations([]);
    }
    onOpenChange(isOpen);
  };

  const handleAddVariation = () => {
    if (!newVariationName.trim()) return;
    addVariationMutation.mutate(newVariationName.trim());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Complete: {task.title}</DialogTitle>
          <DialogDescription>
            {hasMetrics ? "Record your stats for this completion." : "Optionally backdate or add notes."}
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

          {(hasExistingVariations || variations.length > 0) ? (
            <div className="space-y-2">
              <Label htmlFor="variation">Which variation? (optional)</Label>
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
              {showAddVariation ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="New variation name..."
                    value={newVariationName}
                    onChange={(e) => setNewVariationName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddVariation()}
                    data-testid="input-new-variation"
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAddVariation}
                    disabled={addVariationMutation.isPending || !newVariationName.trim()}
                    data-testid="button-save-variation"
                  >
                    {addVariationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => { setShowAddVariation(false); setNewVariationName(""); }}
                    data-testid="button-cancel-variation"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAddVariation(true)}
                  className="mt-1"
                  data-testid="button-add-variation"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add new variation
                </Button>
              )}
            </div>
          ) : (
            <div>
              {showAddVariation ? (
                <div className="space-y-2">
                  <Label>Add a variation</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Variation name..."
                      value={newVariationName}
                      onChange={(e) => setNewVariationName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddVariation()}
                      data-testid="input-new-variation"
                      autoFocus
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAddVariation}
                      disabled={addVariationMutation.isPending || !newVariationName.trim()}
                      data-testid="button-save-variation"
                    >
                      {addVariationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => { setShowAddVariation(false); setNewVariationName(""); }}
                      data-testid="button-cancel-variation"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddVariation(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-add-variation"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />
                  Add variation
                </button>
              )}
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
